import "server-only";

import { cache } from "react";
import type { PriceBookItem } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PRICE_BOOK_DB_COLUMNS =
  "id, organization_id, name, description, category, article_number, unit, unit_price, is_active, sort_order";

function cleanText(value: unknown): string | null {
  return value != null && String(value).trim() ? String(value).trim() : null;
}

function mapPriceBookItemRow(row: Record<string, unknown>): PriceBookItem {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? ""),
    name: String(row.name ?? ""),
    description: cleanText(row.description),
    category: cleanText(row.category),
    articleNumber: cleanText(row.article_number),
    unit: cleanText(row.unit),
    unitPrice: Number(row.unit_price ?? 0),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

/** Alle Preisstamm-Positionen der Organisation (Verwaltung: inkl. inaktive). */
export const listPriceBookItemsForOrg = cache(async function listPriceBookItemsForOrg(
  organizationId: string,
): Promise<PriceBookItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("price_book_items")
    .select(PRICE_BOOK_DB_COLUMNS)
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapPriceBookItemRow);
});

export type PriceBookItemCreateInput = {
  name: string;
  description?: string | null;
  category?: string | null;
  articleNumber?: string | null;
  unit: string | null;
  unitPrice: number;
  isActive?: boolean;
  sortOrder?: number;
};

export async function createPriceBookItem(
  organizationId: string,
  input: PriceBookItemCreateInput,
): Promise<PriceBookItem> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data, error } = await supabase
    .from("price_book_items")
    .insert({
      organization_id: organizationId,
      name: input.name,
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      article_number: input.articleNumber?.trim() || null,
      unit: input.unit?.trim() || null,
      unit_price: input.unitPrice,
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
    })
    .select(PRICE_BOOK_DB_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Position konnte nicht gespeichert werden.");
  }
  return mapPriceBookItemRow(data as Record<string, unknown>);
}

export async function updatePriceBookItem(
  itemId: string,
  input: PriceBookItemCreateInput,
): Promise<PriceBookItem> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data, error } = await supabase
    .from("price_book_items")
    .update({
      name: input.name,
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      article_number: input.articleNumber?.trim() || null,
      unit: input.unit?.trim() || null,
      unit_price: input.unitPrice,
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
    })
    .eq("id", itemId)
    .select(PRICE_BOOK_DB_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Position nicht gefunden.");
  return mapPriceBookItemRow(data as Record<string, unknown>);
}

export async function deletePriceBookItem(itemId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");
  const { error } = await supabase.from("price_book_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
}
