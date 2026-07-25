import assert from "node:assert/strict";
import { test } from "node:test";
import { computeQuoteTotals, quoteLineTotal, roundRappen } from "./totals";

test("roundRappen rundet kaufmännisch auf Rappen", () => {
  assert.equal(roundRappen(2.345), 2.35);
  assert.equal(roundRappen(3.14159), 3.14);
});

test("quoteLineTotal multipliziert Menge x Preis", () => {
  assert.equal(quoteLineTotal({ quantity: 48, unitPrice: 90.7 }), 4353.6);
});

test("computeQuoteTotals ohne Rabatt entspricht der alten Berechnung", () => {
  const { subtotal, discountAmount, totalNet, totalGross } = computeQuoteTotals(
    [{ description: "a", quantity: 2, unitPrice: 100 }],
    7.7,
  );
  assert.equal(subtotal, 200);
  assert.equal(discountAmount, 0);
  assert.equal(totalNet, 200);
  assert.equal(totalGross, 215.4);
});

test("computeQuoteTotals zieht Rabatt vor der MwSt ab", () => {
  // Beispiel aus einer echten Offerte: Zwischentotal 25'756.85, ./. 10% Rabatt,
  // Zwischentotal 23'189.25 (netto), + 7.7% MwSt = 24'972.74 (gerundet).
  const { subtotal, discountAmount, totalNet, totalGross } = computeQuoteTotals(
    [{ description: "a", quantity: 1, unitPrice: 25756.85 }],
    7.7,
    10,
  );
  assert.equal(subtotal, 25756.85);
  assert.equal(discountAmount, 2575.69);
  assert.equal(totalNet, 23181.16);
  assert.equal(totalGross, roundRappen(23181.16 * 1.077));
});

test("computeQuoteTotals ohne Positionen liefert Nullen", () => {
  const totals = computeQuoteTotals([], 8.1, 5);
  assert.deepEqual(totals, { subtotal: 0, discountAmount: 0, totalNet: 0, totalGross: 0, lineTotals: [] });
});
