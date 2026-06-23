import "server-only";

import type { LayoutSession } from "@/lib/auth/session";
import { swissWeekReferenceIso, swissWeekReferenceIsoFromDayKey } from "@/lib/date/swiss-week";
import { listCalendarRangeTasks, listWeekTasks } from "@/lib/db/repository";
import type { TechCalendarUrlState } from "@/lib/navigation/tech-field-navigation";
import { queryKeys } from "@/lib/query/keys";
import { dehydrate, QueryClient } from "@tanstack/react-query";

export const TECH_FIELD_BOOTSTRAP_STALE_MS = 90_000;

function technicianIdForSession(session: LayoutSession): string | undefined {
  return session.role === "technician" ? session.userId : undefined;
}

function createTechFieldQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: TECH_FIELD_BOOTSTRAP_STALE_MS,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

function monthRangeIso(year: number, month: number): { startIso: string; endIso: string } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function buildTagDehydratedState(
  session: LayoutSession,
): Promise<ReturnType<typeof dehydrate>> {
  const referenceIso = swissWeekReferenceIso();
  const assignedTechnicianId = technicianIdForSession(session);
  const tasks = await listWeekTasks(new Date(referenceIso), assignedTechnicianId);

  const queryClient = createTechFieldQueryClient();
  queryClient.setQueryData(queryKeys.weekTasks.byDate(referenceIso), tasks);

  return dehydrate(queryClient);
}

export async function buildWochenplanDehydratedState(
  session: LayoutSession,
  urlState: TechCalendarUrlState,
): Promise<ReturnType<typeof dehydrate>> {
  const assignedTechnicianId = technicianIdForSession(session);
  const referenceIso = swissWeekReferenceIsoFromDayKey(urlState.focusDayKey);
  const monthY = Number(urlState.focusDayKey.slice(0, 4));
  const monthM = Number(urlState.focusDayKey.slice(5, 7));
  const { startIso, endIso } = monthRangeIso(monthY, monthM);

  const [weekTasks, monthTasks] = await Promise.all([
    listWeekTasks(new Date(referenceIso), assignedTechnicianId),
    listCalendarRangeTasks(startIso, endIso, assignedTechnicianId),
  ]);

  const queryClient = createTechFieldQueryClient();
  queryClient.setQueryData(queryKeys.weekTasks.byDate(referenceIso), weekTasks);
  queryClient.setQueryData(queryKeys.techMonthTasks.byYearMonth(monthY, monthM), monthTasks);

  return dehydrate(queryClient);
}
