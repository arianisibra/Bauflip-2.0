"use server";

import { requireAdminLayoutSession } from "@/lib/auth/organization";
import { deleteOrderFormTemplate, listOrderFormTemplatesForOrg } from "@/lib/db/repository";
import type { OrderFormTemplate } from "@/lib/domain/types";
import { publish } from "@/lib/realtime/publish";

export async function listOrderFormTemplatesForOrgAction(): Promise<OrderFormTemplate[]> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) {
    throw new Error("Keine Berechtigung.");
  }
  return listOrderFormTemplatesForOrg(session.organizationId);
}

export async function deleteOrderFormTemplateAction(templateId: string, tabId?: string) {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) {
    throw new Error("Keine Berechtigung.");
  }
  await deleteOrderFormTemplate(templateId);

  await publish(session.organizationId, {
    type: "order_form_template.changed",
    originTabId: tabId,
  });
}
