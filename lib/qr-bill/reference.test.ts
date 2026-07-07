import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildQrrReference,
  buildScorReference,
  chooseReferenceType,
  formatPaymentReference,
  isValidQrrReference,
  isValidScorReference,
  mod10RecursiveCheckDigit,
} from "@/lib/qr-bill/reference";

describe("mod10RecursiveCheckDigit / QRR", () => {
  it("validates the canonical ESR example reference", () => {
    // Bekanntes Beispiel aus der ESR-/QRR-Dokumentation.
    assert.equal(isValidQrrReference("210000000003139471430009017"), true);
  });

  it("rejects a tampered reference", () => {
    assert.equal(isValidQrrReference("210000000003139471430009018"), false);
  });

  it("builds self-consistent references (round-trip)", () => {
    for (const [year, seq] of [[2026, 1001], [2026, 1], [2030, 999_999_999], [1999, 42]] as const) {
      const ref = buildQrrReference(year, seq);
      assert.equal(ref.length, 27);
      assert.equal(isValidQrrReference(ref), true, `ref ${ref} should validate`);
    }
  });

  it("is deterministic and encodes year + sequence", () => {
    const ref = buildQrrReference(2026, 1001);
    assert.equal(ref, buildQrrReference(2026, 1001));
    assert.ok(ref.includes("2026"));
    assert.ok(ref.endsWith(String(mod10RecursiveCheckDigit(ref.slice(0, 26)))));
  });

  it("rejects non-digit input", () => {
    assert.equal(isValidQrrReference("21000000000313947143000901A"), false);
    assert.throws(() => mod10RecursiveCheckDigit("12A"));
  });
});

describe("SCOR (ISO 11649)", () => {
  it("validates the canonical ISO example", () => {
    assert.equal(isValidScorReference("RF18539007547034"), true);
  });

  it("rejects tampered check digits", () => {
    assert.equal(isValidScorReference("RF19539007547034"), false);
  });

  it("builds self-consistent references from invoice numbers (round-trip)", () => {
    for (const core of ["RE20261001", "RE20269999", "1", "ABCDEFGHIJKLMNOPQRSTU"]) {
      const ref = buildScorReference(core);
      assert.ok(ref.startsWith("RF"));
      assert.equal(isValidScorReference(ref), true, `ref ${ref} should validate`);
    }
  });

  it("strips separators from the core", () => {
    assert.equal(buildScorReference("RE-2026-1001"), buildScorReference("RE20261001"));
  });

  it("rejects cores longer than 21 chars", () => {
    assert.throws(() => buildScorReference("A".repeat(22)));
  });
});

describe("chooseReferenceType", () => {
  it("returns QRR for QR-IBANs", () => {
    assert.equal(chooseReferenceType("CH44 3199 9123 0008 8901 2"), "QRR");
  });

  it("returns SCOR for regular CH IBANs", () => {
    assert.equal(chooseReferenceType("CH93 0076 2011 6238 5295 7"), "SCOR");
  });

  it("returns NON without or with invalid IBAN", () => {
    assert.equal(chooseReferenceType(null), "NON");
    assert.equal(chooseReferenceType("DE89 3704 0044 0532 0130 00"), "NON");
  });
});

describe("formatPaymentReference", () => {
  it("formats QRR in 2+5x5 blocks", () => {
    assert.equal(
      formatPaymentReference("QRR", "210000000003139471430009017"),
      "21 00000 00003 13947 14300 09017",
    );
  });

  it("formats SCOR in blocks of four", () => {
    assert.equal(formatPaymentReference("SCOR", "RF18539007547034"), "RF18 5390 0754 7034");
  });

  it("returns empty string for null", () => {
    assert.equal(formatPaymentReference("NON", null), "");
  });
});
