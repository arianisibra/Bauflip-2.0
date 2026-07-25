import { getOfficeSessionOrNull } from "@/lib/auth/organization";
import { renderRapportDocument } from "@/lib/documents/render-rapport-document";
import { DocumentTemplateError } from "@/lib/documents/render-docx";
import { buildDocumentResponse } from "@/lib/documents/document-response";

export async function GET(request: Request, ctx: { params: Promise<{ reportId: string }> }) {
  const session = await getOfficeSessionOrNull();
  if (!session?.organizationId) {
    return new Response("Keine Berechtigung.", { status: 403 });
  }
  const { reportId } = await ctx.params;
  try {
    const doc = await renderRapportDocument(session.organizationId, reportId);
    return buildDocumentResponse(request, doc);
  } catch (e) {
    const message = e instanceof DocumentTemplateError ? e.message : "Dokument konnte nicht erzeugt werden.";
    return new Response(message, { status: 400 });
  }
}
