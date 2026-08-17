import "server-only";

import { buildQuoteDocumentData } from "@/lib/documents/quote-document-data";
import { renderDocxTemplate, DocumentTemplateError } from "@/lib/documents/render-docx";
import {
  downloadTemplateBytes,
  getDefaultDocumentTemplate,
  getDocumentTemplateById,
  listDocumentTemplates,
} from "@/lib/db/document-templates";
import { getQuoteWithItems, getQuotePdfProjectHead } from "@/lib/db/quotes";
import { getOrganizationBranding } from "@/lib/db/repository";
import { getOrganizationBillingSettings } from "@/lib/db/billing";
import type { DocumentTemplate } from "@/lib/domain/types";

export type RenderedDocument = { filename: string; bytes: Buffer };

/**
 * Rendert eine Offerte als Word-Dokument aus einer Org-Vorlage.
 * `templateId` optional — sonst die Standard-Offertvorlage der Organisation.
 * Wirft, wenn keine Vorlage vorhanden ist (Aufrufer bietet dann den PDF-Fallback an).
 */
export async function renderQuoteDocument(
  organizationId: string,
  quoteId: string,
  templateId?: string,
): Promise<RenderedDocument> {
  let template: DocumentTemplate | null = templateId
    ? await getDocumentTemplateById(templateId)
    : await getDefaultDocumentTemplate(organizationId, "offerte");
  // Kein Standard gesetzt (z. B. nach Löschen): auf die erste Offert-Vorlage zurückfallen.
  if (!template && !templateId) {
    template = (await listDocumentTemplates(organizationId, "offerte"))[0] ?? null;
  }
  if (!template || template.organizationId !== organizationId) {
    throw new DocumentTemplateError("Keine Offertvorlage hinterlegt.");
  }

  const quote = await getQuoteWithItems(quoteId);
  if (!quote || quote.organizationId !== organizationId) {
    throw new DocumentTemplateError("Offerte nicht gefunden.");
  }
  const [project, branding, billing, templateBytes] = await Promise.all([
    getQuotePdfProjectHead(quote.projectId),
    getOrganizationBranding(organizationId),
    getOrganizationBillingSettings(organizationId),
    downloadTemplateBytes(template.storagePath),
  ]);
  if (!project) throw new DocumentTemplateError("Projekt nicht gefunden.");
  if (!templateBytes) throw new DocumentTemplateError("Vorlagendatei konnte nicht geladen werden.");

  const data = buildQuoteDocumentData({
    companyName: branding.name,
    billing,
    quote,
    project,
  });

  const bytes = renderDocxTemplate(templateBytes, data as unknown as Record<string, unknown>);
  const label = quote.quoteNumber ?? "Offerte";
  return { filename: `${label}.docx`, bytes };
}
