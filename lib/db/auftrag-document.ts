import "server-only";

import { cache } from "react";
import { projectStatusLabels, type ProjectStatus } from "@/lib/domain/types";
import type { AuftragProjectData } from "@/lib/documents/auftrag-document-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Projektdaten für die Auftrags-Word-Vorlage — reicher als der Offert-Head
 * (inkl. Kontakt-Details, Auftragsbeschreibung, Hinweise, Zugang, Kostendach).
 * Org-Scoping macht der Aufrufer (render-auftrag-document) über den Vergleich mit
 * organization_id.
 */
export const getAuftragDocumentProjectData = cache(async function getAuftragDocumentProjectData(
  projectId: string,
): Promise<(AuftragProjectData & { organizationId: string | null }) | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("projects")
    .select(
      "organization_id, title, reference_code, status, created_at, tenant_name, tenant_phone, tenant_email, " +
        "management_name, management_phone, management_email, service_street, service_postal_code, service_city, " +
        "intake_original_text, hints_and_notes, access_notes, cost_ceiling_text",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as Record<string, unknown>;
  const s = (v: unknown) => (v != null && String(v).trim() ? String(v).trim() : null);
  const statusRaw = s(row.status);
  const statusLabel =
    statusRaw && (statusRaw in projectStatusLabels)
      ? projectStatusLabels[statusRaw as ProjectStatus]
      : statusRaw;

  return {
    organizationId: s(row.organization_id),
    title: String(row.title ?? ""),
    referenceCode: s(row.reference_code),
    createdAt: s(row.created_at),
    statusLabel,
    tenantName: s(row.tenant_name),
    tenantPhone: s(row.tenant_phone),
    tenantEmail: s(row.tenant_email),
    managementName: s(row.management_name),
    managementPhone: s(row.management_phone),
    managementEmail: s(row.management_email),
    serviceStreet: s(row.service_street),
    servicePostalCode: s(row.service_postal_code),
    serviceCity: s(row.service_city),
    description: s(row.intake_original_text),
    hintsAndNotes: s(row.hints_and_notes),
    accessNotes: s(row.access_notes),
    costCeilingText: s(row.cost_ceiling_text),
  };
});
