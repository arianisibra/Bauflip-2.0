/**
 * Zahlungsreferenzen für die Schweizer QR-Rechnung — pure functions.
 *
 * - QR-IBAN → **QRR**: 27 Ziffern, letzte Stelle Mod-10-rekursiv-Prüfziffer
 *   (identisch zur alten ESR-Referenz).
 * - Normale IBAN → **SCOR**: ISO-11649 Creditor Reference («RF» + 2 Prüfziffern
 *   + max. 21 alphanumerische Zeichen), Prüfung per Mod-97 wie bei IBANs.
 *
 * Der Referenztyp wird bei Rechnungserstellung aus der Org-IBAN abgeleitet und
 * auf der Rechnung eingefroren (Referenzen dürfen sich nie mehr ändern).
 */

import type { InvoiceReferenceType } from "@/lib/domain/types";
import { isQrIban, isValidQrBillIban } from "@/lib/qr-bill/iban";

// ─── QRR (Mod-10 rekursiv) ───────────────────────────────────────────────────

const MOD10_CARRY_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5] as const;

/** Mod-10-rekursiv-Prüfziffer über eine Ziffernfolge (ESR/QRR-Verfahren). */
export function mod10RecursiveCheckDigit(digits: string): number {
  let carry = 0;
  for (const char of digits) {
    const digit = char.charCodeAt(0) - 48;
    if (digit < 0 || digit > 9) throw new Error("QRR-Referenz darf nur Ziffern enthalten.");
    carry = MOD10_CARRY_TABLE[(carry + digit) % 10];
  }
  return (10 - carry) % 10;
}

/**
 * 27-stellige QRR-Referenz aus Jahr + Sequenz der Rechnungsnummer
 * (z. B. RE-2026-1001 → …002026000000000000000001001 + Prüfziffer).
 * Struktur der 26 Nutzstellen ist frei — wir halten sie deterministisch
 * aus der Rechnungsnummer ableitbar.
 */
export function buildQrrReference(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error("Ungültiges Jahr für QRR-Referenz.");
  }
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 999_999_999) {
    throw new Error("Ungültige Sequenz für QRR-Referenz.");
  }
  const base = (String(year) + String(sequence).padStart(9, "0")).padStart(26, "0");
  return base + String(mod10RecursiveCheckDigit(base));
}

export function isValidQrrReference(raw: string): boolean {
  const ref = raw.replace(/\s+/g, "");
  if (!/^\d{27}$/.test(ref)) return false;
  return mod10RecursiveCheckDigit(ref.slice(0, 26)) === Number(ref[26]);
}

// ─── SCOR (ISO 11649, Mod-97) ────────────────────────────────────────────────

/** Buchstaben→Zahlen (A=10…Z=35), inkrementelles Mod-97 (wie IBAN). */
function mod97(input: string): number {
  let remainder = 0;
  for (const char of input) {
    if (char >= "0" && char <= "9") {
      remainder = (remainder * 10 + (char.charCodeAt(0) - 48)) % 97;
    } else if (char >= "A" && char <= "Z") {
      remainder = (remainder * 100 + (char.charCodeAt(0) - 55)) % 97;
    } else {
      throw new Error("SCOR-Referenz darf nur A–Z und Ziffern enthalten.");
    }
  }
  return remainder;
}

/**
 * ISO-11649-Referenz «RFcc…» aus einem alphanumerischen Kern (max. 21 Zeichen),
 * z. B. Rechnungsnummer ohne Bindestriche: RE20261001 → RFxxRE20261001.
 */
export function buildScorReference(core: string): string {
  const cleaned = core.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (cleaned.length === 0 || cleaned.length > 21) {
    throw new Error("SCOR-Kern muss 1–21 alphanumerische Zeichen haben.");
  }
  const checkDigits = String(98 - mod97(cleaned + "RF00")).padStart(2, "0");
  return `RF${checkDigits}${cleaned}`;
}

export function isValidScorReference(raw: string): boolean {
  const ref = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^RF\d{2}[0-9A-Z]{1,21}$/.test(ref)) return false;
  try {
    return mod97(ref.slice(4) + ref.slice(0, 4)) === 1;
  } catch {
    return false;
  }
}

// ─── Typ-Wahl aus der IBAN ───────────────────────────────────────────────────

/** QR-IBAN → QRR (Pflicht), gültige normale IBAN → SCOR, keine/ungültige IBAN → NON. */
export function chooseReferenceType(iban: string | null): InvoiceReferenceType {
  if (!iban || !isValidQrBillIban(iban)) return "NON";
  return isQrIban(iban) ? "QRR" : "SCOR";
}

/** Anzeige-Format: QRR in 5er-Blöcken von rechts, SCOR in 4er-Blöcken. */
export function formatPaymentReference(type: InvoiceReferenceType, reference: string | null): string {
  if (!reference) return "";
  if (type === "QRR") {
    // 2 + 5×5: 21 00000 00003 13947 14300 09017
    const r = reference.replace(/\s+/g, "");
    return `${r.slice(0, 2)} ${r.slice(2).replace(/(\d{5})/g, "$1 ").trim()}`;
  }
  return reference.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}
