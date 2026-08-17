"use server";

import { headers } from "next/headers";
import { getTrustedClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncUserAuthMetadata } from "@/lib/auth/sync-user-auth-metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureCurrentOrganizationId, requireAdminSession } from "@/lib/auth/organization";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrganizationBranding, listTeamMembersForOrg } from "@/lib/db/repository";
import { isMailConfigured, sendMail } from "@/lib/mail/send";
import type { TeamMemberListItem } from "@/lib/mitarbeiter/types";
import { publish } from "@/lib/realtime/publish";
import { AVATAR_MAX_BYTES, AVATAR_MIME, extForAvatarMime } from "@/lib/storage/mime";
import { isHexColor } from "@/lib/calendar/team-colors";
import { profileSettingsSchema } from "@/lib/validations/forms";
import type { UserProfile } from "@/lib/domain/types";

export type SaveProfileSettingsResult = {
  profile: UserProfile;
  organizationBilling: { companyName: string; logoUrl: string | null } | null;
};

/**
 * Storage-Pfad aus einer öffentlichen URL lesen — aber NUR, wenn er unter dem
 * erwarteten Präfix liegt.
 *
 * Die Quelle ist nutzerbeschreibbar: `profiles.avatar_url` und
 * `organizations.logo_url` lassen sich per PostgREST direkt setzen. Gelöscht
 * wird anschliessend mit dem Service-Role-Client, der die Storage-Policies
 * umgeht. Ohne diese Prüfung konnte jeder Angemeldete einen fremden Pfad
 * hinterlegen und ihn per «Bild entfernen» löschen lassen — Profilbilder von
 * Kolleginnen, Firmenlogos, auch die anderer Mandanten. Kein Lesezugriff,
 * aber dauerhafter Datenverlust ohne Spur in der Anwendung.
 */
function avatarPathWithinPrefix(url: string, erlaubtesPraefix: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  if (!base || !url.startsWith(`${base}/`)) {
    return null;
  }
  const marker = "/object/public/avatars/";
  const i = url.indexOf(marker);
  if (i === -1) {
    return null;
  }
  let pfad: string;
  try {
    pfad = decodeURIComponent(url.slice(i + marker.length));
  } catch {
    return null;
  }
  if (pfad.includes("..") || !pfad.startsWith(erlaubtesPraefix)) {
    return null;
  }
  return pfad;
}

function avatarStorageClient(supabase: SupabaseClient): SupabaseClient {
  return createSupabaseAdminClient() ?? supabase;
}

