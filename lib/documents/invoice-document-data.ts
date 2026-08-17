import type { Invoice, Project } from "@/lib/domain/types";
import { formatPaymentReference } from "@/lib/qr-bill/reference";

/**
 * Feld-Katalog + Datenbindung für Rechnungs-Dokumentvorlagen (docxtemplater).
 * Rein (kein I/O) → testbar. Deckt den Brief-/Inhaltsteil ab; der Swiss-QR-Zahlteil
 * wird NICHT aus der Vorlage erzeugt, sondern programmatisch (compliant) angehängt
 * (siehe render-invoice-document.ts / docs/PLAN-dokument-vorlagen.md, D2).
 */

const chf = new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDateCh(value: string | null): string {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}.${m}.${y}`;
}

export type InvoiceDocumentInput = {
  companyName: string;
  invoice: Pick<
    Invoice,
    | "invoiceNumber"
    | "createdAt"
    | "dueDate"
    | "createdByDisplayName"
    | "introText"
    | "vatRate"
    | "totalNet"
    | "totalGross"
    | "referenceType"
    | "paymentReference"
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

export type InvoiceDocumentPosition = {
  pos: number;
  beschreibung: string;
  menge: string;
  einheit: string;
  menge_einheit: string;
  einzelpreis: string;
  zeilentotal: string;
};

export type InvoiceDocumentData = {
  firma_name: string;
  rechnung_nummer: string;
  projekt_titel: string;
  datum: string;
  faellig: string;
  ansprechpartner: string;
  kunde_name: string;
  verwaltung_name: string;
  objekt_strasse: string;
  objekt_plz_ort: string;
  objekt: string;
  kunde_zusatz: string;
  referenz: string;
  kopftext: string;
  positionen: InvoiceDocumentPosition[];
  total_netto: string;
  mwst_satz: string;
  mwst_betrag: string;
  total_brutto: string;
};

/** Beispiel-Datensatz — für die Vorlagen-Prüfung beim Upload (alle Felder belegt). */
export const SAMPLE_INVOICE_DOCUMENT_DATA: InvoiceDocumentData = {
  firma_name: "Bauflip Storen AG",
  rechnung_nummer: "RE-2026-014",
  projekt_titel: "Storenreparatur Balkon",
  datum: "13.07.2026",
  faellig: "12.08.2026",
  ansprechpartner: "M. Muster",
  kunde_name: "Familie Muster",
  verwaltung_name: "Muster Immobilien AG",
  objekt_strasse: "Musterstrasse 12",
  objekt_plz_ort: "8600 Dübendorf",
  objekt: "Musterstrasse 12, 8600 Dübendorf",
  kunde_zusatz: "c/o Muster Immobilien AG",
  referenz: "P-2026-014",
  kopftext: "Für die ausgeführten Arbeiten stellen wir Ihnen wie folgt Rechnung.",
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
};

/** Alle gültigen Platzhalter-Namen für die Upload-Prüfung. */
export const INVOICE_DOCUMENT_TOKEN_KEYS: readonly string[] = [
  ...Object.keys(SAMPLE_INVOICE_DOCUMENT_DATA),
  ...Object.keys(SAMPLE_INVOICE_DOCUMENT_DATA.positionen[0]!),
];

/** Katalog für die «Platzhalter-Referenz» in der UI (Feldname + Bedeutung + Beispiel). */
export const INVOICE_DOCUMENT_FIELDS: { key: keyof InvoiceDocumentData; label: string; example: string }[] = [
  { key: "firma_name", label: "Firmenname (Absender)", example: "Bauflip Storen AG" },
  { key: "rechnung_nummer", label: "Rechnungsnummer", example: "RE-2026-014" },
  { key: "projekt_titel", label: "Projekt-Titel", example: "Storenreparatur Balkon" },
  { key: "datum", label: "Rechnungsdatum", example: "13.07.2026" },
  { key: "faellig", label: "Fällig am", example: "12.08.2026" },
  { key: "ansprechpartner", label: "Ansprechpartner", example: "M. Muster" },
  { key: "kunde_name", label: "Kunde/Mieter", example: "Familie Muster" },
  { key: "verwaltung_name", label: "Verwaltung", example: "Muster Immobilien AG" },
  { key: "objekt_strasse", label: "Objekt Strasse", example: "Musterstrasse 12" },
  { key: "objekt_plz_ort", label: "Objekt PLZ/Ort", example: "8600 Dübendorf" },
  { key: "objekt", label: "Objekt (kombiniert)", example: "Musterstrasse 12, 8600 Dübendorf" },
  { key: "referenz", label: "Referenz", example: "P-2026-014" },
  { key: "kopftext", label: "Einleitungstext", example: "Für die ausgeführten Arbeiten …" },
  { key: "total_netto", label: "Total netto", example: "420.00" },
  { key: "mwst_satz", label: "MwSt.-Satz", example: "8.1%" },
  { key: "mwst_betrag", label: "MwSt.-Betrag", example: "34.02" },
  { key: "total_brutto", label: "Total brutto", example: "454.02" },
];

export function buildInvoiceDocumentData(input: InvoiceDocumentInput): InvoiceDocumentData {
  const { companyName, invoice, project } = input;
  const positionen: InvoiceDocumentPosition[] = invoice.lineItems
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

  return {
    firma_name: companyName,
    rechnung_nummer: invoice.invoiceNumber ?? "",
    projekt_titel: project.title,
    datum: formatDateCh(invoice.createdAt),
    faellig: formatDateCh(invoice.dueDate),
    ansprechpartner: invoice.createdByDisplayName ?? "",
    kunde_name: project.tenantName ?? "",
    verwaltung_name: project.managementName ?? "",
    objekt_strasse: project.serviceStreet ?? "",
    objekt_plz_ort: plzOrt,
    objekt: [project.serviceStreet, plzOrt].filter(Boolean).join(", "),
    kunde_zusatz: "",
    referenz: formatPaymentReference(invoice.referenceType, invoice.paymentReference),
    kopftext: invoice.introText ?? "",
    positionen,
    total_netto: chf.format(invoice.totalNet),
    mwst_satz: `${invoice.vatRate}%`,
    mwst_betrag: chf.format(invoice.totalGross - invoice.totalNet),
    total_brutto: chf.format(invoice.totalGross),
  };
}
