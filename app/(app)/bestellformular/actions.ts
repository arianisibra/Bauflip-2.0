"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import {
  createSupplierTemplate,
  deleteSupplierTemplate,
  ensureSupplierByName,
  updateSupplierTemplate,
} from "@/lib/db/repository";
import {
  supplierTemplateDeleteSchema,
  supplierTemplateSaveSchema,
} from "@/lib/validations/forms";

function assertAdminOfficeRole(role: string | null | undefined) {
  if (role !== "admin" && role !== "office") {
    throw new Error("Keine Berechtigung.");
  }
}

function normalizeFieldKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_");
}

function buildUniqueKeysFromLabels(
  fields: Array<{ key: string; label: string }>,
): string[] {
  const seen = new Map<string, number>();
  return fields.map((field, index) => {
    const raw = field.key?.trim() || field.label?.trim() || `feld_${index + 1}`;
    const base = normalizeFieldKey(raw) || `feld_${index + 1}`;
    const used = seen.get(base) ?? 0;
    seen.set(base, used + 1);
    return used === 0 ? base : `${base}_${used + 1}`;
  });
}

export async function saveSupplierTemplateAction(input: unknown) {
  const session = await getCurrentSession();
  assertAdminOfficeRole(session?.role);

  const parsed = supplierTemplateSaveSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Formulardaten.");
  }

  const payload = {
    ...parsed.data,
    fieldDefinitions: parsed.data.fieldDefinitions,
  };
  const supplier = await ensureSupplierByName(payload.supplierName);
  const uniqueKeys = buildUniqueKeysFromLabels(payload.fieldDefinitions);
  const normalizedFields = payload.fieldDefinitions.map((field, idx) => ({
    ...field,
    key: uniqueKeys[idx] ?? `feld_${idx + 1}`,
    options: field.options?.map((o) => o.trim()).filter((o) => o.length > 0),
    placeholder: field.placeholder?.trim() || undefined,
    helpText: field.helpText?.trim() || undefined,
    showWhen: (field.showWhen ?? [])
      .map((c) => ({
        fieldKey: c.fieldKey.trim(),
        operator: c.operator,
        value: c.value.trim(),
      }))
      .filter((c) => c.fieldKey.length > 0 && c.value.length > 0),
    requireWhen: (field.requireWhen ?? [])
      .map((c) => ({
        fieldKey: c.fieldKey.trim(),
        operator: c.operator,
        value: c.value.trim(),
      }))
      .filter((c) => c.fieldKey.length > 0 && c.value.length > 0),
  }));

  if (payload.id) {
    const updated = await updateSupplierTemplate({
      id: payload.id,
      supplierId: supplier.id,
      supplierName: supplier.name,
      name: payload.name,
      fieldDefinitions: normalizedFields,
    });
    revalidatePath("/bestellformular");
    revalidatePath("/projekte");
    return updated;
  } else {
    const created = await createSupplierTemplate({
      supplierId: supplier.id,
      supplierName: supplier.name,
      name: payload.name,
      fieldDefinitions: normalizedFields,
    });
    revalidatePath("/bestellformular");
    revalidatePath("/projekte");
    return created;
  }
}

export async function deleteSupplierTemplateAction(input: unknown) {
  const session = await getCurrentSession();
  assertAdminOfficeRole(session?.role);

  const parsed = supplierTemplateDeleteSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Ungültige Anfrage.");
  }

  await deleteSupplierTemplate(parsed.data.templateId);
  revalidatePath("/bestellformular");
  revalidatePath("/projekte");
}
