import "server-only";

import { cache } from "react";
import type { TextSnippet } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TEXT_SNIPPET_DB_COLUMNS = "id, organization_id, title, body, is_active, sort_order";

function mapTextSnippetRow(row: Record<string, unknown>): TextSnippet {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? ""),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

/** Alle Textbausteine der Organisation (Verwaltung: inkl. inaktive). */
export const listTextSnippetsForOrg = cache(async function listTextSnippetsForOrg(
  organizationId: string,
): Promise<TextSnippet[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("text_snippets")
    .select(TEXT_SNIPPET_DB_COLUMNS)
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapTextSnippetRow);
});

export type TextSnippetCreateInput = {
  title: string;
  body: string;
  isActive?: boolean;
  sortOrder?: number;
};

export async function createTextSnippet(
  organizationId: string,
  input: TextSnippetCreateInput,
): Promise<TextSnippet> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data, error } = await supabase
    .from("text_snippets")
    .insert({
      organization_id: organizationId,
      title: input.title,
      body: input.body,
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
    })
    .select(TEXT_SNIPPET_DB_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Textbaustein konnte nicht gespeichert werden.");
  }
  return mapTextSnippetRow(data as Record<string, unknown>);
}

export async function updateTextSnippet(
  snippetId: string,
  input: TextSnippetCreateInput,
): Promise<TextSnippet> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data, error } = await supabase
    .from("text_snippets")
    .update({
      title: input.title,
      body: input.body,
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
    })
    .eq("id", snippetId)
    .select(TEXT_SNIPPET_DB_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Textbaustein nicht gefunden.");
  return mapTextSnippetRow(data as Record<string, unknown>);
}

export async function deleteTextSnippet(snippetId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");
  const { error } = await supabase.from("text_snippets").delete().eq("id", snippetId);
  if (error) throw new Error(error.message);
}
