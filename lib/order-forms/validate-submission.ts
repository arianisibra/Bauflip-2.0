import { FachFehler } from "@/lib/errors/fach-fehler";
import type { OrderFormFieldDef } from "@/lib/order-forms/schema";
import {
  computeOrderFormVisibilityMask,
  isOrderFormFieldEffectivelyRequired,
} from "@/lib/order-forms/field-runtime";

export type ValidatedOrderFormRow = { templateId: string; valuesJson: Record<string, string> };

export type ValidateOrderFormValuesOptions = {
  /** Rapport nachträglich: alle Vorlagenfelder prüfen/persistieren (unabhängig von showWhen). */
  allFieldsVisible?: boolean;
  /**
   * Bereits gespeicherte Werte dieses Rapports für dieselbe Vorlage (eine Zeile je Position).
   *
   * Vorlagen ändern sich: Am 18.09.2026 baute der Kunde alle fünf Vorlagen um, Felder wie
   * «position» fielen weg. Die alten Rapporte tragen diese Schlüssel weiter — und liessen sich
   * danach nicht mehr speichern («Unbekanntes Feld»), 294 von 297 Rapporten.
   *
   * Ein unbekannter Schlüssel wird deshalb übernommen, wenn GENAU DIESER WERT schon gespeichert
   * war. Er wird bewusst mitgeführt statt verworfen: Gespeichert wird nur das Ergebnis dieser
   * Funktion, Weglassen hiesse also Löschen (bei STOFF wären das Breite, Höhe und Stückzahl).
   * Neue unbekannte Schlüssel und geänderte Werte bleiben abgelehnt.
   */
  storedValues?: ReadonlyArray<Record<string, string>>;
};


/**
 * Prüft Rohwerte gegen die Vorlagen-Felder; wirft bei Pflicht- oder Typfehlern.
 * Berücksichtigt Sichtbarkeit (showWhen) und Pflicht-Modus (requireWhen).
 */
export function validateOrderFormValues(
  templateId: string,
  fields: OrderFormFieldDef[],
  values: Record<string, string>,
  options?: ValidateOrderFormValuesOptions,
): Record<string, string> {
  const keys = new Set(fields.map((f) => f.key));
  const visibility = options?.allFieldsVisible
    ? fields.map(() => true)
    : computeOrderFormVisibilityMask(fields, values);
  const out: Record<string, string> = {};

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!visibility[i]) {
      continue;
    }

    const raw = values[f.key];
    const trimmed = raw != null ? String(raw).trim() : "";

    if (isOrderFormFieldEffectivelyRequired(f, i, fields, visibility, values) && !trimmed) {
      throw new FachFehler(`Pflichtfeld „${f.label}“ (${templateId}) fehlt.`);
    }

    if (!trimmed) {
      continue;
    }

    if (f.type === "number") {
      if (Number.isNaN(Number(trimmed.replace(",", ".")))) {
        throw new FachFehler(`„${f.label}“ muss eine Zahl sein.`);
      }
    }

    if (f.type === "select" && f.options && !f.options.includes(trimmed)) {
      // Eine Option, die seither aus der Vorlage entfernt wurde, bleibt für diesen Rapport gültig,
      // solange sie unverändert bleibt — sonst sperrt jede Optionsänderung alte Rapporte.
      const warSchonGespeichert = (options?.storedValues ?? []).some(
        (zeile) => String(zeile[f.key] ?? "").trim() === trimmed,
      );
      if (!warSchonGespeichert) {
        throw new FachFehler(`Ungültige Auswahl für „${f.label}“.`);
      }
    }

    out[f.key] = trimmed;
  }

  for (const k of Object.keys(values)) {
    const wert = String(values[k] ?? "").trim();
    if (!keys.has(k) && wert) {
      const warSchonGespeichert = (options?.storedValues ?? []).some(
        (zeile) => String(zeile[k] ?? "").trim() === wert,
      );
      if (!warSchonGespeichert) {
        throw new FachFehler(`Unbekanntes Feld „${k}“ für Vorlage.`);
      }
      out[k] = wert;
      continue;
    }
    const idx = fields.findIndex((x) => x.key === k);
    if (idx >= 0 && !visibility[idx] && String(values[k]).trim()) {
      continue;
    }
  }

  return out;
}
