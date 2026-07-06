/**
 * Offerten-Summen: pure Berechnung, von Server (Repository) und Client (Formular-Preview)
 * gemeinsam genutzt. Rundung auf Rappen (0.01) — kaufmännisch.
 */

export type QuoteLineItemInput = {
  description: string;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
};

export function roundRappen(value: number): number {
  return Math.round(value * 100) / 100;
}

export function quoteLineTotal(item: Pick<QuoteLineItemInput, "quantity" | "unitPrice">): number {
  return roundRappen(item.quantity * item.unitPrice);
}

export function computeQuoteTotals(
  lineItems: readonly QuoteLineItemInput[],
  vatRate: number,
): { totalNet: number; totalGross: number; lineTotals: number[] } {
  const lineTotals = lineItems.map((item) => quoteLineTotal(item));
  const totalNet = roundRappen(lineTotals.reduce((sum, t) => sum + t, 0));
  const totalGross = roundRappen(totalNet * (1 + vatRate / 100));
  return { totalNet, totalGross, lineTotals };
}
