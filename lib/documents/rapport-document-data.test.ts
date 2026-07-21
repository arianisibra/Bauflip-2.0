import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRapportDocumentData,
  RAPPORT_DOCUMENT_TOKEN_KEYS,
  SAMPLE_RAPPORT_DOCUMENT_DATA,
  type RapportDocumentInput,
} from "./rapport-document-data";

function sampleInput(): RapportDocumentInput {
  return {
    companyName: "Bauflip Storen AG",
    project: {
      title: "Storenreparatur Balkon",
      referenceCode: "P-2026-014",
      createdAt: "2026-07-20T09:30:00.000Z",
      statusLabel: "Abgeschlossen",
      tenantName: "Familie Muster",
      tenantPhone: null,
      tenantEmail: null,
      managementName: "Muster Immobilien AG",
      managementPhone: null,
      managementEmail: null,
      serviceStreet: "Musterstrasse 12",
      servicePostalCode: "8600",
      serviceCity: "Dübendorf",
      description: null,
      hintsAndNotes: null,
      accessNotes: null,
      costCeilingText: null,
    },
    report: {
      createdAt: "2026-07-24T13:15:00.000Z",
      outcome: "schaden_behoben",
      workDescription: "Motor ersetzt, Endlagen justiert.",
      summary: "Läuft wieder.",
      timeSpentMinutes: 90,
      createdByDisplayName: "H. Meier",
      signedByName: "R. Muster",
      hasSignature: true,
    },
  };
}

test("bildet Rapport-/Projektfelder korrekt ab", () => {
  const d = buildRapportDocumentData(sampleInput());
  assert.equal(d.firma_name, "Bauflip Storen AG");
  assert.equal(d.auftrag_nummer, "P-2026-014");
  assert.equal(d.projekt_titel, "Storenreparatur Balkon");
  assert.equal(d.kunde_name, "Familie Muster");
  assert.equal(d.objekt, "Musterstrasse 12, 8600 Dübendorf");
  assert.equal(d.monteur, "H. Meier");
  assert.equal(d.arbeitsbeschreibung, "Motor ersetzt, Endlagen justiert.");
});

test("übersetzt Ergebnis und formatiert Datum/Zeit", () => {
  const d = buildRapportDocumentData(sampleInput());
  assert.equal(d.ergebnis, "Schaden behoben");
  assert.equal(d.rapport_datum, "24.07.2026");
  assert.equal(d.zeit, "1 h 30 min");
});

test("Signatur: Name + Flag korrekt", () => {
  const d = buildRapportDocumentData(sampleInput());
  assert.equal(d.unterschrift_name, "R. Muster");
  assert.equal(d.unterschrift, "unterschrieben");
});

test("ohne Signatur bleibt das Flag leer", () => {
  const input = sampleInput();
  input.report.hasSignature = false;
  input.report.signedByName = null;
  const d = buildRapportDocumentData(input);
  assert.equal(d.unterschrift, "");
  assert.equal(d.unterschrift_name, "");
});

test("Zeit-Formatierung: Sonderfälle", () => {
  const mk = (min: number | null) => {
    const i = sampleInput();
    i.report.timeSpentMinutes = min;
    return buildRapportDocumentData(i).zeit;
  };
  assert.equal(mk(45), "45 min");
  assert.equal(mk(120), "2 h");
  assert.equal(mk(0), "");
  assert.equal(mk(null), "");
});

test("unbekanntes Ergebnis wird unverändert durchgereicht", () => {
  const input = sampleInput();
  input.report.outcome = "irgendwas";
  assert.equal(buildRapportDocumentData(input).ergebnis, "irgendwas");
});

test("Token-Katalog deckt alle Datenfelder ab", () => {
  assert.deepEqual([...RAPPORT_DOCUMENT_TOKEN_KEYS].sort(), Object.keys(SAMPLE_RAPPORT_DOCUMENT_DATA).sort());
});
