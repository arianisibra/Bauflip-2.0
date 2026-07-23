import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Erstes-Einrichten-Status einer Organisation (Onboarding-Wizard).
 * `false` bei fehlender Org / Fehler — im Zweifel keinen Wizard zeigen,
 * damit ein DB-Problem nie den normalen App-Zugang blockiert.
 */
export const isOrganizationOnboardingPending = cache(async function isOrganizationOnboardingPending(
  organizationId: string | null,
): Promise<boolean> {
  if (!organizationId) return false;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("organizations")
    .select("onboarding_completed_at")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) return false;
  return data.onboarding_completed_at == null;
});

export async function completeOrganizationOnboarding(organizationId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Keine Datenbankverbindung.");
  const { error } = await supabase
    .from("organizations")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", organizationId);
  if (error) throw new Error(error.message);
}

export async function updateOrganizationName(organizationId: string, name: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Keine Datenbankverbindung.");
  const { error } = await supabase.from("organizations").update({ name }).eq("id", organizationId);
  if (error) throw new Error(error.message);
}