export async function saveProfileSettingsAction(formData: FormData): Promise<SaveProfileSettingsResult> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser || authUser.id !== session.user.id) {
    throw new Error("Sitzung ungültig.");
  }

  const storage = avatarStorageClient(supabase);

  const parsed = profileSettingsSchema.safeParse({
    displayName: formData.get("displayName"),
    calendarPosition: formData.get("calendarPosition"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  const displayName = parsed.data.displayName.trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const calendarColorRaw = String(formData.get("calendarColor") ?? "").trim();
  const calendarColor =
    calendarColorRaw === "" ? null : isHexColor(calendarColorRaw) ? calendarColorRaw : null;
  if (calendarColorRaw !== "" && calendarColor === null) {
    throw new Error("Kalenderfarbe als Hex angeben, z. B. #0ea5e9.");
  }
  const calendarPosition = parsed.data.calendarPosition;
  const removeAvatar =
    formData.get("removeAvatar") === "on" || String(formData.get("removeAvatar") ?? "") === "true";
  const avatarFile = formData.get("avatar") as File | null;
  const removeCompanyLogo =
    formData.get("removeCompanyLogo") === "on" || String(formData.get("removeCompanyLogo") ?? "") === "true";
  const companyLogoFile = formData.get("companyLogo") as File | null;

  let avatarUrl: string | null = session.profile.avatarUrl;

  if (removeAvatar) {
    avatarUrl = null;
    const old = session.profile.avatarUrl;
    if (old) {
      // Nur der eigene Avatar-Ordner — nie ein Pfad, den der Nutzer selbst
      // in profiles.avatar_url hinterlegt hat.
      const path = avatarPathWithinPrefix(old, `${authUser.id}/`);
      if (path) {
        await storage.storage.from("avatars").remove([path]);
      }
    }
  } else if (avatarFile && typeof avatarFile === "object" && avatarFile.size > 0) {
    if (!AVATAR_MIME.has(avatarFile.type)) {
      throw new Error("Nur JPEG, PNG, WebP oder GIF sind erlaubt.");
    }
    if (avatarFile.size > AVATAR_MAX_BYTES) {
      throw new Error("Profilbild darf maximal 2 MB gross sein.");
    }
    const ext = extForAvatarMime(avatarFile.type);
    const path = `${authUser.id}/avatar.${ext}`;
    const buf = Buffer.from(await avatarFile.arrayBuffer());
    const { error: uploadError } = await storage.storage.from("avatars").upload(path, buf, {
      contentType: avatarFile.type,
      upsert: true,
    });
    if (uploadError) {
      throw new Error(uploadError.message);
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    avatarUrl = pub.publicUrl;
  }

  const { error: saveError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName || null,
      avatar_url: avatarUrl,
      calendar_color: calendarColor,
      calendar_position: calendarPosition,
    })
    .eq("id", session.user.id);

  if (saveError) {
    throw new Error("Profil konnte nicht gespeichert werden.");
  }

  let existingCompanyName = "";
  let organizationLogoUrl: string | null = null;

  if (session.role === "admin") {
    const organizationId = session.organizationId ?? (await ensureCurrentOrganizationId());

    if (organizationId) {
      const { data: orgRow } = await supabase
        .from("organizations")
        .select("name, logo_url")
        .eq("id", organizationId)
        .maybeSingle();
      existingCompanyName = String((orgRow as Record<string, unknown> | null)?.name ?? "");
      organizationLogoUrl =
        (orgRow as Record<string, unknown> | null)?.logo_url != null
          ? String((orgRow as Record<string, unknown>).logo_url)
          : null;
    }

    if (removeCompanyLogo && organizationLogoUrl) {
      const oldPath = organizationId
        ? avatarPathWithinPrefix(organizationLogoUrl, `organizations/${organizationId}/`)
        : null;
      if (oldPath) {
        await storage.storage.from("avatars").remove([oldPath]);
      }
      organizationLogoUrl = null;
    } else if (companyLogoFile && typeof companyLogoFile === "object" && companyLogoFile.size > 0 && organizationId) {
      if (!AVATAR_MIME.has(companyLogoFile.type)) {
        throw new Error("Firmenlogo: Nur JPEG, PNG, WebP oder GIF sind erlaubt.");
      }
      if (companyLogoFile.size > AVATAR_MAX_BYTES) {
        throw new Error("Firmenlogo darf maximal 2 MB gross sein.");
      }
      const ext = extForAvatarMime(companyLogoFile.type);
      const path = `organizations/${organizationId}/logo.${ext}`;
      const oldPath = organizationLogoUrl
        ? avatarPathWithinPrefix(organizationLogoUrl, `organizations/${organizationId}/`)
        : null;
      const buf = Buffer.from(await companyLogoFile.arrayBuffer());
      const { error: uploadLogoError } = await storage.storage.from("avatars").upload(path, buf, {
        contentType: companyLogoFile.type,
        upsert: true,
      });
      if (uploadLogoError) {
        throw new Error(uploadLogoError.message);
      }
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      organizationLogoUrl = pub.publicUrl;
      if (oldPath && oldPath !== path) {
        await storage.storage.from("avatars").remove([oldPath]);
      }
    }

    const orgClient = createSupabaseAdminClient() ?? supabase;
    const { error: orgError } = await orgClient
      .from("organizations")
      .update({
        name: companyName || existingCompanyName || "Bauflip Organisation",
        logo_url: organizationLogoUrl,
      })
      .eq("id", organizationId);
    if (orgError) {
      const detail = [orgError.code, orgError.message, orgError.details, orgError.hint].filter(Boolean).join(" | ");
      throw new Error(detail || "Firmeneinstellungen konnten nicht gespeichert werden.");
    }
  }

  const savedCompanyName =
    session.role === "admin"
      ? companyName || existingCompanyName || "Bauflip Organisation"
      : null;
  const savedLogoUrl = session.role === "admin" ? organizationLogoUrl : null;

  return {
    profile: {
      id: session.user.id,
      displayName: displayName || session.profile.displayName,
      email: session.profile.email,
      role: session.role,
      avatarUrl,
      calendarColor,
      calendarPosition,
    },
    organizationBilling:
      session.role === "admin" && session.organizationId
        ? { companyName: savedCompanyName ?? "", logoUrl: savedLogoUrl }
        : null,
  };
}

export type { TeamMemberListItem } from "@/lib/mitarbeiter/types";

export async function listTeamMembersAction(): Promise<TeamMemberListItem[]> {
  try {
    await requireAdminSession();
    const organizationId = await ensureCurrentOrganizationId();
    if (!organizationId) return [];
    return listTeamMembersForOrg(organizationId);
  } catch (err) {
    console.error("[bauflip] listTeamMembersAction failed", err);
    return [];
  }
}

export async function inviteEmployeeAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleInput = String(formData.get("role") ?? "").trim().toLowerCase();
  const turnstileToken = String(formData.get("turnstileToken") ?? "");
  const role =
    roleInput === "admin" ? "admin" : roleInput === "office" ? "office" : "technician";

  if (!email) {
    throw new Error("Bitte E-Mail eingeben.");
  }

  const headerList = await headers();
  const ip = getTrustedClientIp(headerList.get("x-forwarded-for"));
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
    invited_by: adminSession.userId,
    expires_at: expiresAt,
  });

  if (inviteRecordError) {
    throw new Error("Einladung konnte nicht gespeichert werden.");
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("Service-Role-Key fehlt. Einladungen per E-Mail sind nicht aktiv.");
  }

  // Über die Auth-Confirm-Route: tauscht den Token in eine Session (schreibt das Cookie),
  // sonst landet der Eingeladene im ggf. bereits eingeloggten fremden Konto.
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm?next=/onboarding`;
  const { error: authInviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      invited_role: role,
      organization_id: organizationId,
    },
  });

  if (authInviteError) {
    // Supabase erlaubt inviteUserByEmail nur für Adressen ohne bestehendes
    // Auth-Konto (422 "email_exists"). Genau das trifft zu, wenn ein früherer
    // Einladungslink nie fertig abgeschlossen wurde — der Klick darauf legt
    // bereits ein bestätigtes Auth-Konto an (siehe /auth/hash), auch wenn nie
    // ein Passwort gesetzt und die Einladung nie akzeptiert wurde. Ohne diesen
    // Zweig wäre ein zweiter Einladungsversuch für dieselbe Person dauerhaft
    // blockiert.
    const emailExists =
      (authInviteError as { status?: number; code?: string }).status === 422 ||
      (authInviteError as { code?: string }).code === "email_exists" ||
      /already.*registered/i.test(authInviteError.message);
    if (!emailExists) {
      throw new Error("Einladungs-Mail konnte nicht versendet werden.");
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (linkError || !linkData?.user) {
      throw new Error("Einladungs-Mail konnte nicht versendet werden.");
    }

    // Echter Konflikt statt einer nie abgeschlossenen alten Einladung: wer
    // bereits eine aktive Mitgliedschaft hat, bekommt keinen neuen Link.
    const { data: existingMembership } = await adminClient
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", linkData.user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (existingMembership) {
      throw new Error("Diese E-Mail-Adresse gehört bereits zu einem aktiven Konto.");
    }

    if (!isMailConfigured()) {
      throw new Error("Einladungs-Mail konnte nicht versendet werden (SMTP nicht konfiguriert).");
    }
    const branding = await getOrganizationBranding(organizationId);
    const text =
      `Guten Tag\n\n` +
      `Sie wurden zu «${branding.name}» auf Bauflip eingeladen. Über den folgenden Link ` +
      `schliessen Sie Ihr Konto ab (Passwort setzen):\n\n${linkData.properties.action_link}\n\n` +
      `Der Link ist einmalig gültig.\n\nFreundliche Grüsse\n${branding.name}`;
    await sendMail({
      to: email,
      subject: `Einladung zu ${branding.name} auf Bauflip`,
      text,
      fromName: branding.name,
    });
  }

  await publish(organizationId, { type: "membership.changed" });
}

/**
 * Schliesst eine Einladung ab: legt Profil + Mitgliedschaft an und markiert die
 * Einladung als angenommen.
 *
 * Läuft bewusst über den Service-Role-Client. Der Eingeladene hat per Definition
 * noch KEINE Mitgliedschaft, `invitations` und `organization_memberships` sind
 * per RLS aber Admins der eigenen Organisation vorbehalten. Mit dem regulären
 * Client scheiterte deshalb jeder Schritt (Einladung nicht lesbar, Mitgliedschaft
 * nicht anlegbar) — der Flow konnte nie durchlaufen.
 *
 * Sicherheitsanker: Die Session wird zuerst regulär geprüft, und es wird
 * ausschliesslich eine Einladung akzeptiert, die exakt auf die E-Mail des bereits
 * authentifizierten Nutzers lautet. Rolle und Organisation stammen allein aus
 * dieser Einladung — nichts davon ist vom Client beeinflussbar.
 */
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

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("Service-Role-Key fehlt. Einladung kann nicht abgeschlossen werden.");
  }

  const normalizedEmail = user.email.toLowerCase();
  const { data: invite, error: inviteError } = await adminClient
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

  // Profil MUSS vor der Mitgliedschaft stehen: organization_memberships.user_id
  // zeigt per Fremdschlüssel auf profiles.id.
  const displayName = String(user.user_metadata?.display_name ?? "").trim() || normalizedEmail.split("@")[0];
  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      id: user.id,
      display_name: displayName,
      role: invite.role,
    },
    { onConflict: "id" },
  );
  if (profileError) {
    throw new Error("Profil konnte nicht angelegt werden.");
  }

  const { error: membershipError } = await adminClient.from("organization_memberships").upsert(
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

  // Rolle + Org in app_metadata spiegeln (nur Service-Role beschreibbar), damit
  // der Proxy die Membership-Abfrage überspringen darf.
  await syncUserAuthMetadata(user.id, invite.role, String(invite.organization_id), user.app_metadata);

  const { error: invitationUpdateError } = await adminClient
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  if (invitationUpdateError) {
    throw new Error("Einladung konnte nicht abgeschlossen werden.");
  }

  await publish(String(invite.organization_id), { type: "membership.changed" });
}
