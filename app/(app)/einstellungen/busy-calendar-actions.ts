"use server";

import { requireOrgLayoutSession } from "@/lib/auth/organization";
import {
  clearBusyEvents,
  getBusyCalendarConfig,
  saveBusyCalendarConfig,
  syncBusyCalendar,
  type BusyCalendarConfig,
} from "@/lib/db/busy-calendar";

/** Aktuellen Stand des eigenen privaten Kalenders lesen. */
export async function getBusyCalendarStatusAction(): Promise<BusyCalendarConfig> {
  const session = await requireOrgLayoutSession();
  return getBusyCalendarConfig(session.userId);
}

/** URL + Opt-in speichern; danach best-effort synchronisieren (Fehler landet in sync_error). */
export async function saveBusyCalendarAction(input: {
  icsUrl: string | null;
  enabled: boolean;
}): Promise<BusyCalendarConfig> {
  const session = await requireOrgLayoutSession();

  const url = (input.icsUrl ?? "").trim();
  if (url.length > 2000) throw new Error("URL ist zu lang.");
  if (url && !/^https:\/\//i.test(url)) throw new Error("Bitte eine https-URL des Kalender-Abos einfügen.");
  const enabled = Boolean(input.enabled) && url.length > 0;

  await saveBusyCalendarConfig(session.userId, { icsUrl: url || null, enabled });

  if (enabled && url) {
    try {
      await syncBusyCalendar(session.userId, session.organizationId, url);
    } catch {
      // Fehler ist in sync_error gespeichert — Speichern selbst gilt trotzdem.
    }
  } else {
    await clearBusyEvents(session.userId);
  }

  return getBusyCalendarConfig(session.userId);
}

/** Manueller «Jetzt aktualisieren»-Sync. */
export async function syncBusyCalendarAction(): Promise<BusyCalendarConfig> {
  const session = await requireOrgLayoutSession();
  const config = await getBusyCalendarConfig(session.userId);
  if (config.enabled && config.icsUrl) {
    try {
      await syncBusyCalendar(session.userId, session.organizationId, config.icsUrl);
    } catch {
      // sync_error ist gesetzt.
    }
  }
  return getBusyCalendarConfig(session.userId);
}
