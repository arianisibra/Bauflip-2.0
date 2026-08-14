import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkRegistrationAllowed,
  resolveRegistrationMode,
} from "@/lib/security/registration-mode";

test("fehlende oder unbekannte Einstellung bedeutet GESCHLOSSEN", () => {
  // Der wichtigste Test: Eine verschriebene Variable darf kein Tor aufmachen.
  assert.equal(resolveRegistrationMode(undefined), "closed");
  assert.equal(resolveRegistrationMode(""), "closed");
  assert.equal(resolveRegistrationMode("offen"), "closed");
  assert.equal(resolveRegistrationMode("OPEN_"), "closed");
  assert.equal(resolveRegistrationMode("true"), "closed");
});

test("gültige Werte werden erkannt, unabhängig von Gross-/Kleinschreibung", () => {
  assert.equal(resolveRegistrationMode("open"), "open");
  assert.equal(resolveRegistrationMode("OPEN"), "open");
  assert.equal(resolveRegistrationMode(" code "), "code");
});

test("geschlossen weist ab, auch mit Code", () => {
  assert.equal(checkRegistrationAllowed(null, "closed", "geheim").ok, false);
  assert.equal(checkRegistrationAllowed("geheim", "closed", "geheim").ok, false);
});

test("offen lässt durch, auch ohne Code", () => {
  assert.equal(checkRegistrationAllowed(null, "open", undefined).ok, true);
});

test("Code-Modus verlangt den richtigen Code", () => {
  assert.equal(checkRegistrationAllowed("geheim", "code", "geheim").ok, true);
  assert.equal(checkRegistrationAllowed(" geheim ", "code", "geheim").ok, true);
  assert.equal(checkRegistrationAllowed("falsch", "code", "geheim").ok, false);
  assert.equal(checkRegistrationAllowed("", "code", "geheim").ok, false);
  assert.equal(checkRegistrationAllowed(null, "code", "geheim").ok, false);
});

test("Code-Modus ohne hinterlegten Code ist geschlossen, nicht offen", () => {
  // Sonst wäre «code» ohne REGISTRATION_CODE versehentlich eine offene Tür.
  assert.equal(checkRegistrationAllowed("egal", "code", undefined).ok, false);
  assert.equal(checkRegistrationAllowed("egal", "code", "  ").ok, false);
  assert.equal(checkRegistrationAllowed(null, "code", undefined).ok, false);
});

test("Fehlermeldung verrät nicht, ob ein Code existiert", () => {
  const zu = checkRegistrationAllowed(null, "closed", "geheim");
  const ohneCode = checkRegistrationAllowed("egal", "code", undefined);
  assert.equal(zu.ok, false);
  assert.equal(ohneCode.ok, false);
  if (!zu.ok && !ohneCode.ok) {
    assert.equal(zu.error, ohneCode.error);
  }
});
