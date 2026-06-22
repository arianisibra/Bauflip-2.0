import { getProjectSheetDataAction } from "@/app/(app)/projekte/actions";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

const PROJECT_CORE_STALE_MS = 60_000;

/** Kalender-Hover: Sheet-Stammdaten cachen ohne /projekte-RSC-Prefetch. */
export function prefetchProjectCore(qc: QueryClient, projectId: string): void {
  const key = queryKeys.projects.core(projectId);
  const state = qc.getQueryState(key);
  if (state?.data != null || state?.fetchStatus === "fetching") {
    return;
  }
  void qc.prefetchQuery({
    queryKey: key,
    queryFn: async () => {
      const { bundle } = await getProjectSheetDataAction(projectId);
      return bundle;
    },
    staleTime: PROJECT_CORE_STALE_MS,
  });
}
