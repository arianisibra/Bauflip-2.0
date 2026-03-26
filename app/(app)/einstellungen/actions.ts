"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureCurrentOrganizationId, requireAdminSession } from "@/lib/auth/organization";
import { getCurrentSession } from "@/lib/auth/session";
import { AVATAR_MAX_BYTES, AVATAR_MIME, extForAvatarMime } from "@/lib/storage/mime";
import { isHexColor } from "@/lib/calendar/team-colors";
import { profileSettingsSchema } from "@/lib/validations/forms";

function extractAvatarPathFromPublicUrl(url: string): string | null {
  try {
    const marker = "/object/public/avatars/";
    const i = url.indexOf(marker);
    if (i === -1) {
      return null;
    }
    return decodeURIComponent(url.slice(i + marker.length));
  } catch {
    return null;
  }
}

function avatarStorageClient(supabase: SupabaseClient): SupabaseClient {
  return createSupabaseAdminClient() ?? supabase;
}

export async function saveProfileSettingsAction(formData: FormData) {
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

  let avatarUrl: string | null = session.profile.avatarUrl;

  if (removeAvatar) {
    avatarUrl = null;
    const old = session.profile.avatarUrl;
    if (old) {
      const path = extractAvatarPathFromPublicUrl(old);
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

  revalidatePath("/einstellungen");
  revalidatePath("/");
}

export type TeamMemberListItem = {
  key: string;
  displayName: string;
  email: string;
  role: "admin" | "office" | "technician";
  status: "aktiv" | "eingeladen";
  createdAt: string | null;
};

export async function listTeamMembersAction(): Promise<TeamMemberListItem[]> {
  await requireAdminSession();
  const organizationId = await ensureCurrentOrganizationId();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [];
  }

  const [membershipsResult, invitationsResult] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("user_id, role, is_active, created_at, profiles(display_name)")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("id, email, role, created_at")
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const memberships = (membershipsResult.data as Array<{
    user_id: string;
    role: "admin" | "office" | "technician";
    is_active: boolean;
    created_at: string | null;
    profiles?: { display_name?: string | null } | Array<{ display_name?: string | null }> | null;
  }> | null) ?? [];
  const invitations = (invitationsResult.data as Array<{
    id: string;
    email: string;
    role: "admin" | "office" | "technician";
    created_at: string | null;
  }> | null) ?? [];

  const adminClient = createSupabaseAdminClient();
  const emailByUserId = new Map<string, string>();
  if (adminClient) {
    const { data: usersData, error } = await adminClient.auth.admin.listUsers();
    if (!error) {
      for (const u of usersData.users) {
        if (u.id && u.email) {
          emailByUserId.set(u.id, u.email);
        }
      }
    }
  }

  const activeItems: TeamMemberListItem[] = memberships.map((m) => {
    const profileRaw = Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles ?? null;
    const displayName = String(profileRaw?.display_name ?? "").trim();
    const email = emailByUserId.get(m.user_id) ?? "—";
    return {
      key: `member:${m.user_id}`,
      displayName: displayName || email.split("@")[0] || "Mitarbeiter",
      email,
      role: m.role,
      status: "aktiv",
      createdAt: m.created_at ?? null,
    };
  });

  const pendingItems: TeamMemberListItem[] = invitations.map((inv) => ({
    key: `invite:${inv.id}`,
    displayName: inv.email.split("@")[0] || "Einladung",
    email: inv.email,
    role: inv.role,
    status: "eingeladen",
    createdAt: inv.created_at ?? null,
  }));

  return [...activeItems, ...pendingItems];
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
      display_name: displayName,
      role: invite.role,
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
