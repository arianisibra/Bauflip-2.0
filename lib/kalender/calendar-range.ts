import { formatWeekRangeDe, getSwissDayBounds, getWeekBounds } from "@/lib/date/week-bounds";
import { swissYmdParts } from "@/lib/date/swiss";
import {
  anchorDateFromDayKey,
  type AdminCalendarUrlState,
  type AdminCalendarViewMode,
} from "@/lib/navigation/admin-calendar-navigation";

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const TZ = "Europe/Zurich";

export type CalendarRangeBounds = {
  startIso: string;
  endIso: string;
  heading: string;
  rangeLabel: string;
};

export function calendarRangeBoundsFromState(
  viewMode: AdminCalendarViewMode,
  anchorDate: Date,
  year: number,
  month: number,
): CalendarRangeBounds {
  if (viewMode === "availability") {
    const { start, end } = getSwissDayBounds(anchorDate);
    const headingLong = new Intl.DateTimeFormat("de-CH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: TZ,
    }).format(anchorDate);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      heading: headingLong,
      rangeLabel: "Verfügbarkeit",
    };
  }
  if (viewMode === "year") {
    const start = new Date(year, 0, 1, 0, 0, 0, 0);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      heading: `${year}`,
      rangeLabel: "Jahr",
    };
  }
  if (viewMode === "month") {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      heading: `${MONTH_NAMES[month - 1]} ${year}`,
      rangeLabel: "Monat",
    };
  }
  if (viewMode === "week") {
    const { start, end } = getWeekBounds(anchorDate);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      heading: formatWeekRangeDe(start, end),
      rangeLabel: "Kalenderwoche",
    };
  }
  const { start, end } = getSwissDayBounds(anchorDate);
  const headingLong = new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(anchorDate);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    heading: headingLong,
    rangeLabel: "Tag",
  };
}

export function calendarRangeBoundsFromUrlState(urlState: AdminCalendarUrlState): CalendarRangeBounds {
  const anchorDate = anchorDateFromDayKey(urlState.dayKey);
  const { y, m } = swissYmdParts(anchorDate);
  return calendarRangeBoundsFromState(urlState.viewMode, anchorDate, y, m);
}
