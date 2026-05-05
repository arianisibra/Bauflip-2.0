"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { listCalendarRangeTasks, listWeekTasks } from "@/lib/db/repository";
import { canAccessTechFieldRoutes, type WeekTaskItem } from "@/lib/domain/types";

export async function fetchWeekTasksAction(
  referenceIso: string,
): Promise<WeekTaskItem[]> {
  const session = await getCurrentSession();
  if (!session || !canAccessTechFieldRoutes(session.role)) return [];
  return listWeekTasks(
    new Date(referenceIso),
    session.role === "technician" ? session.user.id : undefined,
  );
}

export async function fetchTechMonthTasksAction(year: number, month: number): Promise<WeekTaskItem[]> {
  const session = await getCurrentSession();
  if (!session || !canAccessTechFieldRoutes(session.role)) return [];
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return listCalendarRangeTasks(
    start.toISOString(),
    end.toISOString(),
    session.role === "technician" ? session.user.id : undefined,
  );
}
