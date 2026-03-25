import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/lib/auth/session";

export async function requireAdminSession() {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin") {
    throw new Error("Nur Admins dürfen diese Aktion ausführen.");
  }
  return session;
}

export async function ensureCurrentOrganizationId() {
  const session = await requireAdminSession();
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
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (orgError || !organization) {
    throw new Error("Organisation konnte nicht erstellt werden.");
  }

  const { error: membershipError } = await supabase.from("organization_memberships").insert({
    organization_id: organization.id,
    user_id: session.user.id,
    role: "admin",
    is_active: true,
  });

  if (membershipError) {
    throw new Error("Admin-Mitgliedschaft konnte nicht erstellt werden.");
  }

  return organization.id as string;
}
