"use server";

import { requireOfficeSession } from "@/lib/auth/organization";
import {
  createPriceBookItem,
  deletePriceBookItem,
  listPriceBookItemsForOrg,
  updatePriceBookItem,
} from "@/lib/db/price-book";
import type { PriceBookItem } from "@/lib/domain/types";
import { publish } from "@/lib/realtime/publish";
import { priceBookItemSchema, priceBookItemUpdateSchema } from "@/lib/validations/forms";

function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Ungültige Eingabe.";
}

async function publishPriceBookChanged(organizationId: string | null, tabId?: string): Promise<void> {
  if (!organizationId) return;
  await publish(organizationId, { type: "price_book.changed", originTabId: tabId });
}

export async function listPriceBookItemsAction(): Promise<PriceBookItem[]> {
  const session = await requireOfficeSession();
  if (!session.organizationId) return [];
  return listPriceBookItemsForOrg(session.organizationId);
}

export async function createPriceBookItemAction(values: unknown, tabId?: string): Promise<PriceBookItem> {
  const session = await requireOfficeSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");
  const parsed = priceBookItemSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const item = await createPriceBookItem(session.organizationId, {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    category: parsed.data.category ?? null,
    articleNumber: parsed.data.articleNumber ?? null,
    unit: parsed.data.unit ?? null,
    unitPrice: parsed.data.unitPrice,
    isActive: parsed.data.isActive,
    sortOrder: parsed.data.sortOrder,
  });
  await publishPriceBookChanged(session.organizationId, tabId);
  return item;
}

export async function updatePriceBookItemAction(values: unknown, tabId?: string): Promise<PriceBookItem> {
  const session = await requireOfficeSession();
  const parsed = priceBookItemUpdateSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const item = await updatePriceBookItem(parsed.data.id, {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    category: parsed.data.category ?? null,
    articleNumber: parsed.data.articleNumber ?? null,
    unit: parsed.data.unit ?? null,
    unitPrice: parsed.data.unitPrice,
    isActive: parsed.data.isActive,
    sortOrder: parsed.data.sortOrder,
  });
  await publishPriceBookChanged(session.organizationId, tabId);
  return item;
}

export async function deletePriceBookItemAction(itemId: string, tabId?: string): Promise<{ ok: true }> {
  const session = await requireOfficeSession();
  if (!itemId) throw new Error("Positions-ID fehlt.");
  await deletePriceBookItem(itemId);
  await publishPriceBookChanged(session.organizationId, tabId);
  return { ok: true };
}
