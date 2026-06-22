"use server";

import { getOfficeSessionOrNull } from "@/lib/auth/organization";
import { listCalendarRangeTasks, listMonthTasks } from "@/lib/db/repository";
import type { WeekTaskItem } from "@/lib/domain/types";

export async function fetchMonthTasksAction(
  year: number,
  month: number,
): Promise<WeekTaskItem[]> {
  const session = await getOfficeSessionOrNull();
  if (!session) return [];
  return listMonthTasks(year, month);
}

export async function fetchCalendarRangeTasksAction(
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<WeekTaskItem[]> {
  const session = await getOfficeSessionOrNull();
  if (!session) return [];
  return listCalendarRangeTasks(rangeStartIso, rangeEndIso);
}
