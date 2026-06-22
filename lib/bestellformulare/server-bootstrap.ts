import "server-only";

import { listOrderFormTemplatesForOrg } from "@/lib/db/repository";
import { queryKeys } from "@/lib/query/keys";
import { dehydrate, QueryClient } from "@tanstack/react-query";

export const BESTELLFORMULARE_BOOTSTRAP_STALE_MS = 60_000;

export async function buildBestellformulareDehydratedState(
  organizationId: string,
): Promise<ReturnType<typeof dehydrate>> {
  const templates = await listOrderFormTemplatesForOrg(organizationId);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: BESTELLFORMULARE_BOOTSTRAP_STALE_MS,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  queryClient.setQueryData(queryKeys.orderFormTemplates.all(), templates);

  return dehydrate(queryClient);
}
