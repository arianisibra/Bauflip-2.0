import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUFTRAG_DOCUMENT_TOKEN_KEYS,
  buildAuftragDocumentData,
  SAMPLE_AUFTRAG_DOCUMENT_DATA,
  type AuftragDocumentInput,
} from "./auftrag-document-data";

function sampleInput(): AuftragDocumentInput {
  return {
    companyName: "Bauflip Storen AG",
    project: {
      title: "Storenreparatur Balkon",
      referenceCode: "P-2026-014",
      createdAt: "2026-07-20T09:30:00.000Z",
      statusLabel: "Abgemacht",
      tenantName: "Familie Muster",
      tenantPhone: "044 123 45 67",
      tenantEmail: "muster@example.ch",
      managementName: "Muster Immobilien AG",
      managementPhone: "044 987 65 43",
      managementEmail: "info@muster-immo.ch",
      serviceStreet: "Musterstrasse 12",
      servicePostalCode: "8600",
      serviceCity: "Dübendorf",
      description: "Storen im Wohnzimmer klemmt.",
      hintsAndNotes: "Hund im Haushalt",
      accessNotes: "Schlüssel bei der Verwaltung",
      costCeilingText: "CHF 500",
    },
  };
}

test("bildet Kopf-/Empfängerfelder korrekt ab", () => {
  const d = buildAuftragDocumentData(sampleInput());
  assert.equal(d.firma_name, "Bauflip Storen AG");
  assert.equal(d.auftrag_nummer, "P-2026-014");
  assert.equal(d.referenz, "P-2026-014");
  assert.equal(d.projekt_titel, "Storenreparatur Balkon");
  assert.equal(d.status, "Abgemacht");
  assert.equal(d.kunde_name, "Familie Muster");
  assert.equal(d.kunde_telefon, "044 123 45 67");
  assert.equal(d.verwaltung_name, "Muster Immobilien AG");
});

test("kombiniert Objekt-Adresse und formatiert Datum ohne Zeitzonen-Verschiebung", () => {
  const d = buildAuftragDocumentData(sampleInput());
  assert.equal(d.objekt_plz_ort, "8600 Dübendorf");
  assert.equal(d.objekt, "Musterstrasse 12, 8600 Dübendorf");
  assert.equal(d.datum, "20.07.2026");
});

test("überträgt Beschreibung, Hinweise, Zugang, Kostendach", () => {
  const d = buildAuftragDocumentData(sampleInput());
  assert.equal(d.beschreibung, "Storen im Wohnzimmer klemmt.");
  assert.equal(d.hinweise, "Hund im Haushalt");
  assert.equal(d.zugang, "Schlüssel bei der Verwaltung");
  assert.equal(d.kostendach, "CHF 500");
});

test("Felder ohne Datenquelle bleiben leer", () => {
  const d = buildAuftragDocumentData(sampleInput());
  assert.equal(d.ansprechpartner, "");
  assert.equal(d.briefanrede, "");
  assert.equal(d.termin, "");
  assert.equal(d.monteur, "");
});

test("leere/fehlende Werte werden zu leeren Strings (kein «null»/«undefined»)", () => {
  const input = sampleInput();
  input.project.tenantName = null;
  input.project.referenceCode = null;
  input.project.createdAt = null;
  const d = buildAuftragDocumentData(input);
  assert.equal(d.kunde_name, "");
  assert.equal(d.auftrag_nummer, "");
  assert.equal(d.datum, "");
});

test("Token-Katalog deckt alle Datenfelder ab", () => {
  const dataKeys = Object.keys(SAMPLE_AUFTRAG_DOCUMENT_DATA).sort();
  const tokenKeys = [...AUFTRAG_DOCUMENT_TOKEN_KEYS].sort();
  assert.deepEqual(tokenKeys, dataKeys);
});
