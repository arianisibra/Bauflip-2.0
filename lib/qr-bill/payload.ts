/**
 * Swiss QR Code Payload (SIX Swiss Payment Standards) — pure Assembly der
 * Zeilenstruktur SPC/0200/1 … EPD. Strukturierte Adressen (Typ S) sind Pflicht.
 *
 * Der Payload wird 1:1 in den QR-Code codiert (Fehlerkorrektur M); die
 * PDF-Schicht kümmert sich um Rendering, Masse und Schweizerkreuz.
 */

import type { InvoiceReferenceType } from "@/lib/domain/types";
import { isValidQrBillIban, normalizeIban } from "@/lib/qr-bill/iban";
import { isValidQrrReference, isValidScorReference } from "@/lib/qr-bill/reference";

export type QrBillAddress = {
  name: string;
  street: string | null;
  buildingNumber: string | null;
  postalCode: string;
  city: string;
  /** ISO-3166-1 alpha-2, z. B. CH. */
  country: string;
};

export type QrBillData = {
  iban: string;
  creditor: QrBillAddress;
  /** null = Betrag offen (Einzahler trägt ein). */
  amount: number | null;
  currency: "CHF" | "EUR";
  /** null = «Zahlbar durch» bleibt leer (Einzahler füllt aus). */
  debtor: QrBillAddress | null;
  referenceType: InvoiceReferenceType;
  reference: string | null;
  /** Unstrukturierte Mitteilung, z. B. «Rechnung RE-2026-1001». */
  unstructuredMessage: string | null;
};

function clamp(value: string | null | undefined, maxLength: number): string {
  if (!value) return "";
  return value.trim().slice(0, maxLength);
}

/** 7 Zeilen strukturierte Adresse (Typ S) oder 7 Leerzeilen. */
function addressLines(address: QrBillAddress | null): string[] {
  if (!address) return ["", "", "", "", "", "", ""];
  return [
    "S",
    clamp(address.name, 70),
    clamp(address.street, 70),
    clamp(address.buildingNumber, 16),
    clamp(address.postalCode, 16),
    clamp(address.city, 35),
    clamp(address.country, 2).toUpperCase() || "CH",
  ];
}

/**
 * Baut den kompletten QR-Payload (Zeilen mit \n verbunden).
 * Wirft bei ungültiger IBAN/Referenz-Kombination — die Aufrufer (PDF-Route)
 * übersetzen das in eine verständliche Fehlermeldung.
 */
export function buildQrBillPayload(data: QrBillData): string {
  const iban = normalizeIban(data.iban);
  if (!isValidQrBillIban(iban)) {
    throw new Error("Ungültige IBAN für QR-Rechnung (nur CH/LI).");
  }
  if (!data.creditor.name || !data.creditor.postalCode || !data.creditor.city) {
    throw new Error("Gläubiger-Angaben unvollständig (Name, PLZ, Ort sind Pflicht).");
  }

  const reference = data.reference?.replace(/\s+/g, "") ?? "";
  if (data.referenceType === "QRR" && !isValidQrrReference(reference)) {
    throw new Error("Ungültige QRR-Referenz.");
  }
  if (data.referenceType === "SCOR" && !isValidScorReference(reference)) {
    throw new Error("Ungültige SCOR-Referenz.");
  }
  if (data.referenceType === "NON" && reference) {
    throw new Error("Referenztyp NON darf keine Referenz enthalten.");
  }

  if (data.amount != null && (data.amount < 0.01 || data.amount > 999_999_999.99)) {
    throw new Error("Betrag ausserhalb des zulässigen Bereichs (0.01–999999999.99).");
  }

  const lines: string[] = [
    // Header
    "SPC",
    "0200",
    "1",
    // Konto
    iban,
    // Gläubiger (strukturiert)
    ...addressLines(data.creditor),
    // Endgültiger Zahlungsempfänger — für künftige Nutzung, muss leer sein
    ...addressLines(null),
    // Betrag
    data.amount != null ? data.amount.toFixed(2) : "",
    data.currency,
    // Endgültiger Zahlungspflichtiger
    ...addressLines(data.debtor),
    // Referenz
    data.referenceType,
    reference,
    // Zusätzliche Informationen
    clamp(data.unstructuredMessage, 140),
    // Trailer
    "EPD",
  ];

  return lines.join("\n");
}

/**
 * «Musterstrasse 12a» → Strasse + Hausnummer für strukturierte Adressen.
 * Greift die Heuristik nicht, bleibt die Nummer leer (beide Felder optional).
 */
export function splitStreetAndNumber(raw: string | null): {
  street: string | null;
  buildingNumber: string | null;
} {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { street: null, buildingNumber: null };
  const match = trimmed.match(/^(.+?)[\s,]+(\d+\s*[a-zA-Z]?)$/);
  if (!match) return { street: trimmed, buildingNumber: null };
  return { street: match[1].trim(), buildingNumber: match[2].replace(/\s+/g, "") };
}
