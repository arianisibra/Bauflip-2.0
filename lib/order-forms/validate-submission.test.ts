import assert from "node:assert/strict";
import { test } from "node:test";
import type { OrderFormFieldDef } from "./schema";
import { validateOrderFormValues } from "./validate-submission";

/**
 * Regression 21.09.2026: Nach dem Umbau der Vorlagen (18.09.) liessen sich 294 von 297 Rapporten
 * nicht mehr speichern, weil sie Schlüssel trugen, die die Vorlage nicht mehr kennt.
 */
const FELDER = [
  { key: "breite_total_2", label: "Breite Total", type: "number", required: false },
  { key: "farbe", label: "Farbe", type: "text", required: false },
] as unknown as OrderFormFieldDef[];

const GESPEICHERT = [{ position: "1", breite_total: "3300", farbe: "110" }];

test("alter, bereits gespeicherter Schlüssel wird unverändert mitgeführt", () => {
  const out = validateOrderFormValues(
    "tpl",
    FELDER,
    { position: "1", breite_total: "3300", farbe: "120" },
    { allFieldsVisible: true, storedValues: GESPEICHERT },
  );
  assert.deepEqual(out, { farbe: "120", position: "1", breite_total: "3300" });
});

test("ohne gespeicherte Werte bleibt ein unbekannter Schlüssel abgelehnt (neuer Rapport)", () => {
  assert.throws(
    () => validateOrderFormValues("tpl", FELDER, { position: "1" }, { allFieldsVisible: true }),
    /Unbekanntes Feld „position“/,
  );
});

test("geänderter Wert eines alten Schlüssels wird abgelehnt — kein Einschleusen über Altfelder", () => {
  assert.throws(
    () =>
      validateOrderFormValues(
        "tpl",
        FELDER,
        { position: "99" },
        { allFieldsVisible: true, storedValues: GESPEICHERT },
      ),
    /Unbekanntes Feld „position“/,
  );
});

test("fremder unbekannter Schlüssel wird trotz gespeicherter Werte abgelehnt", () => {
  assert.throws(
    () =>
      validateOrderFormValues(
        "tpl",
        FELDER,
        { boese: "x" },
        { allFieldsVisible: true, storedValues: GESPEICHERT },
      ),
    /Unbekanntes Feld „boese“/,
  );
});

test("mehrere Positionen: Wert darf aus irgendeiner gespeicherten Zeile derselben Vorlage stammen", () => {
  const out = validateOrderFormValues(
    "tpl",
    FELDER,
    { position: "2" },
    { allFieldsVisible: true, storedValues: [{ position: "1" }, { position: "2" }] },
  );
  assert.deepEqual(out, { position: "2" });
});

test("bekannte Felder werden weiterhin normal geprüft", () => {
  assert.throws(
    () =>
      validateOrderFormValues(
        "tpl",
        FELDER,
        { breite_total_2: "abc" },
        { allFieldsVisible: true, storedValues: GESPEICHERT },
      ),
    /muss eine Zahl sein/,
  );
});

const MIT_AUSWAHL = [
  { key: "antrieb", label: "Antrieb", type: "select", required: false, options: ["Motor", "Kurbel"] },
] as unknown as OrderFormFieldDef[];

test("entfernte Auswahloption bleibt gültig, wenn sie so schon gespeichert war", () => {
  const out = validateOrderFormValues("tpl", MIT_AUSWAHL, { antrieb: "Gurt" }, {
    allFieldsVisible: true,
    storedValues: [{ antrieb: "Gurt" }],
  });
  assert.equal(out.antrieb, "Gurt");
});

test("unbekannte Auswahloption wird weiterhin abgelehnt, wenn sie neu ist", () => {
  assert.throws(
    () =>
      validateOrderFormValues("tpl", MIT_AUSWAHL, { antrieb: "Solar" }, {
        allFieldsVisible: true,
        storedValues: [{ antrieb: "Gurt" }],
      }),
    /Ungültige Auswahl/,
  );
});
