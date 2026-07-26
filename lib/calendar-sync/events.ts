import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CalendarProvider } from "@/lib/calendar-sync/types";

type EventMappingRow = {
  id: string;
  technician_id: string;
  provider: CalendarProvider;
  external_event_id: string;
};

export async function getEventMappings(appointmentId: string): Promise<EventMappingRow[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("appointment_calendar_events")
    .select("id, technician_id, provider, external_event_id")
    .eq("appointment_id", appointmentId);
  if (error || !data) return [];
  return data as EventMappingRow[];
}

export async function saveEventMapping(
  appointmentId: string,
  technicianId: string,
  provider: CalendarProvider,
  externalEventId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("appointment_calendar_events").upsert(
    {
      appointment_id: appointmentId,
      technician_id: technicianId,
      provider,
      external_event_id: externalEventId,
    },
    { onConflict: "appointment_id,technician_id,provider" },
  );
}

export async function deleteEventMapping(mappingId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("appointment_calendar_events").delete().eq("id", mappingId);
}

export async function deleteAllEventMappingsForAppointment(appointmentId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("appointment_calendar_events").delete().eq("appointment_id", appointmentId);
}
