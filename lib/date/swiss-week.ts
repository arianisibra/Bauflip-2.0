/**
 * Swiss-calendar week helpers independent of the JS runtime's timezone.
 *
 * The reference for a week is a deterministic ISO timestamp at UTC noon of
 * the Swiss-calendar Monday of that week. UTC noon is safely inside the same
 * calendar day in every timezone (offsets range from −14h to +14h), so the
 * weekday and week bounds compute correctly whether the code runs on a UTC
 * server, a Swiss browser, or anything in between.
 */

const SWISS_TZ = "Europe/Zurich";
const MS_PER_DAY = 86_400_000;

/** Swiss-calendar date of `ref` as "YYYY-MM-DD". */
function swissDateParts(ref: Date): { y: number; m: number; d: number } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: SWISS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ref);
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

/**
 * Stable query-key reference for `ref`'s Swiss week.
 * Returns a string like `"2026-04-20T12:00:00.000Z"` — UTC noon of the Swiss
 * Monday. Same week → same string → same TanStack cache entry.
 */
export function swissWeekReferenceIso(ref: Date = new Date()): string {
  const { y, m, d } = swissDateParts(ref);
  const noonUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
  const weekday = new Date(noonUtc).getUTCDay(); // 0 = Sun, 1 = Mon, …
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const mondayUtc = noonUtc + mondayOffset * MS_PER_DAY;
  return new Date(mondayUtc).toISOString();
}

/** `+1` or `-1` weeks from an existing reference, staying on Swiss-Monday-noon-UTC. */
export function shiftSwissWeekReference(referenceIso: string, weeks: number): string {
  const base = new Date(referenceIso).getTime();
  return new Date(base + weeks * 7 * MS_PER_DAY).toISOString();
}

/** Swiss Monday reference ISO for the week that contains `dayKey` (`YYYY-MM-DD`). */
export function swissWeekReferenceIsoFromDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return swissWeekReferenceIso(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
}

/** Add calendar days in Europe/Zurich; `dayKey` is `YYYY-MM-DD`. */
export function shiftSwissDayKey(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d, 12, 0, 0) + deltaDays * MS_PER_DAY;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SWISS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utc));
}

/** Move `dayKey` by calendar months, clamping the day to the target month's length. */
export function shiftSwissMonthInDayKey(dayKey: string, deltaMonths: number): string {
  const [y0, m0, d0] = dayKey.split("-").map(Number);
  const idx = y0 * 12 + (m0 - 1) + deltaMonths;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  const dim = new Date(y, m, 0).getDate();
  const d = Math.min(d0, dim);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const DAY_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: SWISS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MONTH_SHORT_FORMATTER = new Intl.DateTimeFormat("de-CH", {
  timeZone: SWISS_TZ,
  month: "short",
});

/**
 * Returns the seven Swiss calendar days of the week anchored at
 * `referenceIso` (expected to be UTC-noon of the Swiss Monday).
 * Each entry carries a stable "YYYY-MM-DD" key and the day-of-month plus
 * short month name in Swiss TZ — safe to render on any client timezone.
 */
export function swissWeekDays(referenceIso: string): Array<{
  key: string;
  day: number;
  monthShort: string;
}> {
  const base = new Date(referenceIso).getTime();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base + i * MS_PER_DAY);
    const key = DAY_KEY_FORMATTER.format(d);
    const day = Number(key.slice(8, 10));
    return { key, day, monthShort: MONTH_SHORT_FORMATTER.format(d) };
  });
}
