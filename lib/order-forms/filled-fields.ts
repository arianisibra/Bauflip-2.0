import type { OrderFormFieldDef } from "@/lib/order-forms/schema";

export function getFilledOrderFormFields(entry: {
  fields: OrderFormFieldDef[];
  values: Record<string, string>;
}): OrderFormFieldDef[] {
  return entry.fields.filter((f) => Boolean(entry.values[f.key]?.trim()));
}

/**
 * Gespeicherte Werte, die in der heutigen Vorlage KEIN Feld mehr haben.
 *
 * Werden Felder im Vorlagen-Editor gelöscht und neu angelegt, bekommen sie neue Schlüssel
 * (am 18.09.2026 bei Gross Storenbau: `breite_total` → `breite_total_2`, teils auch umgekehrt
 * `stoff_nr_2` → `stoff_nr`). Die Werte alter Rapporte bleiben unter dem alten Schlüssel
 * gespeichert, die Anzeige läuft aber über die heutigen Felder — dadurch sahen 293 Aufträge
 * leer aus, obwohl die Masse vorhanden waren. Diese Funktion holt sie zurück, ohne Daten
 * anzufassen: rein zusätzlich, nie ersetzend.
 */
export function getLegacyOrderFormValues(entry: {
  fields: OrderFormFieldDef[];
  values: Record<string, string>;
}): { key: string; label: string; value: string }[] {
  const bekannt = new Set(entry.fields.map((f) => f.key));
  return Object.entries(entry.values)
    .filter(([key, value]) => !bekannt.has(key) && Boolean(String(value ?? "").trim()))
    .map(([key, value]) => ({ key, label: legacyLabel(entry.fields, key), value: String(value).trim() }));
}

/**
 * Beschriftung für einen Schlüssel, den die Vorlage nicht mehr kennt: zuerst das Feld mit
 * demselben Stamm (`breite_total` ↔ `breite_total_2`), sonst der Schlüssel selbst lesbar gemacht.
 */
function legacyLabel(fields: OrderFormFieldDef[], key: string): string {
  const passend =
    fields.find((f) => f.key === `${key}_2`) ?? fields.find((f) => `${f.key}_2` === key);
  if (passend) return passend.label;
  const wort = key.replace(/_\d+$/, "").replace(/_/g, " ").trim();
  return wort ? wort.charAt(0).toUpperCase() + wort.slice(1) : key;
}
