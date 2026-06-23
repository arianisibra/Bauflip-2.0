"use server";

import { getOfficeSessionOrNull } from "@/lib/auth/organization";
import { listCalendarRangeTasks } from "@/lib/db/repository";
import type { WeekTaskItem } from "@/lib/domain/types";

export async function fetchCalendarRangeTasksAction(
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<WeekTaskItem[]> {
  const session = await getOfficeSessionOrNull();
  if (!session) return [];
  return listCalendarRangeTasks(rangeStartIso, rangeEndIso);
}
