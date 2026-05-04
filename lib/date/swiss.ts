const TZ = "Europe/Zurich";

/** Calendar year / month / day in Europe/Zurich for `now`. */
export function swissYmdParts(now = new Date()): { y: number; m: number; day: number } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, day] = s.split("-").map(Number);
  return { y, m, day };
}

/** Current date string in Europe/Zurich as YYYY-MM-DD. */
export function todayKeySwiss(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

/** Current hour (0-23) in Europe/Zurich. */
export function currentHourSwiss(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(now),
  );
}

/** Date object shifted so getFullYear/getMonth/getDate match Europe/Zurich wall-clock. */
export function swissNow(): Date {
  const str = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

  return new Date(str.replace(",", ""));
}
