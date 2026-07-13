"use server";

import { requireAdminLayoutSession } from "@/lib/auth/organization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Mitglied aus der Organisation entfernen (Soft-Deaktivieren: is_active=false).
 * Zugriff wird sofort entzogen (Session/RLS verlangen is_active), Historie bleibt.
 *
 * Service-Role-Client, weil ein Admin fremde Mitgliedschaften ändert (RLS ließe das
 * nicht zu). Deshalb ist JEDE Abfrage strikt auf die eigene Organisation begrenzt.
 * Schutzregeln: nicht sich selbst, nicht den letzten Admin.
 */
export async function deactivateTeamMemberAction(userId: string): Promise<void> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");
  if (!userId) throw new Error("Ungültige Auswahl.");
  if (userId === session.userId) throw new Error("Du kannst dich nicht selbst entfernen.");

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Nicht verfügbar (Service-Role fehlt).");

  const { data: target, error: targetError } = await admin
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", session.organizationId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (targetError) throw new Error(targetError.message);
  if (!target) throw new Error("Mitglied nicht gefunden.");

  if (target.role === "admin") {
    const { count } = await admin
      .from("organization_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", session.organizationId)
      .eq("role", "admin")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      throw new Error("Der letzte Admin kann nicht entfernt werden.");
    }
  }

  const { error } = await admin
    .from("organization_memberships")
    .update({ is_active: false })
    .eq("organization_id", session.organizationId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Offene Einladung zurückziehen (setzt invitations.revoked_at). Danach verschwindet
 * der «Eingeladen»-Eintrag aus der Liste; der Link in der Mail funktioniert nicht mehr.
 * Org-scoped über den regulären Server-Client (RLS erlaubt Admin/Büro der eigenen Org).
 */
export async function revokeInvitationAction(email: string): Promise<void> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Ungültige Auswahl.");

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { error } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organization_id", session.organizationId)
    .eq("email", normalized)
    .is("accepted_at", null)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
}
