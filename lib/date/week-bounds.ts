import { swissDayKeyFromInstant, zurichWallClockInstant } from "@/lib/date/swiss";
import { swissWeekDays, swissWeekReferenceIsoFromDayKey } from "@/lib/date/swiss-week";

/** Monday 00:00:00 – Sunday 23:59:59.999 in Europe/Zurich. */
export function getWeekBounds(reference = new Date()): { start: Date; end: Date } {
  const dayKey = swissDayKeyFromInstant(reference);
  const monRef = swissWeekReferenceIsoFromDayKey(dayKey);
  const days = swissWeekDays(monRef);
  return {
    start: zurichWallClockInstant(days[0]!.key, 0, 0, 0, 0),
    end: zurichWallClockInstant(days[6]!.key, 23, 59, 59, 999),
  };
}

export function formatWeekRangeDe(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/** Kalendertag Europe/Zurich — [00:00, 23:59:59.999] in Zurich wall-clock. */
export function getSwissDayBounds(reference: Date): { start: Date; end: Date } {
  const dayKey = swissDayKeyFromInstant(reference);
  return {
    start: zurichWallClockInstant(dayKey, 0, 0, 0, 0),
    end: zurichWallClockInstant(dayKey, 23, 59, 59, 999),
  };
}

/** Last calendar day of month (month 1–12). */
export function swissMonthLastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** YYYY-MM-DD for the last day of a Swiss calendar month. */
export function swissMonthLastDayKey(year: number, month: number): string {
  const last = swissMonthLastDay(year, month);
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}
