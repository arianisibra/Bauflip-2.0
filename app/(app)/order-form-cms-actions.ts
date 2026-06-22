"use server";

import { z } from "zod";
import { requireAdminLayoutSession } from "@/lib/auth/organization";
import { insertOrderFormTemplate, updateOrderFormTemplate } from "@/lib/db/repository";
import { orderFormFieldsSchema, slugifyOrderFormSlug } from "@/lib/order-forms/schema";

// Client-side cache invalidation is owned by TanStack hooks in lib/query/hooks.ts.

const cmsPayloadSchema = z.object({
  supplierName: z.string().max(200),
  name: z.string().trim().min(2, "Formularname zu kurz."),
  slug: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean(),
  fields: orderFormFieldsSchema,
});

export async function createOrderFormCmsAction(payload: unknown): Promise<{ id: string }> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) {
    throw new Error("Keine Berechtigung.");
  }

  const parsed = cmsPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  const v = parsed.data;
  const supplierName = v.supplierName.trim() ? v.supplierName.trim() : null;
  const description =
    v.description != null && v.description.trim() ? v.description.trim() : null;
  const slugBase = v.slug?.trim() ? slugifyOrderFormSlug(v.slug.trim()) : slugifyOrderFormSlug(v.name);

  const created = await insertOrderFormTemplate({
    organizationId: session.organizationId,
    supplierName,
    name: v.name,
    slug: slugBase,
    description,
    fields: v.fields,
    sortOrder: v.sortOrder,
    isActive: v.isActive,
  });

  return { id: created.id };
}

export async function updateOrderFormCmsAction(templateId: string, payload: unknown): Promise<void> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) {
    throw new Error("Keine Berechtigung.");
  }

  const parsed = cmsPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  const v = parsed.data;
  const supplierName = v.supplierName.trim() ? v.supplierName.trim() : null;
  const description =
    v.description != null && v.description.trim() ? v.description.trim() : null;
  const slugFinal = v.slug?.trim() ? slugifyOrderFormSlug(v.slug.trim()) : slugifyOrderFormSlug(v.name);

  await updateOrderFormTemplate(templateId, {
    supplierName,
    name: v.name,
    slug: slugFinal,
    description,
    fields: v.fields,
    sortOrder: v.sortOrder,
    isActive: v.isActive,
  });
}
