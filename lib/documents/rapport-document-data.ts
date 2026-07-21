import type { AuftragProjectData } from "@/lib/documents/auftrag-document-data";

/**
 * Feld-Katalog + Datenbindung für Rapport-Dokumentvorlagen (docxtemplater).
 *
 * Rein (kein I/O) → testbar. Erzeugt aus einem Monteur-Rapport (+ Projekt) das flache
 * Datenobjekt für eine Word-Vorlage. Kein QR-/Compliance-Teil → `.docx`-Ausgabe ist
 * vollständig. Die Kundensignatur wird (v1) nur als Name/Flag ausgegeben, nicht als
 * Bild (Bild-Einbettung wäre eine spätere Ausbaustufe).
 */

/** Datum-String (ISO oder YYYY-MM-DD) → TT.MM.JJJJ, ohne Zeitzonen-Verschiebung. */
function formatDateCh(value: string | null): string {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}.${m}.${y}`;
}

/** Minuten → «1 h 30 min» / «45 min» / «2 h» / «». */
function formatDuration(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h} h ${m} min`;
  if (h > 0) return `${h} h`;
  return `${m} min`;
}

const OUTCOME_LABELS: Record<string, string> = {
  schaden_behoben: "Schaden behoben",
  schaden_aufgenommen: "Schaden aufgenommen",
};

export type RapportReportData = {
  createdAt: string | null;
  outcome: string;
  workDescription: string | null;
  summary: string | null;
  timeSpentMinutes: number | null;
  createdByDisplayName: string | null;
  signedByName: string | null;
  hasSignature: boolean;
};

export type RapportDocumentInput = {
  companyName: string;
  project: AuftragProjectData;
  report: RapportReportData;
};

export type RapportDocumentData = {
  firma_name: string;
  rapport_datum: string;
  auftrag_nummer: string;
  referenz: string;
  projekt_titel: string;
  kunde_name: string;
  verwaltung_name: string;
  objekt_strasse: string;
  objekt_plz_ort: string;
  objekt: string;
  monteur: string;
  ergebnis: string;
  arbeitsbeschreibung: string;
  zusammenfassung: string;
  zeit: string;
  unterschrift_name: string;
  /** «unterschrieben», wenn eine Kundensignatur vorliegt, sonst leer. */
  unterschrift: string;
};

/** Katalog für die «Platzhalter-Referenz» in der UI. */
export const RAPPORT_DOCUMENT_FIELDS: { key: keyof RapportDocumentData; label: string; example: string }[] = [
  { key: "firma_name", label: "Firmenname (Absender)", example: "Bauflip Storen AG" },
  { key: "rapport_datum", label: "Rapport-Datum", example: "24.07.2026" },
  { key: "auftrag_nummer", label: "Auftrags-/Projekt-Nummer", example: "P-2026-014" },
  { key: "projekt_titel", label: "Auftrags-/Projekt-Titel", example: "Storenreparatur Balkon" },
  { key: "kunde_name", label: "Kunde/Mieter", example: "Familie Muster" },
  { key: "verwaltung_name", label: "Verwaltung", example: "Muster Immobilien AG" },
  { key: "objekt", label: "Objekt (kombiniert)", example: "Musterstrasse 12, 8600 Dübendorf" },
  { key: "monteur", label: "Monteur", example: "H. Meier" },
  { key: "ergebnis", label: "Ergebnis", example: "Schaden behoben" },
  { key: "arbeitsbeschreibung", label: "Arbeit / Material", example: "Motor ersetzt, Storen justiert." },
  { key: "zusammenfassung", label: "Zusammenfassung", example: "Alles funktioniert wieder." },
  { key: "zeit", label: "Aufgewendete Zeit", example: "1 h 30 min" },
  { key: "unterschrift_name", label: "Unterzeichnet von", example: "R. Muster" },
];

/** Beispiel-Datensatz — für die Vorlagen-Prüfung beim Upload (alle Felder belegt). */
export const SAMPLE_RAPPORT_DOCUMENT_DATA: RapportDocumentData = {
  firma_name: "Bauflip Storen AG",
  rapport_datum: "24.07.2026",
  auftrag_nummer: "P-2026-014",
  referenz: "P-2026-014",
  projekt_titel: "Storenreparatur Balkon",
  kunde_name: "Familie Muster",
  verwaltung_name: "Muster Immobilien AG",
  objekt_strasse: "Musterstrasse 12",
  objekt_plz_ort: "8600 Dübendorf",
  objekt: "Musterstrasse 12, 8600 Dübendorf",
  monteur: "H. Meier",
  ergebnis: "Schaden behoben",
  arbeitsbeschreibung: "Storen-Motor ersetzt, Endlagen neu justiert.",
  zusammenfassung: "Storen läuft wieder einwandfrei.",
  zeit: "1 h 30 min",
  unterschrift_name: "R. Muster",
  unterschrift: "unterschrieben",
};

/** Alle gültigen Platzhalter-Namen für die Upload-Prüfung. */
export const RAPPORT_DOCUMENT_TOKEN_KEYS: readonly string[] = Object.keys(SAMPLE_RAPPORT_DOCUMENT_DATA);

export function buildRapportDocumentData(input: RapportDocumentInput): RapportDocumentData {
  const { companyName, project, report } = input;
  const plzOrt = [project.servicePostalCode, project.serviceCity].filter(Boolean).join(" ");

  return {
    firma_name: companyName,
    rapport_datum: formatDateCh(report.createdAt),
    auftrag_nummer: project.referenceCode ?? "",
    referenz: project.referenceCode ?? "",
    projekt_titel: project.title,
    kunde_name: project.tenantName ?? "",
    verwaltung_name: project.managementName ?? "",
    objekt_strasse: project.serviceStreet ?? "",
    objekt_plz_ort: plzOrt,
    objekt: [project.serviceStreet, plzOrt].filter(Boolean).join(", "),
    monteur: report.createdByDisplayName ?? "",
    ergebnis: OUTCOME_LABELS[report.outcome] ?? report.outcome ?? "",
    arbeitsbeschreibung: report.workDescription ?? "",
    zusammenfassung: report.summary ?? "",
    zeit: formatDuration(report.timeSpentMinutes),
    unterschrift_name: report.signedByName ?? "",
    unterschrift: report.hasSignature ? "unterschrieben" : "",
  };
}
