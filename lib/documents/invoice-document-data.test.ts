import assert from "node:assert/strict";
import { test } from "node:test";
import { buildInvoiceDocumentData, type InvoiceDocumentInput } from "./invoice-document-data";

function sampleInput(): InvoiceDocumentInput {
  return {
    companyName: "Bauflip Storen AG",
    invoice: {
      invoiceNumber: "RE-2026-007",
      createdAt: "2026-07-13T09:30:00.000Z",
      dueDate: "2026-08-12",
      createdByDisplayName: "M. Muster",
      introText: "Für unsere Leistungen erlauben wir uns zu verrechnen:",
      vatRate: 8.1,
      totalNet: 610,
      totalGross: 659.4,
      referenceType: "QRR",
      paymentReference: "210000000003139471430009017",
      lineItems: [
        { id: "b", invoiceId: "i", position: 2, description: "Arbeitszeit Monteur", quantity: 2, unit: "h", unitPrice: 95, lineTotal: 190 },
        { id: "a", invoiceId: "i", position: 1, description: "Storen-Motor ersetzt", quantity: 1, unit: "Stk", unitPrice: 420, lineTotal: 420 },
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

test("bildet Rechnungs-Kopffelder ab", () => {
  const d = buildInvoiceDocumentData(sampleInput());
  assert.equal(d.rechnung_nummer, "RE-2026-007");
  assert.equal(d.datum, "13.07.2026");
  assert.equal(d.faellig, "12.08.2026");
  assert.equal(d.kunde_name, "Familie Muster");
  assert.equal(d.objekt, "Musterstrasse 12, 8600 Dübendorf");
});

test("formatiert die QR-Referenz lesbar", () => {
  const d = buildInvoiceDocumentData(sampleInput());
  // QRR wird in 2+5×5-Blöcke gruppiert (formatPaymentReference).
  assert.match(d.referenz, /\d{2}( \d{5})+/);
});

test("Positionen sortiert + Summen korrekt", () => {
  const d = buildInvoiceDocumentData(sampleInput());
  assert.equal(d.positionen[0].pos, 1);
  assert.equal(d.positionen[0].beschreibung, "Storen-Motor ersetzt");
  assert.equal(d.total_netto, "610.00");
  assert.equal(d.mwst_betrag, "49.40");
  assert.equal(d.total_brutto, "659.40");
});
