import { getProjectSheetBootstrapAction } from "@/app/(app)/projekte/actions";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

const PROJECT_CORE_STALE_MS = 60_000;

/** Kalender-Hover: full sheet core in one POST (PR-I). */
export function prefetchProjectCore(qc: QueryClient, projectId: string): void {
  const key = queryKeys.projects.core(projectId);
  const state = qc.getQueryState(key);
  if (state?.data != null || state?.fetchStatus === "fetching") {
    return;
  }
  void qc.prefetchQuery({
    queryKey: key,
    queryFn: async () => {
      const { core } = await getProjectSheetBootstrapAction(projectId);
      return core;
    },
    staleTime: PROJECT_CORE_STALE_MS,
  });
}
