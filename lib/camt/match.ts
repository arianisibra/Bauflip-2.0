/**
 * Zahlungsabgleich: camt-Gutschriften gegen offene/erledigte Rechnungen matchen.
 *
 * Bewusst strikt: Matching läuft ausschliesslich über die exakte, eingefrorene
 * QR-Referenz (`payment_reference`) — nie über Namen, Beträge allein oder
 * Freitext-Heuristik. Ein Treffer ohne Referenz-Übereinstimmung existiert nicht;
 * unklare Fälle landen in "unmatched" zur manuellen Prüfung.
 *
 * `invoices` sollte sowohl offene (`sent`) als auch bereits bezahlte (`paid`)
 * Rechnungen enthalten — nur so kann ein erneuter Import derselben Datei als
 * "bereits erfasst" statt "unbekannt" erkannt werden (macht Doppel-Imports harmlos).
 */

import type { CamtCreditEntry } from "@/lib/camt/parse";
import type { InvoiceStatus } from "@/lib/domain/types";

export type MatchableInvoice = {
  id: string;
  invoiceNumber: string | null;
  paymentReference: string | null;
  totalGross: number;
  /** Akonto-Abzug bei Schlussrechnungen — der tatsächlich geforderte Betrag ist totalGross - deductedAmount. */
  deductedAmount: number;
  status: InvoiceStatus;
};

/**
 * Generisch über den Rechnungstyp (`T`), damit Aufrufer zusätzliche Anzeigefelder
 * (z. B. Projekttitel) verlustfrei durchreichen können, ohne zu casten.
 */
export type CamtMatchResult<T extends MatchableInvoice = MatchableInvoice> =
  | { kind: "matched"; entry: CamtCreditEntry; invoice: T }
  | {
      kind: "amountMismatch";
      entry: CamtCreditEntry;
      invoice: T;
      expectedAmount: number;
    }
  | { kind: "alreadyPaid"; entry: CamtCreditEntry; invoice: T }
  | { kind: "unmatched"; entry: CamtCreditEntry };

function normalizeReference(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Rappen-genauer Vergleich ohne Fliesskomma-Fallstricke. */
function amountsEqual(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

export function matchCamtEntries<T extends MatchableInvoice>(
  entries: readonly CamtCreditEntry[],
  invoices: readonly T[],
): CamtMatchResult<T>[] {
  const byReference = new Map<string, T>();
  for (const invoice of invoices) {
    if (!invoice.paymentReference) continue;
    const key = normalizeReference(invoice.paymentReference);
    // Bei einer (durch die DB eigentlich ausgeschlossenen) Doppel-Referenz
    // gewinnt die erste — deterministisch statt zufällig durch Iterationsreihenfolge.
    if (!byReference.has(key)) byReference.set(key, invoice);
  }

  return entries.map((entry): CamtMatchResult<T> => {
    if (!entry.reference) return { kind: "unmatched", entry };

    const invoice = byReference.get(normalizeReference(entry.reference));
    if (!invoice) return { kind: "unmatched", entry };

    if (invoice.status === "paid") return { kind: "alreadyPaid", entry, invoice };

    // Bei Schlussrechnungen mit Akonto-Abzug ist der auf dem QR-Zahlteil
    // gedruckte (und vom Kunden tatsächlich überwiesene) Betrag totalGross
    // minus deductedAmount, nicht der volle Rechnungsbetrag (invoice-pdf.ts:
    // `amountDue = totalGross - deductedAmount`). Ein Vergleich gegen den
    // vollen Betrag hätte jede bezahlte Schlussrechnung mit Abzug fälschlich
    // als "amountMismatch" gemeldet.
    const expectedAmount = invoice.totalGross - invoice.deductedAmount;
    if (!amountsEqual(entry.amount, expectedAmount)) {
      return { kind: "amountMismatch", entry, invoice, expectedAmount };
    }

    return { kind: "matched", entry, invoice };
  });
}

/** Kurzfassung für die Vorschau-UI: wie viele Einträge in welchem Eimer. */
export function summarizeCamtMatches(results: readonly CamtMatchResult[]): Record<CamtMatchResult["kind"], number> {
  const summary: Record<CamtMatchResult["kind"], number> = {
    matched: 0,
    amountMismatch: 0,
    alreadyPaid: 0,
    unmatched: 0,
  };
  for (const result of results) summary[result.kind] += 1;
  return summary;
}
