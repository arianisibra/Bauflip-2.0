import "server-only";

import { buildAuftragDocumentData } from "@/lib/documents/auftrag-document-data";
import { renderDocxTemplate, DocumentTemplateError } from "@/lib/documents/render-docx";
import {
  downloadTemplateBytes,
  getDefaultDocumentTemplate,
  getDocumentTemplateById,
  listDocumentTemplates,
} from "@/lib/db/document-templates";
import { getAuftragDocumentProjectData } from "@/lib/db/auftrag-document";
import { getOrganizationBranding } from "@/lib/db/repository";
import type { DocumentTemplate } from "@/lib/domain/types";
import type { RenderedDocument } from "@/lib/documents/render-quote-document";

/**
 * Rendert einen Auftrag als Word-Dokument aus einer Org-Vorlage (kind «auftrag»).
 * `templateId` optional — sonst die Standard-Auftragsvorlage der Organisation.
 * Wirft, wenn keine Vorlage vorhanden ist.
 */
export async function renderAuftragDocument(
  organizationId: string,
  projectId: string,
  templateId?: string,
): Promise<RenderedDocument> {
  let template: DocumentTemplate | null = templateId
    ? await getDocumentTemplateById(templateId)
    : await getDefaultDocumentTemplate(organizationId, "auftrag");
  // Kein Standard gesetzt: auf die erste Auftragsvorlage zurückfallen.
  if (!template && !templateId) {
    template = (await listDocumentTemplates(organizationId, "auftrag"))[0] ?? null;
  }
  if (!template || template.organizationId !== organizationId || template.kind !== "auftrag") {
    throw new DocumentTemplateError("Keine Auftragsvorlage hinterlegt.");
  }

  const project = await getAuftragDocumentProjectData(projectId);
  if (!project || project.organizationId !== organizationId) {
    throw new DocumentTemplateError("Projekt nicht gefunden.");
  }

  const [branding, templateBytes] = await Promise.all([
    getOrganizationBranding(organizationId),
    downloadTemplateBytes(template.storagePath),
  ]);
  if (!templateBytes) throw new DocumentTemplateError("Vorlagendatei konnte nicht geladen werden.");

  const data = buildAuftragDocumentData({
    companyName: branding.name,
    project,
  });

  const bytes = renderDocxTemplate(templateBytes, data as unknown as Record<string, unknown>);
  const label = project.referenceCode ?? "Auftrag";
  return { filename: `${label}.docx`, bytes };
}
