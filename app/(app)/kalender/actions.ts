"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { listMonthTasks } from "@/lib/db/repository";
import type { WeekTaskItem } from "@/lib/domain/types";

export async function fetchMonthTasksAction(
  year: number,
  month: number,
): Promise<WeekTaskItem[]> {
  const session = await getCurrentSession();
  if (!session) return [];
  return listMonthTasks(year, month);
}
