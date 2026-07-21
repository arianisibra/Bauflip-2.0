import "server-only";

import { parseIcsBusyIntervals } from "@/lib/calendar/busy-ics";
import { fetchIcsText } from "@/lib/calendar/fetch-ics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BusyCalendarConfig = {
  icsUrl: string | null;
  enabled: boolean;
  syncedAt: string | null;
  syncError: string | null;
};

export type BusyEventRow = { technicianId: string; startsAt: string; endsAt: string };

const DAY_MS = 86_400_000;
const SYNC_PAST_MS = DAY_MS; // laufende Termine von gestern noch berücksichtigen
const SYNC_FUTURE_MS = 8 * 7 * DAY_MS; // 8 Wochen voraus

const EMPTY: BusyCalendarConfig = { icsUrl: null, enabled: false, syncedAt: null, syncError: null };

/** Eigene Kalender-Konfig (RLS: nur Eigentümer). */
export async function getBusyCalendarConfig(technicianId: string): Promise<BusyCalendarConfig> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return EMPTY;
  const { data, error } = await supabase
    .from("technician_busy_calendar")
    .select("ics_url, enabled, synced_at, sync_error")
    .eq("technician_id", technicianId)
    .maybeSingle();
  if (error || !data) return EMPTY;
  const row = data as Record<string, unknown>;
  return {
    icsUrl: row.ics_url != null ? String(row.ics_url) : null,
    enabled: row.enabled === true,
    syncedAt: row.synced_at != null ? String(row.synced_at) : null,
    syncError: row.sync_error != null ? String(row.sync_error) : null,
  };
}

/** URL/Enable speichern (RLS: Eigentümer). Setzt sync_error zurück. */
export async function saveBusyCalendarConfig(
  technicianId: string,
  input: { icsUrl: string | null; enabled: boolean },
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");
  const { error } = await supabase
    .from("technician_busy_calendar")
    .upsert(
      {
        technician_id: technicianId,
        ics_url: input.icsUrl,
        enabled: input.enabled,
        sync_error: null,
      },
      { onConflict: "technician_id" },
    );
  if (error) throw new Error(error.message);
}

async function setSyncStatus(technicianId: string, syncError: string | null): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  await supabase
    .from("technician_busy_calendar")
    .update({ synced_at: new Date().toISOString(), sync_error: syncError })
    .eq("technician_id", technicianId);
}

/**
 * Holt den Feed, parst das 8-Wochen-Fenster und ersetzt den Cache (service_role).
 * Wirft bei Fehlern; der Aufrufer zeigt die Meldung. sync_error wird gespeichert.
 */
export async function syncBusyCalendar(
  technicianId: string,
  organizationId: string,
  icsUrl: string,
): Promise<number> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Sync nicht verfügbar (Service-Role fehlt).");

  try {
    const text = await fetchIcsText(icsUrl);
    const now = Date.now();
    const intervals = parseIcsBusyIntervals(text, now - SYNC_PAST_MS, now + SYNC_FUTURE_MS);

    // Cache atomar ersetzen: alt weg, neu rein.
    const del = await admin.from("technician_busy_events").delete().eq("technician_id", technicianId);
    if (del.error) throw new Error(del.error.message);

    if (intervals.length > 0) {
      const rows = intervals.map((iv) => ({
        technician_id: technicianId,
        organization_id: organizationId,
        starts_at: new Date(iv.startMs).toISOString(),
        ends_at: new Date(iv.endMs).toISOString(),
      }));
      const ins = await admin.from("technician_busy_events").insert(rows);
      if (ins.error) throw new Error(ins.error.message);
    }

    await setSyncStatus(technicianId, null);
    return intervals.length;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync fehlgeschlagen.";
    await setSyncStatus(technicianId, message);
    throw e instanceof Error ? e : new Error(message);
  }
}

/** Cache leeren (wenn deaktiviert/URL entfernt). */
export async function clearBusyEvents(technicianId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("technician_busy_events").delete().eq("technician_id", technicianId);
}

/** Busy-Zeiten aller Monteure der Org im Bereich (RLS: Büro/Admin bzw. eigene). */
export async function getBusyEventsForOrgRange(
  organizationId: string,
  startIso: string,
  endIso: string,
): Promise<BusyEventRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("technician_busy_events")
    .select("technician_id, starts_at, ends_at")
    .eq("organization_id", organizationId)
    .lt("starts_at", endIso)
    .gt("ends_at", startIso);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    technicianId: String(row.technician_id),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
  }));
}
