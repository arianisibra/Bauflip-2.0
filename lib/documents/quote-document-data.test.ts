import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQuoteDocumentData, type QuoteDocumentInput } from "./quote-document-data";

function sampleInput(): QuoteDocumentInput {
  return {
    companyName: "Bauflip Storen AG",
    quote: {
      quoteNumber: "OF-2026-014",
      createdAt: "2026-07-13T09:30:00.000Z",
      validUntil: "2026-08-12",
      createdByDisplayName: "M. Muster",
      introText: "Besten Dank für Ihre Anfrage.",
      outroText: "Wir freuen uns auf Ihren Auftrag.",
      vatRate: 8.1,
      totalNet: 610,
      totalGross: 659.4,
      lineItems: [
        { id: "b", quoteId: "q", position: 2, itemType: "line", description: "Arbeitszeit Monteur", quantity: 2, unit: "h", unitPrice: 95, lineTotal: 190 },
        { id: "a", quoteId: "q", position: 1, itemType: "line", description: "Storen-Motor ersetzen", quantity: 1, unit: "Stk", unitPrice: 420, lineTotal: 420 },
      ],
    },
    project: {
      title: "Storenreparatur Balkon",
      tenantName: "Familie Muster",
      managementName: "Muster Immobilien AG",
      serviceStreet: "Musterstrasse 12",
      servicePostalCode: "8600",
      serviceCity: "Dübendorf",
      referenceCode: "P-2026-014",
    },
  };
}

test("bildet Kopf-/Kundenfelder korrekt ab", () => {
  const d = buildQuoteDocumentData(sampleInput());
  assert.equal(d.firma_name, "Bauflip Storen AG");
  assert.equal(d.offerte_nummer, "OF-2026-014");
  assert.equal(d.projekt_titel, "Storenreparatur Balkon");
  assert.equal(d.kunde_name, "Familie Muster");
  assert.equal(d.objekt_strasse, "Musterstrasse 12");
  assert.equal(d.objekt_plz_ort, "8600 Dübendorf");
  assert.equal(d.referenz, "P-2026-014");
});

test("formatiert Datum als TT.MM.JJJJ ohne Zeitzonen-Verschiebung", () => {
  const d = buildQuoteDocumentData(sampleInput());
  assert.equal(d.datum, "13.07.2026");
  assert.equal(d.gueltig_bis, "12.08.2026");
});

test("Positionen werden nach Position sortiert und formatiert", () => {
  const d = buildQuoteDocumentData(sampleInput());
  assert.equal(d.positionen.length, 2);
  assert.equal(d.positionen[0].pos, 1);
  assert.equal(d.positionen[0].beschreibung, "Storen-Motor ersetzen");
  assert.equal(d.positionen[0].menge_einheit, "1 Stk");
  assert.equal(d.positionen[0].einzelpreis, "420.00");
  assert.equal(d.positionen[1].menge_einheit, "2 h");
});

test("Summen und MwSt werden korrekt berechnet/formatiert", () => {
  const d = buildQuoteDocumentData(sampleInput());
  assert.equal(d.total_netto, "610.00");
  assert.equal(d.mwst_satz, "8.1%");
  assert.equal(d.mwst_betrag, "49.40");
  assert.equal(d.total_brutto, "659.40");
});

test("fehlende Felder ohne Datenquelle bleiben leer", () => {
  const d = buildQuoteDocumentData(sampleInput());
  assert.equal(d.kundennummer, "");
  assert.equal(d.lieferfrist, "");
  assert.equal(d.briefanrede, "");
  assert.equal(d.rabatt, "");
});
