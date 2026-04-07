import type { OrderFormFieldDef } from "@/lib/order-forms/schema";
import {
  computeOrderFormVisibilityMask,
  isOrderFormFieldEffectivelyRequired,
} from "@/lib/order-forms/field-runtime";

export type ValidatedOrderFormRow = { templateId: string; valuesJson: Record<string, string> };

/**
 * Prüft Rohwerte gegen die Vorlagen-Felder; wirft bei Pflicht- oder Typfehlern.
 * Berücksichtigt Sichtbarkeit (showWhen) und Pflicht-Modus (requireWhen).
 */
export function validateOrderFormValues(
  templateId: string,
  fields: OrderFormFieldDef[],
  values: Record<string, string>,
): Record<string, string> {
  const keys = new Set(fields.map((f) => f.key));
  const visibility = computeOrderFormVisibilityMask(fields, values);
  const out: Record<string, string> = {};

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!visibility[i]) {
      continue;
    }

    const raw = values[f.key];
    const trimmed = raw != null ? String(raw).trim() : "";

    if (isOrderFormFieldEffectivelyRequired(f, i, fields, visibility, values) && !trimmed) {
      throw new Error(`Pflichtfeld „${f.label}“ (${templateId}) fehlt.`);
    }

    if (!trimmed) {
      continue;
    }

    if (f.type === "number") {
      if (Number.isNaN(Number(trimmed.replace(",", ".")))) {
        throw new Error(`„${f.label}“ muss eine Zahl sein.`);
      }
    }

    if (f.type === "select" && f.options && !f.options.includes(trimmed)) {
      throw new Error(`Ungültige Auswahl für „${f.label}“.`);
    }

    out[f.key] = trimmed;
  }

  for (const k of Object.keys(values)) {
    if (!keys.has(k) && String(values[k]).trim()) {
      throw new Error(`Unbekanntes Feld „${k}“ für Vorlage.`);
    }
    const idx = fields.findIndex((x) => x.key === k);
    if (idx >= 0 && !visibility[idx] && String(values[k]).trim()) {
      continue;
    }
  }

  return out;
}
