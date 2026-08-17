import "server-only";

import { buildInvoiceDocumentData } from "@/lib/documents/invoice-document-data";
import { renderDocxTemplate, DocumentTemplateError } from "@/lib/documents/render-docx";
import {
  downloadTemplateBytes,
  getDefaultDocumentTemplate,
  getDocumentTemplateById,
  listDocumentTemplates,
} from "@/lib/db/document-templates";
import { getInvoiceWithItems } from "@/lib/db/invoices";
import { getQuotePdfProjectHead } from "@/lib/db/quotes";
import { getOrganizationBranding } from "@/lib/db/repository";
import type { DocumentTemplate } from "@/lib/domain/types";
import type { RenderedDocument } from "@/lib/documents/render-quote-document";

/**
 * Rendert eine Rechnung als Word-Dokument aus einer Org-Vorlage (kind «rechnung»).
 * `templateId` optional — sonst die Standard-Rechnungsvorlage der Organisation.
 * Wirft, wenn keine Vorlage vorhanden ist (Aufrufer bietet dann den PDF-Fallback an).
 *
 * Der Swiss-QR-Zahlteil ist NICHT Teil dieser Ausgabe — die Word-Vorlage deckt nur
 * den Briefteil ab (siehe invoice-document-data.ts). Die QR-Rechnung bleibt der
 * bestehende PDF-Weg (lib/pdf/invoice-pdf.ts).
 */
export async function renderInvoiceDocument(
  organizationId: string,
  invoiceId: string,
  templateId?: string,
): Promise<RenderedDocument> {
  let template: DocumentTemplate | null = templateId
    ? await getDocumentTemplateById(templateId)
    : await getDefaultDocumentTemplate(organizationId, "rechnung");
  // Kein Standard gesetzt: auf die erste Rechnungsvorlage zurückfallen.
  if (!template && !templateId) {
    template = (await listDocumentTemplates(organizationId, "rechnung"))[0] ?? null;
  }
  if (!template || template.organizationId !== organizationId || template.kind !== "rechnung") {
    throw new DocumentTemplateError("Keine Rechnungsvorlage hinterlegt.");
  }

  // RLS begrenzt getInvoiceWithItems auf die eigene Organisation — fremde IDs liefern null.
  const invoice = await getInvoiceWithItems(invoiceId);
  if (!invoice || invoice.organizationId !== organizationId) {
    throw new DocumentTemplateError("Rechnung nicht gefunden.");
  }

  const project = await getQuotePdfProjectHead(invoice.projectId);
  if (!project) {
    throw new DocumentTemplateError("Projekt nicht gefunden.");
  }

  const [branding, templateBytes] = await Promise.all([
    getOrganizationBranding(organizationId),
    downloadTemplateBytes(template.storagePath),
  ]);
  if (!templateBytes) throw new DocumentTemplateError("Vorlagendatei konnte nicht geladen werden.");

  const data = buildInvoiceDocumentData({
    companyName: branding.name,
    invoice,
    project,
  });

  const bytes = renderDocxTemplate(templateBytes, data as unknown as Record<string, unknown>);
  const label = invoice.invoiceNumber ?? "Rechnung";
  return { filename: `${label}.docx`, bytes };
}
