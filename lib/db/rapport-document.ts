import "server-only";

import { cache } from "react";
import type { RapportReportData } from "@/lib/documents/rapport-document-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Einen Monteur-Rapport für die Word-Vorlage laden. Liefert die Rapportfelder + die
 * Projekt-ID; die Projektdaten (Adresse/Kontakte) holt der Aufrufer über
 * getAuftragDocumentProjectData (Wiederverwendung). Org-Scoping macht der Aufrufer
 * über die organization_id des Projekts.
 */
export const getRapportDocumentReport = cache(async function getRapportDocumentReport(
  reportId: string,
): Promise<{ report: RapportReportData; projectId: string } | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("technician_reports")
    .select(
      "project_id, outcome, summary, work_description, time_spent_minutes, created_at, created_by_display_name, has_signature, signed_by_name",
    )
    .eq("id", reportId)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as Record<string, unknown>;
  const projectId = row.project_id != null ? String(row.project_id) : "";
  if (!projectId) return null;
  const s = (v: unknown) => (v != null && String(v).trim() ? String(v).trim() : null);

  return {
    projectId,
    report: {
      createdAt: s(row.created_at),
      outcome: String(row.outcome ?? ""),
      workDescription: s(row.work_description),
      summary: s(row.summary),
      timeSpentMinutes: row.time_spent_minutes != null ? Number(row.time_spent_minutes) : null,
      createdByDisplayName: s(row.created_by_display_name),
      signedByName: s(row.signed_by_name),
      hasSignature: row.has_signature === true,
    },
  };
});
