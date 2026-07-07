import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatIban, isQrIban, isValidQrBillIban, normalizeIban } from "@/lib/qr-bill/iban";

describe("normalizeIban", () => {
  it("strips spaces and uppercases", () => {
    assert.equal(normalizeIban("ch93 0076 2011 6238 5295 7"), "CH9300762011623852957");
  });
});

describe("isValidQrBillIban", () => {
  it("accepts a valid CH IBAN", () => {
    assert.equal(isValidQrBillIban("CH93 0076 2011 6238 5295 7"), true);
  });

  it("accepts the official QR-IBAN example", () => {
    assert.equal(isValidQrBillIban("CH44 3199 9123 0008 8901 2"), true);
  });

  it("rejects a tampered check digit", () => {
    assert.equal(isValidQrBillIban("CH94 0076 2011 6238 5295 7"), false);
  });

  it("rejects a tampered account digit", () => {
    assert.equal(isValidQrBillIban("CH93 0076 2011 6238 5295 8"), false);
  });

  it("rejects non-CH/LI countries (QR-Rechnung erlaubt nur CH/LI)", () => {
    // Gültige DE-IBAN, aber für QR-Rechnungen nicht zulässig.
    assert.equal(isValidQrBillIban("DE89 3704 0044 0532 0130 00"), false);
  });

  it("rejects wrong length", () => {
    assert.equal(isValidQrBillIban("CH93 0076 2011 6238 5295"), false);
    assert.equal(isValidQrBillIban(""), false);
  });
});

describe("isQrIban", () => {
  it("detects the QR-IID range 30000-31999", () => {
    assert.equal(isQrIban("CH44 3199 9123 0008 8901 2"), true);
  });

  it("returns false for a regular bank IID", () => {
    assert.equal(isQrIban("CH93 0076 2011 6238 5295 7"), false);
  });

  it("returns false for invalid IBANs even with QR-IID", () => {
    assert.equal(isQrIban("CH00 3199 9123 0008 8901 2"), false);
  });
});

describe("formatIban", () => {
  it("groups into blocks of four", () => {
    assert.equal(formatIban("CH9300762011623852957"), "CH93 0076 2011 6238 5295 7");
  });
});
