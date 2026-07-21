import "server-only";

import { buildRapportDocumentData } from "@/lib/documents/rapport-document-data";
import { renderDocxTemplate, DocumentTemplateError } from "@/lib/documents/render-docx";
import {
  downloadTemplateBytes,
  getDefaultDocumentTemplate,
  getDocumentTemplateById,
  listDocumentTemplates,
} from "@/lib/db/document-templates";
import { getRapportDocumentReport } from "@/lib/db/rapport-document";
import { getAuftragDocumentProjectData } from "@/lib/db/auftrag-document";
import { getOrganizationBranding } from "@/lib/db/repository";
import type { DocumentTemplate } from "@/lib/domain/types";
import type { RenderedDocument } from "@/lib/documents/render-quote-document";

/**
 * Rendert einen Rapport als Word-Dokument aus einer Org-Vorlage (kind «rapport»).
 * `templateId` optional — sonst die Standard-Rapportvorlage der Organisation.
 */
export async function renderRapportDocument(
  organizationId: string,
  reportId: string,
  templateId?: string,
): Promise<RenderedDocument> {
  let template: DocumentTemplate | null = templateId
    ? await getDocumentTemplateById(templateId)
    : await getDefaultDocumentTemplate(organizationId, "rapport");
  if (!template && !templateId) {
    template = (await listDocumentTemplates(organizationId, "rapport"))[0] ?? null;
  }
  if (!template || template.organizationId !== organizationId || template.kind !== "rapport") {
    throw new DocumentTemplateError("Keine Rapportvorlage hinterlegt.");
  }

  const reportBundle = await getRapportDocumentReport(reportId);
  if (!reportBundle) throw new DocumentTemplateError("Rapport nicht gefunden.");

  const project = await getAuftragDocumentProjectData(reportBundle.projectId);
  if (!project || project.organizationId !== organizationId) {
    throw new DocumentTemplateError("Projekt nicht gefunden.");
  }

  const [branding, templateBytes] = await Promise.all([
    getOrganizationBranding(organizationId),
    downloadTemplateBytes(template.storagePath),
  ]);
  if (!templateBytes) throw new DocumentTemplateError("Vorlagendatei konnte nicht geladen werden.");

  const data = buildRapportDocumentData({
    companyName: branding.name,
    project,
    report: reportBundle.report,
  });

  const bytes = renderDocxTemplate(templateBytes, data as unknown as Record<string, unknown>);
  const label = project.referenceCode ? `Rapport ${project.referenceCode}` : "Rapport";
  return { filename: `${label}.docx`, bytes };
}
