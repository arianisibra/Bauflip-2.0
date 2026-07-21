"use server";

import { getOfficeSessionOrNull } from "@/lib/auth/organization";
import { listAvailabilityForRange } from "@/lib/db/repository";
import type { BusyBlock } from "@/lib/calendar/availability-conflicts";
import type { TechnicianAbsence, UserProfile, WeekTaskItem } from "@/lib/domain/types";

export type AvailabilityBundle = {
  technicians: UserProfile[];
  appointments: WeekTaskItem[];
  absences: TechnicianAbsence[];
  externalBusy: BusyBlock[];
};

const EMPTY: AvailabilityBundle = { technicians: [], appointments: [], absences: [], externalBusy: [] };

/** Office/Admin: Verfügbarkeit aller Monteure im Bereich (Termine + Abwesenheiten). */
export async function fetchAvailabilityRangeAction(
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<AvailabilityBundle> {
  const session = await getOfficeSessionOrNull();
  if (!session) {
    return EMPTY;
  }
  return listAvailabilityForRange(rangeStartIso, rangeEndIso);
}
