"use server";

import { z } from "zod";
import { requireAdminLayoutSession } from "@/lib/auth/organization";
import { insertOrderFormTemplate, updateOrderFormTemplate } from "@/lib/db/repository";
import type { OrderFormTemplate } from "@/lib/domain/types";
import { orderFormFieldsSchema, slugifyOrderFormSlug } from "@/lib/order-forms/schema";
import { publish } from "@/lib/realtime/publish";

const cmsPayloadSchema = z.object({
  supplierName: z.string().max(200),
  name: z.string().trim().min(2, "Formularname zu kurz."),
  slug: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean(),
  fields: orderFormFieldsSchema,
});

export async function createOrderFormCmsAction(
  payload: unknown,
  tabId?: string,
): Promise<{ id: string; template: OrderFormTemplate }> {
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

  publish(session.organizationId, {
    type: "order_form_template.changed",
    originTabId: tabId,
  });

  return { id: created.id, template: created };
}

export async function updateOrderFormCmsAction(
  templateId: string,
  payload: unknown,
  tabId?: string,
): Promise<OrderFormTemplate> {
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

  const updated = await updateOrderFormTemplate(templateId, {
    supplierName,
    name: v.name,
    slug: slugFinal,
    description,
    fields: v.fields,
    sortOrder: v.sortOrder,
    isActive: v.isActive,
  });

  publish(session.organizationId, {
    type: "order_form_template.changed",
    originTabId: tabId,
  });

  return updated;
}
