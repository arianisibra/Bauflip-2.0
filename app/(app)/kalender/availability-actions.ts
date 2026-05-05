"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { listAvailabilityForRange } from "@/lib/db/repository";
import type { TechnicianAbsence, UserProfile, WeekTaskItem } from "@/lib/domain/types";

export type AvailabilityBundle = {
  technicians: UserProfile[];
  appointments: WeekTaskItem[];
  absences: TechnicianAbsence[];
};

const EMPTY: AvailabilityBundle = { technicians: [], appointments: [], absences: [] };

/** Office/Admin: Verfügbarkeit aller Monteure im Bereich (Termine + Abwesenheiten). */
export async function fetchAvailabilityRangeAction(
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<AvailabilityBundle> {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    return EMPTY;
  }
  return listAvailabilityForRange(rangeStartIso, rangeEndIso);
}
