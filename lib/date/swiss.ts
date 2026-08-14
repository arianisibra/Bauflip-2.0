const TZ = "Europe/Zurich";

type ZurichWallParts = {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
};

function zurichWallPartsFromInstant(instant: Date): ZurichWallParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

/** Swiss calendar day YYYY-MM-DD for an instant (Europe/Zurich). */
export function swissDayKeyFromInstant(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * UTC instant for wall-clock time in Europe/Zurich on `dayKey` (YYYY-MM-DD).
 * Independent of the JS runtime timezone (Netlify UTC vs Swiss browser).
 */
export function zurichWallClockInstant(
  dayKey: string,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): Date {
  const [y, mo, d] = dayKey.split("-").map(Number);
  let utcMs = Date.UTC(y, mo - 1, d, hour - 1, minute, second, millisecond);

  for (let i = 0; i < 12; i++) {
    const p = zurichWallPartsFromInstant(new Date(utcMs));
    if (
      p.y === y &&
      p.mo === mo &&
      p.d === d &&
      p.h === hour &&
      p.mi === minute &&
      p.s === second
    ) {
      return new Date(utcMs);
    }
    const correctionMs =
      (d - p.d) * 86_400_000 +
      (hour - p.h) * 3_600_000 +
      (minute - p.mi) * 60_000 +
      (second - p.s) * 1_000;
    utcMs += correctionMs;
  }

  return new Date(utcMs);
}

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

/**
 * Laufender Monat nach Schweizer Zeit als {start, end} im Format YYYY-MM-DD.
 *
 * Liegt hier gemeinsam, weil Server und Client denselben Zeitraum berechnen
 * müssen: Der Abfrageschlüssel der Zeiterfassung enthält Start und Ende. Wären
 * die beiden Berechnungen auch nur einen Tag auseinander, läge der serverseitig
 * vorbereitete Stand unter einem anderen Schlüssel und würde nie gelesen.
 */
export function currentMonthRangeSwiss(now = new Date()): { start: string; end: string } {
  const todayKey = todayKeySwiss(now);
  const [y, m] = todayKey.split("-").map(Number);
  const lastDay = new Date(y!, m!, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { start: `${y}-${pad(m!)}-01`, end: `${y}-${pad(m!)}-${pad(lastDay)}` };
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
