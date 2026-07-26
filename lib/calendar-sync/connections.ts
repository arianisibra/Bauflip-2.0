import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CalendarProvider, OAuthTokens } from "@/lib/calendar-sync/types";

export type CalendarConnection = {
  provider: CalendarProvider;
  connectedAt: string;
  syncError: string | null;
};

/** Verbindungen des eingeloggten Nutzers (eigenes Profil, Einstellungen). */
export async function getMyCalendarConnections(): Promise<CalendarConnection[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("technician_calendar_connections")
    .select("provider, connected_at, sync_error")
    .eq("technician_id", user.id);
  if (error || !data) return [];
  return (data as { provider: CalendarProvider; connected_at: string; sync_error: string | null }[]).map((r) => ({
    provider: r.provider,
    connectedAt: r.connected_at,
    syncError: r.sync_error,
  }));
}

export async function saveMyCalendarConnection(provider: CalendarProvider, tokens: OAuthTokens): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const { error } = await supabase.from("technician_calendar_connections").upsert(
    {
      technician_id: user.id,
      provider,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
      sync_error: null,
    },
    { onConflict: "technician_id,provider" },
  );
  if (error) throw new Error(error.message);
}

export async function deleteMyCalendarConnection(provider: CalendarProvider): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const { error } = await supabase
    .from("technician_calendar_connections")
    .delete()
    .eq("technician_id", user.id)
    .eq("provider", provider);
  if (error) throw new Error(error.message);
}

type ConnectionRow = {
  provider: CalendarProvider;
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

/** Alle Verbindungen einer Person — Service-Role, für den Sync im Anschluss an Termin-Mutationen. */
export async function getCalendarConnectionsForTechnician(technicianId: string): Promise<ConnectionRow[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("technician_calendar_connections")
    .select("provider, access_token, refresh_token, expires_at")
    .eq("technician_id", technicianId);
  if (error || !data) return [];
  return data as ConnectionRow[];
}

export async function updateStoredTokens(
  technicianId: string,
  provider: CalendarProvider,
  tokens: { accessToken: string; refreshToken?: string; expiresAt: string },
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const patch: Record<string, string> = { access_token: tokens.accessToken, expires_at: tokens.expiresAt };
  if (tokens.refreshToken) patch.refresh_token = tokens.refreshToken;
  await admin
    .from("technician_calendar_connections")
    .update(patch)
    .eq("technician_id", technicianId)
    .eq("provider", provider);
}

export async function markConnectionError(
  technicianId: string,
  provider: CalendarProvider,
  message: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("technician_calendar_connections")
    .update({ sync_error: message.slice(0, 300) })
    .eq("technician_id", technicianId)
    .eq("provider", provider);
}
