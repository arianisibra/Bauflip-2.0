import "server-only";

import { listPaymentImportsForOrg } from "@/lib/db/payment-imports";
import { queryKeys } from "@/lib/query/keys";
import { dehydrate, QueryClient } from "@tanstack/react-query";

/**
 * Serverseitiger Vorlauf für /zahlungen.
 *
 * Wie bei /kontakte: Der Browser holte die Importliste erst nach dem Dokument
 * nach. Der Schlüssel entspricht dem in usePaymentImports.
 */
export const ZAHLUNGEN_BOOTSTRAP_STALE_MS = 30_000;

export async function buildZahlungenDehydratedState(
  organizationId: string,
): Promise<ReturnType<typeof dehydrate>> {
  const imports = await listPaymentImportsForOrg(organizationId);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: ZAHLUNGEN_BOOTSTRAP_STALE_MS,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  queryClient.setQueryData(queryKeys.paymentImports(), imports);

  return dehydrate(queryClient);
}
