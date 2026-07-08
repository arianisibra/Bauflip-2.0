"use server";

import { requireTechFieldSession } from "@/lib/auth/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Termin-Einladungen (iCal-Mail) für den eigenen Account an/aus — alle Rollen. */
export async function getInvitePreferenceAction(): Promise<{ enabled: boolean }> {
  const session = await requireTechFieldSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { enabled: true };

  const { data } = await supabase
    .from("profiles")
    .select("appointment_invites_enabled")
    .eq("id", session.userId)
    .maybeSingle();
  return {
    enabled:
      (data as { appointment_invites_enabled?: boolean | null } | null)
        ?.appointment_invites_enabled !== false,
  };
}

export async function setInvitePreferenceAction(enabled: boolean): Promise<{ enabled: boolean }> {
  const session = await requireTechFieldSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { error } = await supabase
    .from("profiles")
    .update({ appointment_invites_enabled: enabled === true })
    .eq("id", session.userId);
  if (error) throw new Error(error.message);
  return { enabled: enabled === true };
}
