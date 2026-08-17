import "server-only";

import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrganizationApprovalStatus = "pending" | "approved" | "rejected";

function newApprovalToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * Setzt eine frisch registrierte Firma auf "wartet auf Freigabe" und erzeugt
 * den Capability-Token für den Freigabe-/Ablehnungs-Link in der
 * Benachrichtigungsmail an den Betreiber. Läuft ohne Nutzer-Session
 * (Registrierungs-Aktion nutzt bereits die Service-Role), daher Admin-Client.
 */
export async function requestOrganizationApproval(organizationId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Service-Role nicht verfügbar.");

  const token = newApprovalToken();
  const { error } = await admin
    .from("organizations")
    .update({
      approval_status: "pending",
      approval_token: token,
      approval_requested_at: new Date().toISOString(),
    })
    .eq("id", organizationId);
  if (error) throw new Error(error.message);
  return token;
}

export type OrganizationApprovalDecisionResult = {
  organizationId: string;
  organizationName: string;
  createdByUserId: string | null;
  decision: "approved" | "rejected";
};

/**
 * Löst den Capability-Token aus der Betreiber-Mail ein. Das UPDATE ist
 * bedingt auf `approval_token = token AND approval_status = 'pending'` —
 * dadurch ist ein Doppelklick auf denselben Link (oder ein wiederverwendeter,
 * bereits abgearbeiteter Link) ein no-op statt eines zweiten Mailversands
 * oder eines Statuswechsels weg von einer bereits getroffenen Entscheidung.
 * Der Token wird bei der Entscheidung geleert (Einmal-Link).
 */
export async function decideOrganizationApproval(
  token: string,
  decision: "approved" | "rejected",
  reason?: string | null,
): Promise<OrganizationApprovalDecisionResult | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Service-Role nicht verfügbar.");

  const patch =
    decision === "approved"
      ? { approval_status: "approved", approved_at: new Date().toISOString(), approval_token: null }
      : {
          approval_status: "rejected",
          rejected_at: new Date().toISOString(),
          rejection_reason: reason?.trim() || null,
          approval_token: null,
        };

  const { data, error } = await admin
    .from("organizations")
    .update(patch)
    .eq("approval_token", token)
    .eq("approval_status", "pending")
    .select("id, name, created_by")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as { id: string; name: string; created_by: string | null };
  return {
    organizationId: row.id,
    organizationName: row.name,
    createdByUserId: row.created_by,
    decision,
  };
}

/** Freigabe-Status der eigenen Organisation (Nutzer-Session, RLS-gescoped). */
export const getOrganizationApprovalStatus = cache(async function getOrganizationApprovalStatus(
  organizationId: string,
): Promise<{ status: OrganizationApprovalStatus; rejectionReason: string | null }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "approved", rejectionReason: null };

  const { data, error } = await supabase
    .from("organizations")
    .select("approval_status, rejection_reason")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) return { status: "approved", rejectionReason: null };

  const row = data as { approval_status?: string | null; rejection_reason?: string | null };
  const status: OrganizationApprovalStatus =
    row.approval_status === "pending" || row.approval_status === "rejected" ? row.approval_status : "approved";
  return { status, rejectionReason: row.rejection_reason ?? null };
});
