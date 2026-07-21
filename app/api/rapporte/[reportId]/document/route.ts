import { getOfficeSessionOrNull } from "@/lib/auth/organization";
import { renderRapportDocument } from "@/lib/documents/render-rapport-document";
import { DocumentTemplateError } from "@/lib/documents/render-docx";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(_request: Request, ctx: { params: Promise<{ reportId: string }> }) {
  const session = await getOfficeSessionOrNull();
  if (!session?.organizationId) {
    return new Response("Keine Berechtigung.", { status: 403 });
  }
  const { reportId } = await ctx.params;
  try {
    const { filename, bytes } = await renderRapportDocument(session.organizationId, reportId);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof DocumentTemplateError ? e.message : "Dokument konnte nicht erzeugt werden.";
    return new Response(message, { status: 400 });
  }
}
