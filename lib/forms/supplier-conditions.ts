import type {
  SupplierFieldCondition,
  SupplierOrderFieldDefinition,
} from "@/lib/domain/types";

export type SupplierFormValues = Record<string, string | undefined>;

function matchesCondition(condition: SupplierFieldCondition, values: SupplierFormValues): boolean {
  const current = String(values[condition.fieldKey] ?? "").trim();
  const expected = String(condition.value ?? "").trim();
  if (condition.operator === "not_equals") {
    return current !== expected;
  }
  return current === expected;
}

function allConditionsMatch(conditions: SupplierFieldCondition[] | undefined, values: SupplierFormValues): boolean {
  if (!conditions || conditions.length === 0) {
    return true;
  }
  return conditions.every((condition) => matchesCondition(condition, values));
}

export function isSupplierFieldVisible(
  field: SupplierOrderFieldDefinition,
  values: SupplierFormValues,
): boolean {
  return allConditionsMatch(field.showWhen, values);
}

export function isSupplierFieldRequired(
  field: SupplierOrderFieldDefinition,
  values: SupplierFormValues,
): boolean {
  if (field.requireWhen && field.requireWhen.length > 0) {
    return allConditionsMatch(field.requireWhen, values);
  }
  return Boolean(field.required);
}

export function getVisibleSupplierFields(
  fields: SupplierOrderFieldDefinition[],
  values: SupplierFormValues,
): SupplierOrderFieldDefinition[] {
  return fields.filter((field) => isSupplierFieldVisible(field, values));
}

export function getRequiredSupplierFieldKeys(
  fields: SupplierOrderFieldDefinition[],
  values: SupplierFormValues,
): string[] {
  return fields
    .filter((field) => isSupplierFieldVisible(field, values))
    .filter((field) => isSupplierFieldRequired(field, values))
    .map((field) => field.key);
}
