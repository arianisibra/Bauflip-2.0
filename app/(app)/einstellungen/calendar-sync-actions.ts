"use server";

import { requireOrgLayoutSession } from "@/lib/auth/organization";
import { deleteMyCalendarConnection, getMyCalendarConnections, type CalendarConnection } from "@/lib/calendar-sync/connections";
import { isGoogleCalendarConfigured } from "@/lib/calendar-sync/google";
import { isMicrosoftCalendarConfigured } from "@/lib/calendar-sync/microsoft";

export type CalendarSyncSettings = {
  connections: CalendarConnection[];
  googleAvailable: boolean;
  microsoftAvailable: boolean;
};

export async function getCalendarSyncSettingsAction(): Promise<CalendarSyncSettings> {
  await requireOrgLayoutSession();
  return {
    connections: await getMyCalendarConnections(),
    googleAvailable: isGoogleCalendarConfigured(),
    microsoftAvailable: isMicrosoftCalendarConfigured(),
  };
}

export async function disconnectCalendarSyncAction(provider: "google" | "microsoft"): Promise<void> {
  await requireOrgLayoutSession();
  await deleteMyCalendarConnection(provider);
}
