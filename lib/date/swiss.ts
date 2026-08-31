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
    /**
     * Differenz über vollständige Zeitstempel bilden, NICHT über die Tageszahl im Monat.
     *
     * Vorher wurde mit `(d - p.d)` gerechnet. Über eine Monatsgrenze hinweg ist das
     * grob falsch: Für den 31. landet die erste Schätzung in der Sommerzeit bereits im
     * Folgemonat (p.d = 1), die Korrektur rechnet dann 31 − 1 = 30 Tage und springt einen
     * ganzen Monat weit statt sich anzunähern. Die Schleife lief davon und gab nach 12
     * Versuchen den zuletzt erreichten, falschen Wert zurück.
     *
     * Messbar: Für den 31.08.2026 lieferte die Tagesgrenze den 31.10.2026 — die
     * Tagesansicht lud damit ZWEI MONATE Termine statt einem Tag. Betroffen waren alle
     * sieben Monatsletzten in der Sommerzeit (31.03., 30.04., 31.05., 30.06., 31.07.,
     * 31.08., 30.09.). Gemessen am 31.08.2026.
     */
    const zielMs = Date.UTC(y, mo - 1, d, hour, minute, second, millisecond);
    const istMs = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s, millisecond);
    utcMs += zielMs - istMs;
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

/**
 * Renderzeit des Servers als Zeitstempel, zum Weiterreichen an Client-Komponenten.
 *
 * Client-Komponenten dürfen die aktuelle Zeit NICHT selbst ermitteln, wenn sie in die
 * Ausgabe einfliesst: Beim Server-Aufbau und beim Übernehmen im Browser käme je ein
 * anderer Wert heraus — das erzeugt einen Hydration-Mismatch (React #418), worauf React
 * den ganzen Baum verwirft und neu aufbaut. Stattdessen einmal hier bestimmen und als
 * Prop durchreichen, damit beide Seiten garantiert denselben Wert verwenden.
 */
export function serverRenderNowMs(): number {
  return Date.now();
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
