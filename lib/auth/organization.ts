import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUserAuthMetadata } from "@/lib/auth/sync-user-auth-metadata";
import { getLayoutSession, type LayoutSession } from "@/lib/auth/session";
import { canAccessTechFieldRoutes, type RoleType } from "@/lib/domain/types";

function isOfficeRole(role: RoleType): boolean {
  return role === "office" || role === "admin";
}

/** Read/monitor paths: proxy headers + cookie session, no profile DB. */
export async function requireOfficeSession(): Promise<LayoutSession> {
  const session = await getLayoutSession();
  if (!session || !isOfficeRole(session.role)) {
    throw new Error("Keine Berechtigung.");
  }
  return session;
}

export async function getOfficeSessionOrNull(): Promise<LayoutSession | null> {
  const session = await getLayoutSession();
  if (!session || !isOfficeRole(session.role)) return null;
  return session;
}

export async function requireAdminLayoutSession(): Promise<LayoutSession> {
  const session = await getLayoutSession();
  if (!session || session.role !== "admin") {
    throw new Error("Nur Admins dürfen diese Aktion ausführen.");
  }
  return session;
}

export async function requireTechFieldSession(): Promise<LayoutSession> {
  const session = await getLayoutSession();
  if (!session || !canAccessTechFieldRoutes(session.role)) {
    throw new Error("Keine Berechtigung.");
  }
  return session;
}

export async function getTechFieldSessionOrNull(): Promise<LayoutSession | null> {
  const session = await getLayoutSession();
  if (!session || !canAccessTechFieldRoutes(session.role)) return null;
  return session;
}

export async function requireOrgLayoutSession(): Promise<LayoutSession & { organizationId: string }> {
  const session = await getLayoutSession();
  if (!session?.organizationId) {
    throw new Error("Nicht angemeldet.");
  }
  return session as LayoutSession & { organizationId: string };
}

export async function requireAdminSession() {
  return requireAdminLayoutSession();
}

export async function ensureCurrentOrganizationId() {
  const session = await requireAdminLayoutSession();
  if (session.organizationId) {
    return session.organizationId;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: "Bauflip Organisation",
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (orgError || !organization) {
    throw new Error("Organisation konnte nicht erstellt werden.");
  }

  const { error: membershipError } = await supabase.from("organization_memberships").insert({
    organization_id: organization.id,
    user_id: session.userId,
    role: "admin",
    is_active: true,
  });

  if (membershipError) {
    throw new Error("Admin-Mitgliedschaft konnte nicht erstellt werden.");
  }

  await syncUserAuthMetadata(session.userId, "admin", organization.id as string);

  return organization.id as string;
}
