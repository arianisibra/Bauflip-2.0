import "server-only";

import { listContactsForOrg } from "@/lib/db/contacts";
import { queryKeys } from "@/lib/query/keys";
import { dehydrate, QueryClient } from "@tanstack/react-query";

/**
 * Serverseitiger Vorlauf für /kontakte.
 *
 * Ohne ihn schickte der Browser nach dem Dokument sofort einen zweiten Aufruf
 * hinterher, nur um die Liste zu holen — ein Wasserfall aus zwei Rundreisen,
 * bei dem die zweite erst beginnt, wenn die erste fertig ist. Der Server hat
 * die Daten ohnehin zur Hand.
 *
 * Der Schlüssel muss exakt dem im Hook entsprechen (useContacts →
 * queryKeys.contacts()), sonst liegt der vorbereitete Stand ungenutzt daneben.
 */
export const KONTAKTE_BOOTSTRAP_STALE_MS = 60_000;

export async function buildKontakteDehydratedState(
  organizationId: string,
): Promise<ReturnType<typeof dehydrate>> {
  const contacts = await listContactsForOrg(organizationId);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: KONTAKTE_BOOTSTRAP_STALE_MS,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  queryClient.setQueryData(queryKeys.contacts(), contacts);

  return dehydrate(queryClient);
}
