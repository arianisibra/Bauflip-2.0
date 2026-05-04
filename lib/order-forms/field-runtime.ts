import type { OrderFormFieldDef } from "@/lib/order-forms/schema";

export function fieldShowWhen(f: OrderFormFieldDef): "always" | "when_field_equals" {
  return f.showWhen ?? "always";
}

export function fieldRequireWhen(f: OrderFormFieldDef): "when_marked_required" | "after_base_required" {
  return f.requireWhen ?? "when_marked_required";
}

/**
 * Ein oder mehrere erwartete Werte aus `showWhenValue`: durch Komma, Semikolon oder
 * Zeilenumbruch getrennt; je Token trimmen. Leere Tokens ignorieren.
 */
export function parseShowWhenExpectedTokens(showWhenValue: string | undefined): string[] {
  const raw = showWhenValue ?? "";
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Sichtbarkeit relativ zu aktuellen Formularwerten (nur vorherige Felder als Referenz empfohlen). */
export function isOrderFormFieldVisible(
  field: OrderFormFieldDef,
  values: Record<string, string>,
): boolean {
  const mode = fieldShowWhen(field);
  if (mode === "always") return true;
  const refKey = field.showWhenFieldKey?.trim();
  if (!refKey) return true;
  const raw = values[refKey] ?? "";
  const trimmed = raw.trim();
  const tokens = parseShowWhenExpectedTokens(field.showWhenValue);
  if (tokens.length > 0) {
    return tokens.includes(trimmed);
  }
  return trimmed.length > 0;
}

/** Alle Basis-Pflichtfelder (Pflicht + Modus „wenn markiert“) vor index erfüllt? */
export function baseMarkedRequiredFilledBefore(
  fields: OrderFormFieldDef[],
  index: number,
  visibility: boolean[],
  values: Record<string, string>,
): boolean {
  for (let j = 0; j < index; j++) {
    if (!visibility[j]) continue;
    const fj = fields[j];
    if (!fj.required) continue;
    if (fieldRequireWhen(fj) !== "when_marked_required") continue;
    const v = (values[fj.key] ?? "").trim();
    if (!v) return false;
  }
  return true;
}

export function isOrderFormFieldEffectivelyRequired(
  field: OrderFormFieldDef,
  index: number,
  fields: OrderFormFieldDef[],
  visibility: boolean[],
  values: Record<string, string>,
): boolean {
  if (!visibility[index]) return false;
  if (!field.required) return false;
  if (fieldRequireWhen(field) === "when_marked_required") return true;
  return baseMarkedRequiredFilledBefore(fields, index, visibility, values);
}

export function computeOrderFormVisibilityMask(
  fields: OrderFormFieldDef[],
  values: Record<string, string>,
): boolean[] {
  return fields.map((f) => isOrderFormFieldVisible(f, values));
}
