import "server-only";

import { cache } from "react";
import type { BexioSettings } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BEXIO_DB_COLUMNS = "bexio_connected_at, bexio_tax_id, bexio_account_id";

function mapBexioRow(row: Record<string, unknown>): BexioSettings {
  return {
    connected: Boolean(row.bexio_connected_at),
    connectedAt: (row.bexio_connected_at as string) ?? null,
    taxId: (row.bexio_tax_id as number) ?? null,
    accountId: (row.bexio_account_id as number) ?? null,
  };
}

export const getBexioSettings = cache(async function getBexioSettings(
  organizationId: string,
): Promise<BexioSettings | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("organizations")
    .select(BEXIO_DB_COLUMNS)
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return mapBexioRow(data as Record<string, unknown>);
});

export async function markBexioConnected(organizationId: string): Promise<BexioSettings> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data, error } = await supabase
    .from("organizations")
    .update({ bexio_connected_at: new Date().toISOString() })
    .eq("id", organizationId)
    .select(BEXIO_DB_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organisation nicht gefunden oder keine Berechtigung.");
  return mapBexioRow(data as Record<string, unknown>);
}

export async function setBexioMapping(
  organizationId: string,
  taxId: number | null,
  accountId: number | null,
): Promise<BexioSettings> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data, error } = await supabase
    .from("organizations")
    .update({ bexio_tax_id: taxId, bexio_account_id: accountId })
    .eq("id", organizationId)
    .select(BEXIO_DB_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organisation nicht gefunden oder keine Berechtigung.");
  return mapBexioRow(data as Record<string, unknown>);
}

export async function markBexioDisconnected(organizationId: string): Promise<BexioSettings> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data, error } = await supabase
    .from("organizations")
    .update({ bexio_connected_at: null, bexio_tax_id: null, bexio_account_id: null })
    .eq("id", organizationId)
    .select(BEXIO_DB_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organisation nicht gefunden oder keine Berechtigung.");
  return mapBexioRow(data as Record<string, unknown>);
}
