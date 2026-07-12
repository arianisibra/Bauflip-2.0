import "server-only";

import { cache } from "react";
import type { PaymentImport } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAYMENT_IMPORT_DB_COLUMNS =
  "id, organization_id, filename, imported_by, imported_by_display_name, entries_total, entries_matched, entries_already_paid, entries_amount_mismatch, entries_unmatched, created_at";

function mapPaymentImportRow(row: Record<string, unknown>): PaymentImport {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? ""),
    filename: String(row.filename ?? ""),
    importedByProfileId: row.imported_by != null ? String(row.imported_by) : null,
    importedByDisplayName:
      row.imported_by_display_name != null && String(row.imported_by_display_name).trim()
        ? String(row.imported_by_display_name).trim()
        : null,
    entriesTotal: Number(row.entries_total ?? 0),
    entriesMatched: Number(row.entries_matched ?? 0),
    entriesAlreadyPaid: Number(row.entries_already_paid ?? 0),
    entriesAmountMismatch: Number(row.entries_amount_mismatch ?? 0),
    entriesUnmatched: Number(row.entries_unmatched ?? 0),
    createdAt: String(row.created_at ?? ""),
  };
}

/** Import-Historie (neueste zuerst) — reine Protokoll-Ansicht, keine Datei-Inhalte. */
export const listPaymentImportsForOrg = cache(async function listPaymentImportsForOrg(
  organizationId: string,
): Promise<PaymentImport[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("payment_imports")
    .select(PAYMENT_IMPORT_DB_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapPaymentImportRow);
});

export type PaymentImportLogInput = {
  filename: string;
  importedByProfileId: string | null;
  importedByDisplayName: string | null;
  entriesTotal: number;
  entriesMatched: number;
  entriesAlreadyPaid: number;
  entriesAmountMismatch: number;
  entriesUnmatched: number;
};

export async function createPaymentImportLog(
  organizationId: string,
  input: PaymentImportLogInput,
): Promise<PaymentImport> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data, error } = await supabase
    .from("payment_imports")
    .insert({
      organization_id: organizationId,
      filename: input.filename,
      imported_by: input.importedByProfileId,
      imported_by_display_name: input.importedByDisplayName,
      entries_total: input.entriesTotal,
      entries_matched: input.entriesMatched,
      entries_already_paid: input.entriesAlreadyPaid,
      entries_amount_mismatch: input.entriesAmountMismatch,
      entries_unmatched: input.entriesUnmatched,
    })
    .select(PAYMENT_IMPORT_DB_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Import-Protokoll konnte nicht gespeichert werden.");
  return mapPaymentImportRow(data as Record<string, unknown>);
}
