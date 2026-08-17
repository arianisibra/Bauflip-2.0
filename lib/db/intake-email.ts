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

/**
 * Atomarer Claim einer Postmark-Message-ID vor dem Anlegen des Projekts
 * (Fund "E-Mail-Intake ohne Idempotenz", Audit 2). Postmark liefert bei
 * Zeitüberschreitung erneut zu — ohne diesen Claim entstünde pro Wiederholung
 * ein weiterer Projektentwurf. `on conflict do nothing` ist atomar: bei
 * gleichzeitigen/wiederholten Zustellungen gewinnt genau ein Aufruf.
 */
export async function claimIntakeEmailMessage(
  messageId: string,
  organizationId: string,
): Promise<{ claimed: true } | { claimed: false; existingProjectId: string | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Service-Role nicht verfügbar.");

  const { data, error } = await admin
    .from("intake_email_dedupe")
    .insert({ message_id: messageId, organization_id: organizationId })
    .select("message_id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await admin
        .from("intake_email_dedupe")
        .select("project_id")
        .eq("message_id", messageId)
        .maybeSingle();
      return { claimed: false, existingProjectId: (existing?.project_id as string | null) ?? null };
    }
    throw new Error(error.message);
  }
  return data ? { claimed: true } : { claimed: false, existingProjectId: null };
}

/** Trägt die entstandene Projekt-ID beim geclaimten Dedupe-Eintrag nach. */
export async function recordIntakeEmailProject(messageId: string, projectId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("intake_email_dedupe").update({ project_id: projectId }).eq("message_id", messageId);
}

/**
 * Gibt einen Claim wieder frei, wenn das Anlegen des Projekts fehlschlug —
 * sonst würde ein Postmark-Retry auf einen bereits "vergebenen", aber nie
 * eingelösten Claim treffen und dauerhaft leer laufen.
 */
export async function releaseIntakeEmailClaim(messageId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("intake_email_dedupe").delete().eq("message_id", messageId).is("project_id", null);
}
