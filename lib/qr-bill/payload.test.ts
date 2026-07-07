import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildQrBillPayload, splitStreetAndNumber, type QrBillData } from "@/lib/qr-bill/payload";
import { buildQrrReference, buildScorReference } from "@/lib/qr-bill/reference";

const CREDITOR = {
  name: "Bauflip Storen AG",
  street: "Musterstrasse",
  buildingNumber: "12",
  postalCode: "8004",
  city: "Zürich",
  country: "CH",
};

const DEBTOR = {
  name: "Familie Muster",
  street: "Beispielweg",
  buildingNumber: "3",
  postalCode: "8400",
  city: "Winterthur",
  country: "CH",
};

function qrrData(overrides: Partial<QrBillData> = {}): QrBillData {
  return {
    iban: "CH44 3199 9123 0008 8901 2",
    creditor: CREDITOR,
    amount: 1334.49,
    currency: "CHF",
    debtor: DEBTOR,
    referenceType: "QRR",
    reference: buildQrrReference(2026, 1001),
    unstructuredMessage: "Rechnung RE-2026-1001",
    ...overrides,
  };
}

describe("buildQrBillPayload", () => {
  it("produces the fixed 31-line structure with EPD trailer", () => {
    const lines = buildQrBillPayload(qrrData()).split("\n");
    assert.equal(lines.length, 31);
    assert.equal(lines[0], "SPC");
    assert.equal(lines[1], "0200");
    assert.equal(lines[2], "1");
    assert.equal(lines[3], "CH4431999123000889012");
    assert.equal(lines[4], "S");
    assert.equal(lines[5], "Bauflip Storen AG");
    assert.equal(lines[30], "EPD");
  });

  it("keeps the ultimate creditor block empty (7 lines)", () => {
    const lines = buildQrBillPayload(qrrData()).split("\n");
    // Zeilen 11–17 (Index): UltmtCdtr muss leer sein.
    for (let i = 11; i <= 17; i++) {
      assert.equal(lines[i], "", `line ${i} should be empty`);
    }
  });

  it("formats the amount with two decimals and dot", () => {
    const lines = buildQrBillPayload(qrrData({ amount: 1000 })).split("\n");
    assert.equal(lines[18], "1000.00");
    assert.equal(lines[19], "CHF");
  });

  it("allows an open amount (empty line)", () => {
    const lines = buildQrBillPayload(qrrData({ amount: null })).split("\n");
    assert.equal(lines[18], "");
  });

  it("leaves debtor block empty when debtor is null", () => {
    const lines = buildQrBillPayload(qrrData({ debtor: null })).split("\n");
    for (let i = 20; i <= 26; i++) {
      assert.equal(lines[i], "", `line ${i} should be empty`);
    }
  });

  it("carries QRR reference type and reference", () => {
    const ref = buildQrrReference(2026, 1001);
    const lines = buildQrBillPayload(qrrData({ reference: ref })).split("\n");
    assert.equal(lines[27], "QRR");
    assert.equal(lines[28], ref);
  });

  it("supports SCOR with a regular IBAN", () => {
    const ref = buildScorReference("RE20261001");
    const lines = buildQrBillPayload(
      qrrData({ iban: "CH93 0076 2011 6238 5295 7", referenceType: "SCOR", reference: ref }),
    ).split("\n");
    assert.equal(lines[27], "SCOR");
    assert.equal(lines[28], ref);
  });

  it("supports NON without reference", () => {
    const lines = buildQrBillPayload(
      qrrData({ iban: "CH93 0076 2011 6238 5295 7", referenceType: "NON", reference: null }),
    ).split("\n");
    assert.equal(lines[27], "NON");
    assert.equal(lines[28], "");
  });

  it("rejects QRR with invalid reference", () => {
    assert.throws(() => buildQrBillPayload(qrrData({ reference: "123" })));
  });

  it("rejects NON with a reference set", () => {
    assert.throws(() =>
      buildQrBillPayload(
        qrrData({ iban: "CH93 0076 2011 6238 5295 7", referenceType: "NON", reference: "RF18539007547034" }),
      ),
    );
  });

  it("rejects invalid or foreign IBANs", () => {
    assert.throws(() => buildQrBillPayload(qrrData({ iban: "DE89 3704 0044 0532 0130 00" })));
  });

  it("rejects incomplete creditor", () => {
    assert.throws(() =>
      buildQrBillPayload(qrrData({ creditor: { ...CREDITOR, postalCode: "" } })),
    );
  });

  it("clamps overlong fields to spec limits", () => {
    const lines = buildQrBillPayload(
      qrrData({
        creditor: { ...CREDITOR, name: "X".repeat(100) },
        unstructuredMessage: "M".repeat(200),
      }),
    ).split("\n");
    assert.equal(lines[5].length, 70);
    assert.equal(lines[29].length, 140);
  });

  it("preserves umlauts (allowed by spec)", () => {
    const lines = buildQrBillPayload(qrrData()).split("\n");
    assert.equal(lines[25], "Winterthur");
    assert.ok(buildQrBillPayload(qrrData()).includes("Zürich"));
  });
});

describe("splitStreetAndNumber", () => {
  it("splits street and number", () => {
    assert.deepEqual(splitStreetAndNumber("Musterstrasse 12"), {
      street: "Musterstrasse",
      buildingNumber: "12",
    });
  });

  it("handles letter suffixes", () => {
    assert.deepEqual(splitStreetAndNumber("Musterstrasse 12a"), {
      street: "Musterstrasse",
      buildingNumber: "12a",
    });
  });

  it("handles multi-word streets", () => {
    assert.deepEqual(splitStreetAndNumber("Alte Landstrasse 104"), {
      street: "Alte Landstrasse",
      buildingNumber: "104",
    });
  });

  it("returns street only when no number is present", () => {
    assert.deepEqual(splitStreetAndNumber("Postfach"), {
      street: "Postfach",
      buildingNumber: null,
    });
  });

  it("handles null/empty", () => {
    assert.deepEqual(splitStreetAndNumber(null), { street: null, buildingNumber: null });
    assert.deepEqual(splitStreetAndNumber("  "), { street: null, buildingNumber: null });
  });
});
