import type { QueryClient } from "@tanstack/react-query";
import { fetchCalendarRangeTasksAction } from "@/app/(app)/kalender/actions";
import { queryKeys } from "@/lib/query/keys";

const CALENDAR_RANGE_STALE_MS = 90_000;

/** Kalender: Nachbar-Tag/-Zeitraum im Hintergrund vorladen, damit Navigation nicht auf das Netzwerk wartet. */
export function prefetchCalendarRange(qc: QueryClient, startIso: string, endIso: string): void {
  const key = queryKeys.calendarRange.byStartEnd(startIso, endIso);
  const state = qc.getQueryState(key);
  if (state?.data != null || state?.fetchStatus === "fetching") {
    return;
  }
  void qc.prefetchQuery({
    queryKey: key,
    queryFn: () => fetchCalendarRangeTasksAction(startIso, endIso),
    staleTime: CALENDAR_RANGE_STALE_MS,
  });
}
