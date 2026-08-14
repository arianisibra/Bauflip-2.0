import "server-only";

import { currentMonthRangeSwiss } from "@/lib/date/swiss";
import { listTimeEntriesForOrg } from "@/lib/db/repository";
import { queryKeys } from "@/lib/query/keys";
import { dehydrate, QueryClient } from "@tanstack/react-query";

/**
 * Serverseitiger Vorlauf für /zeiterfassung.
 *
 * Heikler als die anderen beiden: Der Abfrageschlüssel enthält den Zeitraum,
 * und der Client startet mit dem laufenden Monat. Server und Client müssen
 * denselben Zeitraum berechnen — sonst liegt der vorbereitete Stand unter einem
 * anderen Schlüssel und wird nie gelesen (kein Fehler, nur wirkungslos).
 *
 * Deshalb liegt die Berechnung gemeinsam in lib/date/swiss.ts — dieses Modul
 * ist `server-only`, der Client könnte nicht daraus importieren.
 */
export const ZEITERFASSUNG_BOOTSTRAP_STALE_MS = 30_000;

export async function buildZeiterfassungDehydratedState(
  organizationId: string,
): Promise<ReturnType<typeof dehydrate>> {
  const { start, end } = currentMonthRangeSwiss();
  const entries = await listTimeEntriesForOrg(organizationId, start, end);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: ZEITERFASSUNG_BOOTSTRAP_STALE_MS,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  queryClient.setQueryData(queryKeys.timeEntries.org(start, end), entries);

  return dehydrate(queryClient);
}
