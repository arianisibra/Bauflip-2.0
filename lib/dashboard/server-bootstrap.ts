import "server-only";

import { dehydrate, QueryClient } from "@tanstack/react-query";
import { loadDashboardData, type DashboardData } from "@/lib/db/dashboard";
import { listProjectStatusCountsForOffice } from "@/lib/db/repository";
import { queryKeys } from "@/lib/query/keys";

export const DASHBOARD_BOOTSTRAP_STALE_MS = 60_000;

export async function fetchDashboardData(organizationId: string): Promise<DashboardData> {
  return loadDashboardData(organizationId, () => listProjectStatusCountsForOffice(organizationId));
}

export async function buildDashboardDehydratedState(
  organizationId: string,
): Promise<ReturnType<typeof dehydrate>> {
  const data = await fetchDashboardData(organizationId);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DASHBOARD_BOOTSTRAP_STALE_MS,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  queryClient.setQueryData(queryKeys.dashboard(), data);

  return dehydrate(queryClient);
}
