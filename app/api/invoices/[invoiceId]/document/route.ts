import { getOfficeSessionOrNull } from "@/lib/auth/organization";
import { renderInvoiceDocument } from "@/lib/documents/render-invoice-document";
import { DocumentTemplateError } from "@/lib/documents/render-docx";
import { buildDocumentResponse } from "@/lib/documents/document-response";

export async function GET(request: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  const session = await getOfficeSessionOrNull();
  if (!session?.organizationId) {
    return new Response("Keine Berechtigung.", { status: 403 });
  }
  const { invoiceId } = await ctx.params;
  try {
    const doc = await renderInvoiceDocument(session.organizationId, invoiceId);
    return buildDocumentResponse(request, doc);
  } catch (e) {
    const message = e instanceof DocumentTemplateError ? e.message : "Dokument konnte nicht erzeugt werden.";
    return new Response(message, { status: 400 });
  }
}
