import "server-only";

import type { CalendarEventInput, CalendarProvider } from "@/lib/calendar-sync/types";
import { getCalendarConnectionsForTechnician, markConnectionError, updateStoredTokens } from "@/lib/calendar-sync/connections";
import { deleteAllEventMappingsForAppointment, deleteEventMapping, getEventMappings, saveEventMapping } from "@/lib/calendar-sync/events";
import { createGoogleEvent, deleteGoogleEvent, refreshGoogleToken, updateGoogleEvent } from "@/lib/calendar-sync/google";
import {
  createMicrosoftEvent,
  deleteMicrosoftEvent,
  refreshMicrosoftToken,
  updateMicrosoftEvent,
} from "@/lib/calendar-sync/microsoft";

/**
 * Termine ins persönliche Google/Microsoft-Kalender der zugeteilten Person
 * pushen. Best-effort: jeder Fehler wird geschluckt (Fehlermeldung landet in
 * technician_calendar_connections.sync_error) — der Push darf nie eine
 * Termin-Mutation zum Scheitern bringen.
 */

async function accessTokenFor(
  technicianId: string,
  provider: CalendarProvider,
  token: { accessToken: string; refreshToken: string; expiresAt: string },
): Promise<string> {
  const expiresInMs = new Date(token.expiresAt).getTime() - Date.now();
  if (expiresInMs > 60_000) return token.accessToken;

  if (provider === "google") {
    const refreshed = await refreshGoogleToken(token.refreshToken);
    await updateStoredTokens(technicianId, provider, refreshed);
    return refreshed.accessToken;
  }
  const refreshed = await refreshMicrosoftToken(token.refreshToken);
  await updateStoredTokens(technicianId, provider, refreshed);
  return refreshed.accessToken;
}

async function createRemoteEvent(provider: CalendarProvider, accessToken: string, input: CalendarEventInput) {
  return provider === "google" ? createGoogleEvent(accessToken, input) : createMicrosoftEvent(accessToken, input);
}

async function updateRemoteEvent(
  provider: CalendarProvider,
  accessToken: string,
  eventId: string,
  input: CalendarEventInput,
) {
  if (provider === "google") return updateGoogleEvent(accessToken, eventId, input);
  return updateMicrosoftEvent(accessToken, eventId, input);
}

async function deleteRemoteEvent(provider: CalendarProvider, accessToken: string, eventId: string) {
  if (provider === "google") return deleteGoogleEvent(accessToken, eventId);
  return deleteMicrosoftEvent(accessToken, eventId);
}

/**
 * Gleicht die externen Kalender-Events eines Termins mit dem Soll-Zustand ab:
 * legt fehlende an, aktualisiert bestehende, entfernt verwaiste (z. B. nach
 * Monteur-Wechsel). `technicianIds` = die aktuell zugeteilten Personen (leer
 * bei einem gelöschten Termin → alles wird entfernt).
 */
export async function reconcileAppointmentCalendarSync(
  appointmentId: string,
  technicianIds: string[],
  eventInput: CalendarEventInput,
): Promise<void> {
  try {
    const targetIds = new Set(technicianIds.filter(Boolean));
    const mappings = await getEventMappings(appointmentId);

    const orphaned = mappings.filter((m) => !targetIds.has(m.technician_id));
    await Promise.all(
      orphaned.map(async (mapping) => {
        const connections = await getCalendarConnectionsForTechnician(mapping.technician_id);
        const conn = connections.find((c) => c.provider === mapping.provider);
        if (conn) {
          try {
            const accessToken = await accessTokenFor(mapping.technician_id, mapping.provider, {
              accessToken: conn.access_token,
              refreshToken: conn.refresh_token,
              expiresAt: conn.expires_at,
            });
            await deleteRemoteEvent(mapping.provider, accessToken, mapping.external_event_id);
          } catch {
            // Best-effort — verwaistes externes Event bleibt notfalls stehen.
          }
        }
        await deleteEventMapping(mapping.id);
      }),
    );

    await Promise.all(
      [...targetIds].map(async (technicianId) => {
        const connections = await getCalendarConnectionsForTechnician(technicianId);
        await Promise.all(
          connections.map(async (conn) => {
            const existing = mappings.find(
              (m) => m.technician_id === technicianId && m.provider === conn.provider,
            );
            try {
              const accessToken = await accessTokenFor(technicianId, conn.provider, {
                accessToken: conn.access_token,
                refreshToken: conn.refresh_token,
                expiresAt: conn.expires_at,
              });
              if (existing) {
                await updateRemoteEvent(conn.provider, accessToken, existing.external_event_id, eventInput);
              } else {
                const externalEventId = await createRemoteEvent(conn.provider, accessToken, eventInput);
                await saveEventMapping(appointmentId, technicianId, conn.provider, externalEventId);
              }
            } catch (e) {
              await markConnectionError(
                technicianId,
                conn.provider,
                e instanceof Error ? e.message : "Kalender-Sync fehlgeschlagen.",
              );
            }
          }),
        );
      }),
    );
  } catch {
    // Sync darf die aufrufende Termin-Mutation nie zum Scheitern bringen.
  }
}

export async function removeAppointmentFromCalendars(appointmentId: string): Promise<void> {
  try {
    const mappings = await getEventMappings(appointmentId);
    await Promise.all(
      mappings.map(async (mapping) => {
        const connections = await getCalendarConnectionsForTechnician(mapping.technician_id);
        const conn = connections.find((c) => c.provider === mapping.provider);
        if (conn) {
          try {
            const accessToken = await accessTokenFor(mapping.technician_id, mapping.provider, {
              accessToken: conn.access_token,
              refreshToken: conn.refresh_token,
              expiresAt: conn.expires_at,
            });
            await deleteRemoteEvent(mapping.provider, accessToken, mapping.external_event_id);
          } catch {
            // Best-effort.
          }
        }
      }),
    );
    await deleteAllEventMappingsForAppointment(appointmentId);
  } catch {
    // Sync darf die aufrufende Termin-Mutation nie zum Scheitern bringen.
  }
}
