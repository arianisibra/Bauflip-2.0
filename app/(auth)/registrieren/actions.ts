"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTrustedClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { checkRegistrationAllowed } from "@/lib/security/registration-mode";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { registerOrganizationSchema } from "@/lib/validations/forms";
import { isMailConfigured, sendMail } from "@/lib/mail/send";

export type RegisterState = { error?: string; confirmEmailSent?: boolean } | null;

/**
 * Benachrichtigt den Betreiber über eine neue, wartende Registrierung —
 * mit Freigabe-/Ablehnungs-Link. Text-only (lib/mail/send.ts kennt kein
 * HTML), analog zu allen anderen Mails in der App. Best-effort: siehe
 * Aufrufstelle, ein Mailfehler darf die Registrierung nicht rückgängig machen.
 */
async function notifyOperatorOfPendingRegistration(input: {
  organizationName: string;
  registrantEmail: string;
  registrantDisplayName: string;
  approvalToken: string;
}): Promise<void> {
  if (!isMailConfigured()) return;
  const notifyTo = process.env.REGISTRATION_APPROVAL_NOTIFY_EMAIL?.trim();
  if (!notifyTo) {
    console.error(
      "[bauflip] REGISTRATION_APPROVAL_NOTIFY_EMAIL fehlt — niemand wird über wartende Registrierungen benachrichtigt.",
    );
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!siteUrl) return;
  const approveUrl = `${siteUrl}/api/registrierung/freigabe?token=${input.approvalToken}&entscheid=freigeben`;
  const rejectUrl = `${siteUrl}/api/registrierung/freigabe?token=${input.approvalToken}&entscheid=ablehnen`;

  const text =
    `Neue Firma wartet auf Freigabe:\n\n` +
    `Firma: ${input.organizationName}\n` +
    `Ansprechpartner: ${input.registrantDisplayName}\n` +
    `E-Mail: ${input.registrantEmail}\n\n` +
    `Freigeben:  ${approveUrl}\n` +
    `Ablehnen:   ${rejectUrl}\n\n` +
    `Beide Links funktionieren nur einmal.`;

  await sendMail({
    to: notifyTo,
    subject: `Neue Registrierung wartet auf Freigabe: ${input.organizationName}`,
    text,
  });
}

/**
 * Self-Service-Registrierung: legt Org + Admin-Profil + Mitgliedschaft an, sobald
 * die E-Mail bestätigt ist (mirroring scripts/bootstrap-first-admin.mts, nur ohne
 * manuellen Schritt). Räumt den Auth-User wieder weg, falls einer der DB-Schritte
 * scheitert — ein halb angelegtes Konto darf die E-Mail-Adresse nicht dauerhaft blockieren.
 */
export async function registerOrganizationAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const raw = Object.fromEntries(formData.entries());

  // ZUERST: Darf hier überhaupt registriert werden? Server Actions sind
  // öffentliche HTTP-Endpunkte — wer die Seite gar nicht aufruft, umgeht jede
  // Prüfung, die nur beim Anzeigen stattfindet.
  const zugang = checkRegistrationAllowed(String(raw.registrationCode ?? ""));
  if (!zugang.ok) {
    return { error: zugang.error };
  }

  const parsed = registerOrganizationSchema.safeParse({
    companyName: raw.companyName,
    displayName: raw.displayName,
    email: raw.email,
    password: raw.password,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }
  const { companyName, displayName, email, password } = parsed.data;

  const headerList = await headers();
  const ip = getTrustedClientIp(headerList.get("x-forwarded-for"));
  const rateLimit = consumeRateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!rateLimit.allowed) {
    return { error: "Zu viele Registrierungen von dieser Adresse. Bitte später erneut versuchen." };
  }

  const turnstileToken = String(raw.turnstileToken ?? "");
  const captchaOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!captchaOk) {
    return { error: "Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: "Supabase ist nicht konfiguriert." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: siteUrl ? `${siteUrl}/auth/confirm?next=/` : undefined,
    },
  });

  if (signUpError) {
    if (signUpError.status === 422 || /already registered|already exists/i.test(signUpError.message)) {
      return { error: "Diese E-Mail ist bereits registriert. Bitte einloggen." };
    }
    return { error: "Registrierung fehlgeschlagen. Bitte erneut versuchen." };
  }
  const user = signUpData.user;
  if (!user) {
    return { error: "Registrierung fehlgeschlagen. Bitte erneut versuchen." };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { error: "Registrierung derzeit nicht möglich (Service-Role fehlt)." };
  }

  try {
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({ id: user.id, role: "admin", display_name: displayName }, { onConflict: "id" });
    if (profileError) throw new Error(profileError.message);

    // Freigabe-Workflow: die Firma entsteht sofort, bleibt aber auf
    // approval_status="pending", bis der Betreiber den Link in der
    // Benachrichtigungsmail (unten) anklickt. Der Token ist selbst die
    // Authentisierung des Links (Capability-URL, analog intake_email_token).
    const approvalToken = crypto.randomUUID().replace(/-/g, "");
    const { data: newOrg, error: orgError } = await admin
      .from("organizations")
      .insert({
        name: companyName,
        created_by: user.id,
        approval_status: "pending",
        approval_token: approvalToken,
        approval_requested_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (orgError || !newOrg) {
      throw new Error(orgError?.message ?? "Organisation konnte nicht angelegt werden.");
    }

    const { error: membershipError } = await admin.from("organization_memberships").upsert(
      { organization_id: newOrg.id, user_id: user.id, role: "admin", is_active: true },
      { onConflict: "organization_id,user_id" },
    );
    if (membershipError) throw new Error(membershipError.message);

    // Ohne Workflow-Schritte lehnt der Trigger projects_status_dynamic_check jeden
    // Projekt-Status ab — die neue Firma könnte kein einziges Projekt anlegen.
    // Gewerbeneutrale Vorlage; Beschriftungen sind später im Editor anpassbar.
    const { error: workflowError } = await admin.rpc("seed_default_workflow", { p_org: newOrg.id });
    if (workflowError) throw new Error(workflowError.message);

    // display_name bleibt in user_metadata (Anzeige), aber die Autorisierung
    // (Rolle + Org) gehört in app_metadata — nur mit Service-Role beschreibbar.
    const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, display_name: displayName },
      app_metadata: { ...user.app_metadata, role: "admin", organization_id: newOrg.id },
    });
    if (metaError) throw new Error(metaError.message);

    // Betreiber benachrichtigen — best-effort: ein SMTP-Ausfall darf die
    // Registrierung nicht rückgängig machen (der Betreiber kann die wartende
    // Firma sonst zwar nicht per Mail sehen, aber weiterhin direkt in der DB).
    // Deshalb bewusst NICHT im try/catch, das oben den Nutzer wieder löscht.
    void notifyOperatorOfPendingRegistration({
      organizationName: companyName,
      registrantEmail: email,
      registrantDisplayName: displayName,
      approvalToken,
    }).catch((err) => {
      console.error("[bauflip] Freigabe-Benachrichtigung an Betreiber fehlgeschlagen:", err);
    });
  } catch {
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
    return { error: "Registrierung fehlgeschlagen. Bitte erneut versuchen oder Support kontaktieren." };
  }

  // Mit aktivierter E-Mail-Bestätigung liefert signUp keine Session — Nutzer muss
  // erst den Link in der Mail öffnen. Ohne Bestätigungspflicht ist die Session sofort da.
  if (signUpData.session) {
    redirect("/");
  }
  return { confirmEmailSent: true };
}
