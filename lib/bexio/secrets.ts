import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * organization_secrets ist Deny-all (kein RLS-Zugriff für anon/authenticated) —
 * nur über den Service-Role-Client erreichbar. Der Bexio-Token verlässt so nie
 * den Browser; das Einstellungs-Feld ist write-only.
 */
const BEXIO_TOKEN_KEY = "bexio_api_token";

export async function getBexioToken(organizationId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("organization_secrets")
    .select("value")
    .eq("organization_id", organizationId)
    .eq("key", BEXIO_TOKEN_KEY)
    .maybeSingle();
  if (error || !data) return null;
  return (data.value as string) ?? null;
}

export async function setBexioToken(
  organizationId: string,
  token: string,
  updatedBy: string | null,
  updatedByDisplayName: string | null,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase Service-Role ist nicht konfiguriert.");

  const { error } = await admin.from("organization_secrets").upsert(
    {
      organization_id: organizationId,
      key: BEXIO_TOKEN_KEY,
      value: token,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
      updated_by_display_name: updatedByDisplayName,
    },
    { onConflict: "organization_id,key" },
  );
  if (error) throw new Error(error.message);
}

export async function clearBexioToken(organizationId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase Service-Role ist nicht konfiguriert.");

  const { error } = await admin
    .from("organization_secrets")
    .delete()
    .eq("organization_id", organizationId)
    .eq("key", BEXIO_TOKEN_KEY);
  if (error) throw new Error(error.message);
}
