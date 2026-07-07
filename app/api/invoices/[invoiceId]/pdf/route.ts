import { getOfficeSessionOrNull } from "@/lib/auth/organization";
import { getOrganizationBillingSettings } from "@/lib/db/billing";
import { getInvoiceWithItems } from "@/lib/db/invoices";
import { getQuotePdfProjectHead } from "@/lib/db/quotes";
import { getOrganizationBranding } from "@/lib/db/repository";
import { buildInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { fetchLogoBytes } from "@/lib/pdf/quote-pdf";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ invoiceId: string }> },
) {
  const session = await getOfficeSessionOrNull();
  if (!session) {
    return new Response("Keine Berechtigung.", { status: 403 });
  }

  const { invoiceId } = await ctx.params;
  // RLS begrenzt auf die eigene Organisation — fremde IDs liefern schlicht null.
  const invoice = await getInvoiceWithItems(invoiceId);
  if (!invoice) {
    return new Response("Rechnung nicht gefunden.", { status: 404 });
  }

  const [project, branding, billing] = await Promise.all([
    getQuotePdfProjectHead(invoice.projectId),
    getOrganizationBranding(invoice.organizationId),
    getOrganizationBillingSettings(invoice.organizationId),
  ]);
  if (!project) {
    return new Response("Projekt nicht gefunden.", { status: 404 });
  }
  if (!billing?.iban || !billing.creditorName || !billing.creditorPostalCode || !billing.creditorCity) {
    return new Response(
      "Zahlungsdaten unvollständig — IBAN und Gläubiger-Adresse in den Einstellungen erfassen.",
      { status: 409 },
    );
  }

  const logo = await fetchLogoBytes(branding.logoUrl);
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildInvoicePdf({ invoice, project, branding, billing, logo });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "PDF-Erzeugung fehlgeschlagen.", {
      status: 409,
    });
  }

  const filename = `${invoice.invoiceNumber ?? "Rechnung"}.pdf`;
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
