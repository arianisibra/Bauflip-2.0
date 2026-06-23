import "server-only";

import type { LayoutSession } from "@/lib/auth/session";
import { swissWeekReferenceIso } from "@/lib/date/swiss-week";
import { listWeekTasks } from "@/lib/db/repository";
import { queryKeys } from "@/lib/query/keys";
import { dehydrate, QueryClient } from "@tanstack/react-query";

export const TAG_BOOTSTRAP_STALE_MS = 90_000;

export async function buildTagDehydratedState(
  session: LayoutSession,
): Promise<ReturnType<typeof dehydrate>> {
  const referenceIso = swissWeekReferenceIso();
  const assignedTechnicianId = session.role === "technician" ? session.userId : undefined;
  const tasks = await listWeekTasks(new Date(referenceIso), assignedTechnicianId);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: TAG_BOOTSTRAP_STALE_MS,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  queryClient.setQueryData(queryKeys.weekTasks.byDate(referenceIso), tasks);

  return dehydrate(queryClient);
}
