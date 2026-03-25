import type { Appointment, UserProfile } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createGoogleCalendarEventFromRefresh } from "@/lib/calendar/google-calendar-api";
import { createMicrosoftCalendarEventFromRefresh } from "@/lib/calendar/microsoft-calendar-api";

/**
 * Legt den Termin im Google- bzw. Outlook-Kalender des Monteurs an, wenn OAuth verbunden ist.
 */
export async function syncExternalCalendars(params: {
  appointment: Appointment;
  projectTitle: string;
  technician: UserProfile;
}): Promise<void> {
  const { appointment, projectTitle, technician } = params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return;
  }

  const { data } = await supabase
    .from("calendar_provider_tokens")
    .select("provider, refresh_token")
    .eq("profile_id", technician.id);

  const summary = `Bauflip: ${projectTitle}`;
  const description = `Termin (${appointment.kind}). Projekt-ID: ${appointment.projectId}`;

  for (const row of data ?? []) {
    const r = row as { provider: string; refresh_token: string };
    try {
      if (r.provider === "google") {
        await createGoogleCalendarEventFromRefresh(r.refresh_token, {
          summary,
          description,
          start: appointment.startsAt,
          end: appointment.endsAt,
        });
      } else if (r.provider === "microsoft") {
        await createMicrosoftCalendarEventFromRefresh(r.refresh_token, {
          summary,
          description,
          start: appointment.startsAt,
          end: appointment.endsAt,
        });
      }
    } catch {
      /* nicht blockieren */
    }
  }
}
