import "server-only";

import { todayKeySwiss } from "@/lib/date/swiss";
import { listAvailabilityForRange, listCalendarRangeTasks } from "@/lib/db/repository";
import { calendarRangeBoundsFromUrlState } from "@/lib/kalender/calendar-range";
import {
  parseAdminCalendarUrlState,
  type AdminCalendarUrlState,
} from "@/lib/navigation/admin-calendar-navigation";
import { queryKeys } from "@/lib/query/keys";
import { dehydrate, QueryClient } from "@tanstack/react-query";

export const CALENDAR_RANGE_STALE_MS = 90_000;

type KalenderSearchParams = {
  view?: string;
  day?: string;
  tech?: string;
  sort?: string;
};

function parseKalenderUrlState(searchParams: KalenderSearchParams): AdminCalendarUrlState {
  return parseAdminCalendarUrlState(
    {
      get: (key) => {
        if (key === "view") return searchParams.view ?? null;
        if (key === "day") return searchParams.day ?? null;
        if (key === "tech") return searchParams.tech ?? null;
        if (key === "sort") return searchParams.sort ?? null;
        return null;
      },
    },
    todayKeySwiss(),
  );
}

export async function buildKalenderDehydratedState(
  searchParams: KalenderSearchParams,
): Promise<ReturnType<typeof dehydrate>> {
  const urlState = parseKalenderUrlState(searchParams);
  const { startIso, endIso } = calendarRangeBoundsFromUrlState(urlState);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CALENDAR_RANGE_STALE_MS,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  if (urlState.viewMode === "availability") {
    const bundle = await listAvailabilityForRange(startIso, endIso);
    queryClient.setQueryData(queryKeys.availabilityRange.byStartEnd(startIso, endIso), bundle);
  } else {
    const tasks = await listCalendarRangeTasks(startIso, endIso);
    queryClient.setQueryData(queryKeys.calendarRange.byStartEnd(startIso, endIso), tasks);
  }

  return dehydrate(queryClient);
}
