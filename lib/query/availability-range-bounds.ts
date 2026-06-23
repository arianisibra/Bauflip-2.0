import { getSwissDayBounds } from "@/lib/date/week-bounds";

/** Snap an ISO range to Swiss calendar-day bounds for stable TanStack query keys. */
export function availabilityRangeKeyBounds(
  rangeStartIso: string,
  rangeEndIso: string,
): { startIso: string; endIso: string } {
  const { start: dayStart } = getSwissDayBounds(new Date(rangeStartIso));
  const { end: dayEnd } = getSwissDayBounds(new Date(rangeEndIso));
  return { startIso: dayStart.toISOString(), endIso: dayEnd.toISOString() };
}
