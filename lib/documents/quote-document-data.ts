import type { Quote, Project } from "@/lib/domain/types";

/**
 * Feld-Katalog + Datenbindung für Offert-Dokumentvorlagen (docxtemplater).
 *
 * Rein (kein I/O) → testbar. Erzeugt aus einer Offerte + ihrem Projekt das flache
 * Datenobjekt, das eine Word-Vorlage über Platzhalter `{feld}` bzw. die
 * Positions-Schleife `{#positionen}…{/positionen}` füllt.
 *
 * Kundenvorlagen (z. B. Carbone-`{d.Angebotsnummer}`) werden beim Onboarding auf
 * diese kanonischen, stabilen Feldnamen konvertiert — nicht umgekehrt. So bleibt
 * der Katalog entkoppelt von der Eigenart einer einzelnen Kundenvorlage.
 */

const chf = new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Datum-String (ISO oder YYYY-MM-DD) → TT.MM.JJJJ, ohne Zeitzonen-Verschiebung. */
function formatDateCh(value: string | null): string {
  if (!value) return "";
  const datePart = value.slice(0, 10);
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return "";
  return `${d}.${m}.${y}`;
}

export type QuoteDocumentInput = {
  companyName: string;
  /** Absenderadresse aus den Zahlungsdaten (QR-Rechnung) — dieselbe Quelle wie das Rechnungs-PDF. */
  billing?: {
    creditorStreet: string | null;
    creditorBuildingNumber: string | null;
    creditorPostalCode: string | null;
    creditorCity: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  quote: Pick<
    Quote,
    | "quoteNumber"
    | "createdAt"
    | "validUntil"
    | "createdByDisplayName"
    | "introText"
    | "outroText"
    | "vatRate"
    | "totalNet"
    | "totalGross"
    | "lineItems"
  >;
  project: Pick<
    Project,
    | "title"
    | "tenantName"
    | "managementName"
    | "serviceStreet"
    | "servicePostalCode"
    | "serviceCity"
    | "referenceCode"
  >;
};

export type QuoteDocumentPosition = {
  pos: number;
  beschreibung: string;
  menge: string;
  einheit: string;
  /** Menge + Einheit kombiniert (z. B. «2 h») — viele Vorlagen haben nur eine Spalte. */
  menge_einheit: string;
  einzelpreis: string;
  zeilentotal: string;
};

export type QuoteDocumentData = {
  firma_name: string;
  firma_strasse: string;
  firma_plz_ort: string;
  /** Firmenadresse kombiniert (Strasse, PLZ Ort) — viele Vorlagen haben ein Feld. */
  firma_adresse: string;
  firma_telefon: string;
  firma_email: string;
  offerte_nummer: string;
  projekt_titel: string;
  datum: string;
  gueltig_bis: string;
  ansprechpartner: string;
  kunde_name: string;
  verwaltung_name: string;
  objekt_strasse: string;
  objekt_plz_ort: string;
  /** Objekt-Adresse kombiniert (Strasse, PLZ Ort) — viele Vorlagen haben ein Feld. */
  objekt: string;
  /** Zusatz-/c-o-Zeile im Empfängerblock (z. B. Verwaltung). */
  kunde_zusatz: string;
  referenz: string;
  kopftext: string;
  fusstext: string;
  positionen: QuoteDocumentPosition[];
  total_netto: string;
  mwst_satz: string;
  mwst_betrag: string;
  total_brutto: string;
  // Felder ohne Datenquelle in Bauflip — bewusst leer, in Vorlagen optional nutzbar.
  kundennummer: string;
  lieferfrist: string;
  eigentuemer: string;
  briefanrede: string;
  rabatt: string;
  rabatt_text: string;
  rabatt_betrag: string;
};

/** Katalog für die «Platzhalter-Referenz» in der UI (Feldname + Bedeutung + Beispiel). */
export const QUOTE_DOCUMENT_FIELDS: { key: keyof QuoteDocumentData; label: string; example: string }[] = [
  { key: "firma_name", label: "Firmenname (Absender)", example: "Bauflip Storen AG" },
  { key: "firma_strasse", label: "Firma Strasse", example: "Musterweg 3" },
  { key: "firma_plz_ort", label: "Firma PLZ/Ort", example: "8000 Zürich" },
  { key: "firma_adresse", label: "Firma Adresse (kombiniert)", example: "Musterweg 3, 8000 Zürich" },
  { key: "firma_telefon", label: "Firma Telefon", example: "044 123 45 67" },
  { key: "firma_email", label: "Firma E-Mail", example: "info@bauflip-storen.ch" },
  { key: "offerte_nummer", label: "Offert-Nummer", example: "OF-2026-014" },
  { key: "projekt_titel", label: "Projekt-/Offert-Titel", example: "Storenreparatur Balkon" },
  { key: "datum", label: "Offert-Datum", example: "13.07.2026" },
  { key: "gueltig_bis", label: "Gültig bis", example: "12.08.2026" },
  { key: "ansprechpartner", label: "Ansprechpartner", example: "M. Muster" },
  { key: "kunde_name", label: "Kunde/Mieter", example: "Familie Muster" },
  { key: "verwaltung_name", label: "Verwaltung", example: "Muster Immobilien AG" },
  { key: "objekt_strasse", label: "Objekt Strasse", example: "Musterstrasse 12" },
  { key: "objekt_plz_ort", label: "Objekt PLZ/Ort", example: "8600 Dübendorf" },
  { key: "referenz", label: "Referenz", example: "P-2026-014" },
  { key: "kopftext", label: "Einleitungstext", example: "Besten Dank für Ihre Anfrage …" },
  { key: "fusstext", label: "Schlusstext", example: "Wir freuen uns auf Ihren Auftrag." },
  { key: "total_netto", label: "Zwischentotal netto", example: "610.00" },
  { key: "mwst_satz", label: "MwSt-Satz", example: "8.1%" },
  { key: "mwst_betrag", label: "MwSt-Betrag", example: "49.40" },
  { key: "total_brutto", label: "Gesamtbetrag inkl. MwSt", example: "659.40" },
];

/** Beispiel-Datensatz — für die Vorlagen-Prüfung beim Upload (alle Felder belegt). */
export const SAMPLE_QUOTE_DOCUMENT_DATA: QuoteDocumentData = {
  firma_name: "Bauflip Storen AG",
  firma_strasse: "Musterweg 3",
  firma_plz_ort: "8000 Zürich",
  firma_adresse: "Musterweg 3, 8000 Zürich",
  firma_telefon: "044 123 45 67",
  firma_email: "info@bauflip-storen.ch",
  offerte_nummer: "OF-2026-014",
  projekt_titel: "Storenreparatur Balkon",
  datum: "13.07.2026",
  gueltig_bis: "12.08.2026",
  ansprechpartner: "M. Muster",
  kunde_name: "Familie Muster",
  verwaltung_name: "Muster Immobilien AG",
  objekt_strasse: "Musterstrasse 12",
  objekt_plz_ort: "8600 Dübendorf",
  objekt: "Musterstrasse 12, 8600 Dübendorf",
  kunde_zusatz: "c/o Muster Immobilien AG",
  referenz: "P-2026-014",
  kopftext: "Besten Dank für Ihre Anfrage.",
  fusstext: "Wir freuen uns auf Ihren Auftrag.",
  positionen: [
    {
      pos: 1,
      beschreibung: "Storen-Motor ersetzen",
      menge: "1",
      einheit: "Stk",
      menge_einheit: "1 Stk",
      einzelpreis: "420.00",
      zeilentotal: "420.00",
    },
  ],
  total_netto: "420.00",
  mwst_satz: "8.1%",
  mwst_betrag: "34.02",
  total_brutto: "454.02",
  kundennummer: "K-1024",
  lieferfrist: "2 Wochen",
  eigentuemer: "Muster Immobilien AG",
  briefanrede: "Sehr geehrte Damen und Herren",
  rabatt: "5%",
  rabatt_text: "Rabatt",
  rabatt_betrag: "21.00",
};

/** Alle gültigen Platzhalter-Namen (Top-Level + Positions-Felder) für die Upload-Prüfung. */
export const QUOTE_DOCUMENT_TOKEN_KEYS: readonly string[] = [
  ...Object.keys(SAMPLE_QUOTE_DOCUMENT_DATA),
  ...Object.keys(SAMPLE_QUOTE_DOCUMENT_DATA.positionen[0]!),
];

export function buildQuoteDocumentData(input: QuoteDocumentInput): QuoteDocumentData {
  const { companyName, billing, quote, project } = input;
  const positionen: QuoteDocumentPosition[] = quote.lineItems
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((li) => ({
      pos: li.position,
      beschreibung: li.description,
      menge: String(li.quantity),
      einheit: li.unit ?? "",
      menge_einheit: `${li.quantity}${li.unit ? ` ${li.unit}` : ""}`,
      einzelpreis: chf.format(li.unitPrice),
      zeilentotal: chf.format(li.lineTotal),
    }));

  const plzOrt = [project.servicePostalCode, project.serviceCity].filter(Boolean).join(" ");
  const firmaStrasse = [billing?.creditorStreet, billing?.creditorBuildingNumber].filter(Boolean).join(" ");
  const firmaPlzOrt = [billing?.creditorPostalCode, billing?.creditorCity].filter(Boolean).join(" ");

  return {
    firma_name: companyName,
    firma_strasse: firmaStrasse,
    firma_plz_ort: firmaPlzOrt,
    firma_adresse: [firmaStrasse, firmaPlzOrt].filter(Boolean).join(", "),
    firma_telefon: billing?.phone ?? "",
    firma_email: billing?.email ?? "",
    offerte_nummer: quote.quoteNumber ?? "",
    projekt_titel: project.title,
    datum: formatDateCh(quote.createdAt),
    gueltig_bis: formatDateCh(quote.validUntil),
    ansprechpartner: quote.createdByDisplayName ?? "",
    kunde_name: project.tenantName ?? "",
    verwaltung_name: project.managementName ?? "",
    objekt_strasse: project.serviceStreet ?? "",
    objekt_plz_ort: plzOrt,
    objekt: [project.serviceStreet, plzOrt].filter(Boolean).join(", "),
    kunde_zusatz: "",
    referenz: project.referenceCode ?? "",
    kopftext: quote.introText ?? "",
    fusstext: quote.outroText ?? "",
    positionen,
    total_netto: chf.format(quote.totalNet),
    mwst_satz: `${quote.vatRate}%`,
    mwst_betrag: chf.format(quote.totalGross - quote.totalNet),
    total_brutto: chf.format(quote.totalGross),
    kundennummer: "",
    lieferfrist: "",
    eigentuemer: project.managementName ?? "",
    briefanrede: "",
    rabatt: "",
    rabatt_text: "",
    rabatt_betrag: "",
  };
}
