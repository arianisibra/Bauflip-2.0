"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { listWeekTasks } from "@/lib/db/repository";
import type { WeekTaskItem } from "@/lib/domain/types";

export async function fetchWeekTasksAction(
  referenceIso: string,
): Promise<WeekTaskItem[]> {
  const session = await getCurrentSession();
  if (!session || session.role !== "technician") return [];
  const tasks = await listWeekTasks(new Date(referenceIso));
  return tasks.filter((t) => t.assignedTechnicianId === session.user.id);
}
