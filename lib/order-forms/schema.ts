import { z } from "zod";

export const orderFormFieldDefSchema = z
  .object({
    key: z
      .string()
      .min(1, "Feld-Schlüssel fehlt.")
      .regex(/^[a-z][a-z0-9_]*$/i, "Nur Buchstaben, Ziffern, Unterstrich; mit Buchstabe beginnen."),
    label: z.string().min(1, "Beschriftung fehlt."),
    type: z.enum(["text", "textarea", "number", "select", "artikel"]),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    options: z.array(z.string().min(1)).optional(),
    showWhen: z.enum(["always", "when_field_equals"]).optional(),
    showWhenFieldKey: z.string().optional(),
    /** Ein Wert oder mehrere (Komma, Semikolon oder Zeile); jeweils exakter Vergleich mit dem Referenzfeld. */
    showWhenValue: z.string().optional(),
    requireWhen: z.enum(["when_marked_required", "after_base_required"]).optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === "select" && (!field.options || field.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Auswahlfelder brauchen mindestens eine Option.",
        path: ["options"],
      });
    }
    if (field.showWhen === "when_field_equals") {
      if (!field.showWhenFieldKey?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bei bedingter Anzeige Feld-Schlüssel angeben.",
          path: ["showWhenFieldKey"],
        });
      }
    }
  });

export const orderFormFieldsSchema = z.array(orderFormFieldDefSchema).max(48);

export type OrderFormFieldDef = z.infer<typeof orderFormFieldDefSchema>;

export function parseOrderFormFieldsJson(raw: unknown): OrderFormFieldDef[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed = orderFormFieldsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function slugifyOrderFormSlug(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[äàâ]/g, "a")
    .replace(/[öòô]/g, "o")
    .replace(/[üùû]/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s : "formular";
}
