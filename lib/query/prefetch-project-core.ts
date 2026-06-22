import { getProjectSheetHeadAction } from "@/app/(app)/projekte/actions";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

const PROJECT_CORE_STALE_MS = 60_000;

/** Kalender-Hover: Sheet-Kopf cachen ohne /projekte-RSC-Prefetch oder volles Core-Bundle. */
export function prefetchProjectCore(qc: QueryClient, projectId: string): void {
  const key = queryKeys.projects.coreHead(projectId);
  const state = qc.getQueryState(key);
  if (state?.data != null || state?.fetchStatus === "fetching") {
    return;
  }
  void qc.prefetchQuery({
    queryKey: key,
    queryFn: async () => {
      const { head } = await getProjectSheetHeadAction(projectId);
      return head;
    },
    staleTime: PROJECT_CORE_STALE_MS,
  });
}
