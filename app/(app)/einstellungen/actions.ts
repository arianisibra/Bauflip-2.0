"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureCurrentOrganizationId, requireAdminSession } from "@/lib/auth/organization";

export async function inviteEmployeeAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleInput = String(formData.get("role") ?? "").trim().toLowerCase();
  const turnstileToken = String(formData.get("turnstileToken") ?? "");
  const role = roleInput === "admin" ? "admin" : "technician";

  if (!email) {
    throw new Error("Bitte E-Mail eingeben.");
  }

  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = consumeRateLimit(`invite:${ip}:${email}`, 12, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    throw new Error("Zu viele Einladungen in kurzer Zeit.");
  }

  const captchaOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!captchaOk) {
    throw new Error("Sicherheitsprüfung fehlgeschlagen.");
  }

  const adminSession = await requireAdminSession();
  const organizationId = await ensureCurrentOrganizationId();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }

  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null);

  const { error: inviteRecordError } = await supabase.from("invitations").insert({
    organization_id: organizationId,
    email,
    role,
    invited_by: adminSession.user.id,
    expires_at: expiresAt,
  });

  if (inviteRecordError) {
    throw new Error("Einladung konnte nicht gespeichert werden.");
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("Service-Role-Key fehlt. Einladungen per E-Mail sind nicht aktiv.");
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/onboarding`;
  const { error: authInviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      invited_role: role,
      organization_id: organizationId,
    },
  });

  if (authInviteError) {
    throw new Error("Einladungs-Mail konnte nicht versendet werden.");
  }

  revalidatePath("/einstellungen");
}

export async function acceptInviteOnboardingAction() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    throw new Error("Keine aktive Onboarding-Session gefunden.");
  }

  const normalizedEmail = user.email.toLowerCase();
  const { data: invite, error: inviteError } = await supabase
    .from("invitations")
    .select("*")
    .eq("email", normalizedEmail)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inviteError || !invite) {
    throw new Error("Keine gültige Einladung gefunden.");
  }

  const { error: membershipError } = await supabase.from("organization_memberships").upsert(
    {
      organization_id: invite.organization_id,
      user_id: user.id,
      role: invite.role,
      is_active: true,
    },
    { onConflict: "organization_id,user_id" },
  );
  if (membershipError) {
    throw new Error("Mitgliedschaft konnte nicht aktiviert werden.");
  }

  const displayName = String(user.user_metadata?.display_name ?? "").trim() || normalizedEmail.split("@")[0];
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: normalizedEmail,
      display_name: displayName,
      role: invite.role,
      avatar_url: null,
    },
    { onConflict: "id" },
  );

  const { error: invitationUpdateError } = await supabase
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  if (invitationUpdateError) {
    throw new Error("Einladung konnte nicht abgeschlossen werden.");
  }
}
