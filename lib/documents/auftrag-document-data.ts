/**
 * Feld-Katalog + Datenbindung für Auftrags-Dokumentvorlagen (docxtemplater).
 *
 * Rein (kein I/O) → testbar. Erzeugt aus einem Projekt (dem «Auftrag») das flache
 * Datenobjekt, das eine Word-Vorlage über Platzhalter `{feld}` füllt. Anders als bei
 * der Offerte gibt es hier KEINE Preis-Positionen — ein Auftrag beschreibt Empfänger,
 * Objekt und die auszuführende Arbeit. Kein QR-/Compliance-Teil → `.docx`-Ausgabe ist
 * vollständig (siehe docs/PLAN-dokument-vorlagen.md).
 */

/** Datum-String (ISO oder YYYY-MM-DD) → TT.MM.JJJJ, ohne Zeitzonen-Verschiebung. */
function formatDateCh(value: string | null): string {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}.${m}.${y}`;
}

/** Projektdaten für die Auftragsvorlage (bewusst eigene Form, entkoppelt vom DB-Layout). */
export type AuftragProjectData = {
  title: string;
  referenceCode: string | null;
  createdAt: string | null;
  statusLabel: string | null;
  tenantName: string | null;
  tenantPhone: string | null;
  tenantEmail: string | null;
  managementName: string | null;
  managementPhone: string | null;
  managementEmail: string | null;
  serviceStreet: string | null;
  servicePostalCode: string | null;
  serviceCity: string | null;
  description: string | null;
  hintsAndNotes: string | null;
  accessNotes: string | null;
  costCeilingText: string | null;
};

export type AuftragDocumentInput = {
  companyName: string;
  project: AuftragProjectData;
};

export type AuftragDocumentData = {
  firma_name: string;
  auftrag_nummer: string;
  projekt_titel: string;
  datum: string;
  status: string;
  kunde_name: string;
  kunde_telefon: string;
  kunde_email: string;
  verwaltung_name: string;
  verwaltung_telefon: string;
  verwaltung_email: string;
  objekt_strasse: string;
  objekt_plz_ort: string;
  /** Objekt-Adresse kombiniert (Strasse, PLZ Ort) — viele Vorlagen haben ein Feld. */
  objekt: string;
  /** Zusatz-/c-o-Zeile im Empfängerblock (z. B. Verwaltung). */
  kunde_zusatz: string;
  referenz: string;
  beschreibung: string;
  hinweise: string;
  zugang: string;
  kostendach: string;
  // Felder ohne direkte Datenquelle — bewusst leer, in Vorlagen optional nutzbar.
  ansprechpartner: string;
  briefanrede: string;
  termin: string;
  monteur: string;
};

/** Katalog für die «Platzhalter-Referenz» in der UI (Feldname + Bedeutung + Beispiel). */
export const AUFTRAG_DOCUMENT_FIELDS: { key: keyof AuftragDocumentData; label: string; example: string }[] = [
  { key: "firma_name", label: "Firmenname (Absender)", example: "Bauflip Storen AG" },
  { key: "auftrag_nummer", label: "Auftrags-/Projekt-Nummer", example: "P-2026-014" },
  { key: "projekt_titel", label: "Auftrags-/Projekt-Titel", example: "Storenreparatur Balkon" },
  { key: "datum", label: "Datum", example: "20.07.2026" },
  { key: "status", label: "Status", example: "Abgemacht" },
  { key: "kunde_name", label: "Kunde/Mieter", example: "Familie Muster" },
  { key: "kunde_telefon", label: "Telefon Mieter", example: "044 123 45 67" },
  { key: "kunde_email", label: "E-Mail Mieter", example: "muster@example.ch" },
  { key: "verwaltung_name", label: "Verwaltung", example: "Muster Immobilien AG" },
  { key: "verwaltung_telefon", label: "Telefon Verwaltung", example: "044 987 65 43" },
  { key: "verwaltung_email", label: "E-Mail Verwaltung", example: "info@muster-immo.ch" },
  { key: "objekt_strasse", label: "Objekt Strasse", example: "Musterstrasse 12" },
  { key: "objekt_plz_ort", label: "Objekt PLZ/Ort", example: "8600 Dübendorf" },
  { key: "objekt", label: "Objekt (kombiniert)", example: "Musterstrasse 12, 8600 Dübendorf" },
  { key: "referenz", label: "Referenz", example: "P-2026-014" },
  { key: "beschreibung", label: "Auftragsbeschreibung", example: "Storen im Wohnzimmer klemmt …" },
  { key: "hinweise", label: "Wichtige Hinweise", example: "Hund im Haushalt" },
  { key: "zugang", label: "Zugang/Schlüssel", example: "Schlüssel bei Verwaltung" },
  { key: "kostendach", label: "Kostendach", example: "CHF 500" },
];

/** Beispiel-Datensatz — für die Vorlagen-Prüfung beim Upload (alle Felder belegt). */
export const SAMPLE_AUFTRAG_DOCUMENT_DATA: AuftragDocumentData = {
  firma_name: "Bauflip Storen AG",
  auftrag_nummer: "P-2026-014",
  projekt_titel: "Storenreparatur Balkon",
  datum: "20.07.2026",
  status: "Abgemacht",
  kunde_name: "Familie Muster",
  kunde_telefon: "044 123 45 67",
  kunde_email: "muster@example.ch",
  verwaltung_name: "Muster Immobilien AG",
  verwaltung_telefon: "044 987 65 43",
  verwaltung_email: "info@muster-immo.ch",
  objekt_strasse: "Musterstrasse 12",
  objekt_plz_ort: "8600 Dübendorf",
  objekt: "Musterstrasse 12, 8600 Dübendorf",
  kunde_zusatz: "c/o Muster Immobilien AG",
  referenz: "P-2026-014",
  beschreibung: "Storen im Wohnzimmer klemmt und lässt sich nicht mehr hochziehen.",
  hinweise: "Hund im Haushalt",
  zugang: "Schlüssel bei der Verwaltung abholen",
  kostendach: "CHF 500",
  ansprechpartner: "M. Muster",
  briefanrede: "Sehr geehrte Damen und Herren",
  termin: "24.07.2026, 08:00",
  monteur: "H. Meier",
};

/** Alle gültigen Platzhalter-Namen für die Upload-Prüfung. */
export const AUFTRAG_DOCUMENT_TOKEN_KEYS: readonly string[] = Object.keys(SAMPLE_AUFTRAG_DOCUMENT_DATA);

export function buildAuftragDocumentData(input: AuftragDocumentInput): AuftragDocumentData {
  const { companyName, project } = input;
  const plzOrt = [project.servicePostalCode, project.serviceCity].filter(Boolean).join(" ");

  return {
    firma_name: companyName,
    auftrag_nummer: project.referenceCode ?? "",
    projekt_titel: project.title,
    datum: formatDateCh(project.createdAt),
    status: project.statusLabel ?? "",
    kunde_name: project.tenantName ?? "",
    kunde_telefon: project.tenantPhone ?? "",
    kunde_email: project.tenantEmail ?? "",
    verwaltung_name: project.managementName ?? "",
    verwaltung_telefon: project.managementPhone ?? "",
    verwaltung_email: project.managementEmail ?? "",
    objekt_strasse: project.serviceStreet ?? "",
    objekt_plz_ort: plzOrt,
    objekt: [project.serviceStreet, plzOrt].filter(Boolean).join(", "),
    kunde_zusatz: "",
    referenz: project.referenceCode ?? "",
    beschreibung: project.description ?? "",
    hinweise: project.hintsAndNotes ?? "",
    zugang: project.accessNotes ?? "",
    kostendach: project.costCeilingText ?? "",
    ansprechpartner: "",
    briefanrede: "",
    termin: "",
    monteur: "",
  };
}
