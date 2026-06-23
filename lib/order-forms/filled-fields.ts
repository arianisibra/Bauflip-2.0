import type { OrderFormFieldDef } from "@/lib/order-forms/schema";

export function getFilledOrderFormFields(entry: {
  fields: OrderFormFieldDef[];
  values: Record<string, string>;
}): OrderFormFieldDef[] {
  return entry.fields.filter((f) => Boolean(entry.values[f.key]?.trim()));
}
