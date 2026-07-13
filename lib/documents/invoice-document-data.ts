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
