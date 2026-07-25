import { getOfficeSessionOrNull } from "@/lib/auth/organization";
import { EMPTY_ORGANIZATION_BILLING_SETTINGS, getOrganizationBillingSettings } from "@/lib/db/billing";
import { getQuotePdfProjectHead, getQuoteWithItems } from "@/lib/db/quotes";
import { getOrganizationBranding } from "@/lib/db/repository";
import { buildQuotePdf, fetchLogoBytes } from "@/lib/pdf/quote-pdf";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ quoteId: string }> },
) {
  const session = await getOfficeSessionOrNull();
  if (!session) {
    return new Response("Keine Berechtigung.", { status: 403 });
  }

  const { quoteId } = await ctx.params;
  // RLS begrenzt auf die eigene Organisation — fremde IDs liefern schlicht null.
  const quote = await getQuoteWithItems(quoteId);
  if (!quote) {
    return new Response("Offerte nicht gefunden.", { status: 404 });
  }

  const [project, branding, billing] = await Promise.all([
    getQuotePdfProjectHead(quote.projectId),
    getOrganizationBranding(quote.organizationId),
    getOrganizationBillingSettings(quote.organizationId),
  ]);
  if (!project) {
    return new Response("Projekt nicht gefunden.", { status: 404 });
  }

  const logo = await fetchLogoBytes(branding.logoUrl);
  const pdfBytes = await buildQuotePdf({
    quote,
    project,
    branding,
    billing: billing ?? EMPTY_ORGANIZATION_BILLING_SETTINGS,
    logo,
  });

  const filename = `${quote.quoteNumber ?? "Offerte"}.pdf`;
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
