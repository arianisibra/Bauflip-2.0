"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { listWeekTasks } from "@/lib/db/repository";
import { canAccessTechFieldRoutes, type WeekTaskItem } from "@/lib/domain/types";

export async function fetchWeekTasksAction(
  referenceIso: string,
): Promise<WeekTaskItem[]> {
  const session = await getCurrentSession();
  if (!session || !canAccessTechFieldRoutes(session.role)) return [];
  const tasks = await listWeekTasks(new Date(referenceIso));
  if (session.role === "technician") {
    return tasks.filter((t) => t.assignedTechnicianId === session.user.id);
  }
  return tasks;
}
