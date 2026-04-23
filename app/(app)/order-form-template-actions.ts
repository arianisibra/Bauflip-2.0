"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { deleteOrderFormTemplate, listOrderFormTemplatesForOrg } from "@/lib/db/repository";
import type { OrderFormTemplate } from "@/lib/domain/types";

export async function listOrderFormTemplatesForOrgAction(): Promise<OrderFormTemplate[]> {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin" || !session.organizationId) {
    throw new Error("Keine Berechtigung.");
  }
  return listOrderFormTemplatesForOrg(session.organizationId);
}

export async function deleteOrderFormTemplateAction(templateId: string) {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin" || !session.organizationId) {
    throw new Error("Keine Berechtigung.");
  }
  await deleteOrderFormTemplate(templateId);
  // Client-side invalidation via TanStack (`useDeleteOrderFormTemplate`).
}
