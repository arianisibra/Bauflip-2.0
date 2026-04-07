"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { listMonthTasks } from "@/lib/db/repository";
import type { WeekTaskItem } from "@/lib/domain/types";

export async function fetchMonthTasksAction(
  year: number,
  month: number,
): Promise<WeekTaskItem[]> {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) return [];
  return listMonthTasks(year, month);
}
