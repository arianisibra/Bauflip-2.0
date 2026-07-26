import "server-only";

import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function newToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Intake-E-Mail-Token der Org (Einstellungen-Anzeige). */
export const getIntakeEmailToken = cache(async function getIntakeEmailToken(
  organizationId: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("organizations")
    .select("intake_email_token")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { intake_email_token: string }).intake_email_token;
});

/** Regeneriert den Token — die alte Intake-Adresse funktioniert danach nicht mehr. */
export async function regenerateIntakeEmailToken(organizationId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");
  const token = newToken();
  const { data, error } = await supabase
    .from("organizations")
    .update({ intake_email_token: token })
    .eq("id", organizationId)
    .select("intake_email_token")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organisation nicht gefunden oder keine Berechtigung.");
  return (data as { intake_email_token: string }).intake_email_token;
}

/**
 * Löst den Token aus der eingehenden Intake-Adresse (intake+<token>@…) auf eine
 * Org auf — läuft ohne Session (Inbound-Webhook), daher Service-Role-Client.
 * Der Token ist selbst die Authentisierung (unguessable Capability-URL, analog
 * den ICS-Busy-Sync-URLs); es gibt bewusst kein zusätzliches Shared Secret.
 */
export async function getOrganizationIdByIntakeEmailToken(token: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .eq("intake_email_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}
