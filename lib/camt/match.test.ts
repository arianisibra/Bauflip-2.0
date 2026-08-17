import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchCamtEntries, summarizeCamtMatches, type MatchableInvoice } from "@/lib/camt/match";
import type { CamtCreditEntry } from "@/lib/camt/parse";

function entry(overrides: Partial<CamtCreditEntry> = {}): CamtCreditEntry {
  return {
    amount: 1334.49,
    currency: "CHF",
    valueDate: "2026-07-10",
    reference: "210000000003139471430009017",
    debtorName: "Familie Muster",
    remittanceInfo: null,
    ...overrides,
  };
}

function invoice(overrides: Partial<MatchableInvoice> = {}): MatchableInvoice {
  return {
    id: "inv-1",
    invoiceNumber: "RE-2026-1001",
    paymentReference: "210000000003139471430009017",
    totalGross: 1334.49,
    deductedAmount: 0,
    status: "sent",
    ...overrides,
  };
}

describe("matchCamtEntries", () => {
  it("matches when reference and amount agree exactly", () => {
    const [result] = matchCamtEntries([entry()], [invoice()]);
    assert.equal(result.kind, "matched");
    if (result.kind === "matched") assert.equal(result.invoice.id, "inv-1");
  });

  it("is insensitive to reference spacing/case", () => {
    const [result] = matchCamtEntries(
      [entry({ reference: "21 00000 00003 13947 14300 09017" })],
      [invoice({ paymentReference: "210000000003139471430009017" })],
    );
    assert.equal(result.kind, "matched");
  });

  it("flags an amount mismatch (e.g. partial payment) instead of auto-matching", () => {
    const [result] = matchCamtEntries([entry({ amount: 1000 })], [invoice()]);
    assert.equal(result.kind, "amountMismatch");
    if (result.kind === "amountMismatch") assert.equal(result.expectedAmount, 1334.49);
  });

  it("treats a rounding-level cent difference as equal (no false mismatch)", () => {
    const [result] = matchCamtEntries(
      [entry({ amount: 1334.490001 })],
      [invoice({ totalGross: 1334.49 })],
    );
    assert.equal(result.kind, "matched");
  });

  it("matches against totalGross minus deductedAmount, not the full invoice amount (Akonto-Abzug)", () => {
    const [result] = matchCamtEntries(
      [entry({ amount: 834.49 })],
      [invoice({ totalGross: 1334.49, deductedAmount: 500 })],
    );
    assert.equal(result.kind, "matched");
  });

  it("flags a mismatch when a deposit-deducted invoice is paid at the full (undeducted) amount", () => {
    const [result] = matchCamtEntries(
      [entry({ amount: 1334.49 })],
      [invoice({ totalGross: 1334.49, deductedAmount: 500 })],
    );
    assert.equal(result.kind, "amountMismatch");
    if (result.kind === "amountMismatch") assert.equal(result.expectedAmount, 834.49);
  });

  it("marks a reference match against an already-paid invoice as alreadyPaid, not matched", () => {
    const [result] = matchCamtEntries([entry()], [invoice({ status: "paid" })]);
    assert.equal(result.kind, "alreadyPaid");
  });

  it("leaves entries without any reference unmatched (no fuzzy fallback)", () => {
    const [result] = matchCamtEntries(
      [entry({ reference: null, remittanceInfo: "Rechnung RE-2026-1001" })],
      [invoice()],
    );
    assert.equal(result.kind, "unmatched");
  });

  it("leaves entries with an unknown reference unmatched", () => {
    const [result] = matchCamtEntries([entry({ reference: "UNKNOWN-REF" })], [invoice()]);
    assert.equal(result.kind, "unmatched");
  });

  it("never matches invoices without a stored payment reference", () => {
    const [result] = matchCamtEntries([entry()], [invoice({ paymentReference: null })]);
    assert.equal(result.kind, "unmatched");
  });

  it("processes multiple entries against multiple invoices independently", () => {
    const entries = [
      entry({ reference: "REF-A", amount: 100 }),
      entry({ reference: "REF-B", amount: 200 }),
      entry({ reference: "REF-C", amount: 300 }),
    ];
    const invoices = [
      invoice({ id: "a", paymentReference: "REF-A", totalGross: 100 }),
      invoice({ id: "b", paymentReference: "REF-B", totalGross: 999 }),
      // REF-C hat keine passende Rechnung.
    ];
    const results = matchCamtEntries(entries, invoices);
    assert.equal(results[0].kind, "matched");
    assert.equal(results[1].kind, "amountMismatch");
    assert.equal(results[2].kind, "unmatched");
  });
});

describe("summarizeCamtMatches", () => {
  it("counts each bucket", () => {
    const results = matchCamtEntries(
      [
        entry({ reference: "REF-A" }),
        entry({ reference: "REF-B", amount: 1 }),
        entry({ reference: "REF-C" }),
        entry({ reference: null }),
      ],
      [
        invoice({ id: "a", paymentReference: "REF-A" }),
        invoice({ id: "b", paymentReference: "REF-B", totalGross: 999 }),
        invoice({ id: "c", paymentReference: "REF-C", status: "paid" }),
      ],
    );
    assert.deepEqual(summarizeCamtMatches(results), {
      matched: 1,
      amountMismatch: 1,
      alreadyPaid: 1,
      unmatched: 1,
    });
  });
});
