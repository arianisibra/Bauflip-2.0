"use server";

import { requireOfficeSession } from "@/lib/auth/organization";
import {
  createProjectOrder,
  deleteProjectOrder,
  listProjectOrders,
  setProjectOrderReceived,
} from "@/lib/db/repository";
import type { ProjectOrderLine } from "@/lib/domain/types";
import { projectOrderCreateSchema } from "@/lib/validations/forms";
import { publish } from "@/lib/realtime/publish";

export async function listProjectOrdersAction(projectId: string): Promise<ProjectOrderLine[]> {
  await requireOfficeSession();
  if (!projectId || typeof projectId !== "string") return [];
  return listProjectOrders(projectId);
}

export async function createProjectOrderAction(
  input: unknown,
  tabId?: string,
): Promise<ProjectOrderLine> {
  const session = await requireOfficeSession();
  if (!session.organizationId) throw new Error("Keine Berechtigung.");

  const parsed = projectOrderCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  const created = await createProjectOrder(
    {
      projectId: parsed.data.projectId,
      supplierName: parsed.data.supplierName,
      description: parsed.data.description,
      orderedAt: parsed.data.orderedAt,
      expectedAt: parsed.data.expectedAt?.trim() ? parsed.data.expectedAt : null,
      notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
    },
    session.organizationId,
    session.userId,
  );
  await publish(session.organizationId, {
    type: "order_line.changed",
    projectId: parsed.data.projectId,
    originTabId: tabId,
  });
  return created;
}

export async function setProjectOrderReceivedAction(
  orderId: string,
  projectId: string,
  received: boolean,
  tabId?: string,
): Promise<{ ok: true }> {
  const session = await requireOfficeSession();
  if (!session.organizationId) throw new Error("Keine Berechtigung.");
  if (!orderId || typeof orderId !== "string") throw new Error("Ungültige ID.");

  await setProjectOrderReceived(orderId, received);
  await publish(session.organizationId, { type: "order_line.changed", projectId, originTabId: tabId });
  return { ok: true };
}

export async function deleteProjectOrderAction(
  orderId: string,
  projectId: string,
  tabId?: string,
): Promise<{ ok: true }> {
  const session = await requireOfficeSession();
  if (!session.organizationId) throw new Error("Keine Berechtigung.");
  if (!orderId || typeof orderId !== "string") throw new Error("Ungültige ID.");

  await deleteProjectOrder(orderId);
  await publish(session.organizationId, { type: "order_line.changed", projectId, originTabId: tabId });
  return { ok: true };
}
