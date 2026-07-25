import "server-only";

import { convertDocxToPdf, PdfConversionError } from "@/lib/documents/docx-to-pdf";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

/**
 * Baut die Response für einen Dokument-Download-Endpoint. `?format=pdf` wandelt
 * das gerenderte DOCX serverseitig via LibreOffice um; ohne den Parameter (oder
 * bei Konvertierungsfehler auf Client-Wunsch weiter unten) bleibt es beim DOCX.
 */
export async function buildDocumentResponse(
  request: Request,
  doc: { filename: string; bytes: Uint8Array },
): Promise<Response> {
  const format = new URL(request.url).searchParams.get("format");
  if (format === "pdf") {
    try {
      const pdfBytes = await convertDocxToPdf(doc.bytes);
      const filename = doc.filename.replace(/\.docx$/i, ".pdf");
      return new Response(new Uint8Array(pdfBytes), {
        headers: {
          "Content-Type": PDF_MIME,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      const message = e instanceof PdfConversionError ? e.message : "PDF-Konvertierung fehlgeschlagen.";
      return new Response(message, { status: 502 });
    }
  }
  return new Response(new Uint8Array(doc.bytes), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${doc.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
