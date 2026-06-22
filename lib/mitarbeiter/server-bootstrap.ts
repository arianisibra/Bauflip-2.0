import "server-only";

import { loadMitarbeiterBootstrapData } from "@/lib/db/repository";
import { queryKeys } from "@/lib/query/keys";
import { dehydrate, QueryClient } from "@tanstack/react-query";

export const MITARBEITER_BOOTSTRAP_STALE_MS = 60_000;

export async function buildMitarbeiterDehydratedState(
  organizationId: string,
): Promise<ReturnType<typeof dehydrate>> {
  const data = await loadMitarbeiterBootstrapData(organizationId);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: MITARBEITER_BOOTSTRAP_STALE_MS,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  queryClient.setQueryData(queryKeys.teamMembers(), data.team);
  queryClient.setQueryData(queryKeys.absences.all(), data.absences);

  return dehydrate(queryClient);
}
