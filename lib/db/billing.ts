import "server-only";

import { cache } from "react";
import type { OrganizationBillingSettings } from "@/lib/domain/types";
import { normalizeIban } from "@/lib/qr-bill/iban";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BILLING_DB_COLUMNS =
  "billing_iban, billing_creditor_name, billing_creditor_street, billing_creditor_building_number, billing_creditor_postal_code, billing_creditor_city, billing_vat_number";

function s(v: unknown): string | null {
  return v != null && String(v).trim() ? String(v).trim() : null;
}

function mapBillingRow(row: Record<string, unknown>): OrganizationBillingSettings {
  return {
    iban: s(row.billing_iban),
    creditorName: s(row.billing_creditor_name),
    creditorStreet: s(row.billing_creditor_street),
    creditorBuildingNumber: s(row.billing_creditor_building_number),
    creditorPostalCode: s(row.billing_creditor_postal_code),
    creditorCity: s(row.billing_creditor_city),
    vatNumber: s(row.billing_vat_number),
  };
}

export const getOrganizationBillingSettings = cache(async function getOrganizationBillingSettings(
  organizationId: string,
): Promise<OrganizationBillingSettings | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("organizations")
    .select(BILLING_DB_COLUMNS)
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return mapBillingRow(data as Record<string, unknown>);
});

export async function updateOrganizationBillingSettings(
  organizationId: string,
  input: OrganizationBillingSettings,
): Promise<OrganizationBillingSettings> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data, error } = await supabase
    .from("organizations")
    .update({
      billing_iban: input.iban ? normalizeIban(input.iban) : null,
      billing_creditor_name: input.creditorName,
      billing_creditor_street: input.creditorStreet,
      billing_creditor_building_number: input.creditorBuildingNumber,
      billing_creditor_postal_code: input.creditorPostalCode,
      billing_creditor_city: input.creditorCity,
      billing_vat_number: input.vatNumber,
    })
    .eq("id", organizationId)
    .select(BILLING_DB_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organisation nicht gefunden oder keine Berechtigung.");
  return mapBillingRow(data as Record<string, unknown>);
}
