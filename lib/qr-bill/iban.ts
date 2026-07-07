/**
 * IBAN-Validierung für die Schweizer QR-Rechnung — pure functions,
 * client- und servertauglich (Zod-Refines, Einstellungs-Formular, PDF-Erzeugung).
 *
 * QR-Rechnungen erlauben nur CH-/LI-IBANs (21 Zeichen). Der Referenztyp hängt
 * an der Instituts-ID (IID, Stellen 5–9): 30000–31999 = QR-IBAN → Referenz QRR,
 * sonst normale IBAN → SCOR/NON.
 */

/** Leerzeichen entfernen, Grossschreibung — kanonische Form für Speicherung/Prüfung. */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** ISO-13616-Prüfsumme: Umstellung + Buchstaben→Zahlen, Rest mod 97 muss 1 sein. */
function ibanChecksumIsValid(normalized: string): boolean {
  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    if (char >= "0" && char <= "9") {
      remainder = (remainder * 10 + (char.charCodeAt(0) - 48)) % 97;
    } else if (char >= "A" && char <= "Z") {
      // Buchstabe = zwei Ziffern (A=10 … Z=35)
      remainder = (remainder * 100 + (char.charCodeAt(0) - 55)) % 97;
    } else {
      return false;
    }
  }
  return remainder === 1;
}

/** Gültige CH-/LI-IBAN (21 Zeichen, korrekte Prüfsumme) — Voraussetzung für QR-Rechnungen. */
export function isValidQrBillIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^(CH|LI)\d{2}[0-9A-Z]{17}$/.test(iban)) return false;
  return ibanChecksumIsValid(iban);
}

/** QR-IBAN: IID (Stellen 5–9) im reservierten Bereich 30000–31999. */
export function isQrIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!isValidQrBillIban(iban)) return false;
  const iid = Number(iban.slice(4, 9));
  return iid >= 30000 && iid <= 31999;
}

/** Anzeige-Format in Vierergruppen: CH93 0076 2011 6238 5295 7 */
export function formatIban(raw: string): string {
  const iban = normalizeIban(raw);
  return iban.replace(/(.{4})/g, "$1 ").trim();
}
