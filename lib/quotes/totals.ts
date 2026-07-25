/**
 * Offerten-Summen: pure Berechnung, von Server (Repository) und Client (Formular-Preview)
 * gemeinsam genutzt. Rundung auf Rappen (0.01) — kaufmännisch.
 */

/** "header" = reine Abschnittsüberschrift (z. B. "Malerarbeiten") ohne Menge/Preis. */
export type LineItemType = "line" | "header";

export type QuoteLineItemInput = {
  itemType?: LineItemType;
  description: string;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
};

export function roundRappen(value: number): number {
  return Math.round(value * 100) / 100;
}

export function quoteLineTotal(
  item: Pick<QuoteLineItemInput, "quantity" | "unitPrice" | "itemType">,
): number {
  if (item.itemType === "header") return 0;
  return roundRappen(item.quantity * item.unitPrice);
}

/**
 * `totalNet` bleibt die Basis für die MwSt-Berechnung (also NACH Rabatt) — das
 * hält alle bestehenden Aufrufer (PDF "Netto CHF", Dashboard-Summen) korrekt,
 * ohne sie anzupassen. `subtotal`/`discountAmount` sind nur für die Anzeige
 * gedacht (Rabattzeile wird nur gezeigt, wenn discountPercent > 0).
 */
export function computeQuoteTotals(
  lineItems: readonly QuoteLineItemInput[],
  vatRate: number,
  discountPercent = 0,
): { subtotal: number; discountAmount: number; totalNet: number; totalGross: number; lineTotals: number[] } {
  const lineTotals = lineItems.map((item) => quoteLineTotal(item));
  const subtotal = roundRappen(lineTotals.reduce((sum, t) => sum + t, 0));
  const discountAmount = roundRappen(subtotal * (discountPercent / 100));
  const totalNet = roundRappen(subtotal - discountAmount);
  const totalGross = roundRappen(totalNet * (1 + vatRate / 100));
  return { subtotal, discountAmount, totalNet, totalGross, lineTotals };
}
