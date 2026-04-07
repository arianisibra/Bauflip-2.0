"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { deleteOrderFormTemplate } from "@/lib/db/repository";

export async function deleteOrderFormTemplateAction(templateId: string) {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin" || !session.organizationId) {
    throw new Error("Keine Berechtigung.");
  }
  await deleteOrderFormTemplate(templateId);
  revalidatePath("/bestellformulare");
}
