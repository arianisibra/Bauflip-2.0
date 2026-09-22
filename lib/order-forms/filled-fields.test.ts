import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OrderFormFieldDef } from "./schema";
import { getFilledOrderFormFields, getLegacyOrderFormValues } from "./filled-fields";

/**
 * Regression 18.09.2026 (bemerkt am 22.09.): Nach dem Umbau der Vorlagen heissen die Felder
 * anders; 293 Aufträge zeigten leere Bestellformulare, obwohl die Masse gespeichert sind.
 */
const heutigeFelder = [
  { key: "stuckzahl_2", label: "Stückzahl", type: "number", required: false },
  { key: "breite_total_2", label: "Breite Total", type: "number", required: false },
  { key: "stoff_nr", label: "Stoff Nr.", type: "number", required: false },
] as unknown as OrderFormFieldDef[];

describe("getLegacyOrderFormValues", () => {
  it("findet Werte unter alten Schlüsseln und beschriftet sie wie das heutige Feld", () => {
    const alt = getLegacyOrderFormValues({
      fields: heutigeFelder,
      values: { stuckzahl: "1", breite_total: "2450", stoff_nr_2: "24 460" },
    });
    assert.deepEqual(alt, [
      { key: "stuckzahl", label: "Stückzahl", value: "1" },
      { key: "breite_total", label: "Breite Total", value: "2450" },
      { key: "stoff_nr_2", label: "Stoff Nr.", value: "24 460" },
    ]);
  });

  it("Felder ohne Gegenstück bekommen eine lesbare Beschriftung", () => {
    const alt = getLegacyOrderFormValues({ fields: heutigeFelder, values: { position: "1" } });
    assert.deepEqual(alt, [{ key: "position", label: "Position", value: "1" }]);
  });

  it("zeigt nichts doppelt: was die Vorlage kennt, bleibt der normalen Anzeige überlassen", () => {
    const werte = { stuckzahl_2: "3", stuckzahl: "1" };
    assert.deepEqual(
      getFilledOrderFormFields({ fields: heutigeFelder, values: werte }).map((f) => f.key),
      ["stuckzahl_2"],
    );
    assert.deepEqual(
      getLegacyOrderFormValues({ fields: heutigeFelder, values: werte }).map((v) => v.key),
      ["stuckzahl"],
    );
  });

  it("leere Werte werden nicht angezeigt", () => {
    assert.deepEqual(getLegacyOrderFormValues({ fields: heutigeFelder, values: { position: "  " } }), []);
  });
});
