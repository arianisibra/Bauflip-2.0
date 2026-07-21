import { zurichWallClockInstant } from "@/lib/date/swiss";

/**
 * Reiner ICS-Parser für Busy-Blocker: liest einen privaten Kalender-Feed (iCal) und
 * liefert die belegten Zeitfenster, die ein gegebenes Zeitfenster überlappen. Bewusst
 * schlank — für die Terminplanung zählt nur «wann belegt», nicht der Inhalt.
 *
 * Zeitzonen: `…Z` = UTC direkt; floating/TZID und Ganztages-Termine (VALUE=DATE) werden
 * als Europe/Zurich-Wandzeit interpretiert (Schweizer Zielgruppe) und via
 * `zurichWallClockInstant` DST-korrekt nach UTC gewandelt.
 *
 * Wiederkehr (RRULE): FREQ=DAILY/WEEKLY mit INTERVAL/COUNT/UNTIL/BYDAY werden im Fenster
 * expandiert. MONTHLY/YEARLY o. Ä. fallen auf den Basistermin zurück (für Busy-Blocker
 * genügend). Ergebnis ist gedeckelt, damit ein bösartiger Feed keine Endlosschleife baut.
 */

export type BusyInterval = { startMs: number; endMs: number; summary: string };

const DAY_MS = 86_400_000;
/** Sicherheits-Deckel gegen entartete RRULEs. */
const MAX_OCCURRENCES = 400;
const MAX_STEPS = 1200;

type Ymd = { y: number; mo: number; d: number };
type DateParts = { y: number; mo: number; d: number; h: number; mi: number; s: number; isUtc: boolean; isDate: boolean };

/** RFC-5545-Line-Unfolding: Folgezeilen beginnen mit Space/Tab und hängen an die vorige an. */
function unfoldLines(ics: string): string[] {
  const raw = ics.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** «DTSTART;TZID=…;VALUE=DATE» → { name:'DTSTART', params:{TZID,VALUE}, value } */
function parseProperty(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segs = head.split(";");
  const name = segs[0].toUpperCase();
  const params: Record<string, string> = {};
  for (const seg of segs.slice(1)) {
    const eq = seg.indexOf("=");
    if (eq > 0) params[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1);
  }
  return { name, params, value };
}

function parseDateValue(value: string, params: Record<string, string>): DateParts | null {
  const v = value.trim();
  const isDate = params.VALUE === "DATE" || /^\d{8}$/.test(v);
  if (isDate) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
    if (!m) return null;
    return { y: +m[1], mo: +m[2], d: +m[3], h: 0, mi: 0, s: 0, isUtc: false, isDate: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +m[6], isUtc: m[7] === "Z", isDate: false };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Wall-Clock-Komponenten → UTC-Millisekunden (UTC direkt, sonst Europe/Zurich). */
function instantMs(y: number, mo: number, d: number, h: number, mi: number, s: number, isUtc: boolean): number {
  if (isUtc) return Date.UTC(y, mo - 1, d, h, mi, s);
  return zurichWallClockInstant(`${y}-${pad(mo)}-${pad(d)}`, h, mi, s, 0).getTime();
}

/** ISO-8601-Dauer (z. B. PT1H30M, P1D) → Millisekunden. */
function parseDurationMs(value: string): number | null {
  const m = /^([+-]?)P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const ms =
    (Number(m[2] ?? 0) * 7 * DAY_MS) +
    (Number(m[3] ?? 0) * DAY_MS) +
    (Number(m[4] ?? 0) * 3_600_000) +
    (Number(m[5] ?? 0) * 60_000) +
    (Number(m[6] ?? 0) * 1_000);
  return sign * ms;
}

function ymdToUtcNoon(ymd: Ymd): number {
  // Mittag vermeidet DST-Randfälle bei reiner Datums-Arithmetik.
  return Date.UTC(ymd.y, ymd.mo - 1, ymd.d, 12, 0, 0);
}
function utcNoonToYmd(ms: number): Ymd {
  const dt = new Date(ms);
  return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
function addDays(ymd: Ymd, n: number): Ymd {
  return utcNoonToYmd(ymdToUtcNoon(ymd) + n * DAY_MS);
}
/** 0=Mo … 6=So (Monday-based). */
function weekdayMonday(ymd: Ymd): number {
  return (new Date(ymdToUtcNoon(ymd)).getUTCDay() + 6) % 7;
}
function mondayOf(ymd: Ymd): Ymd {
  return addDays(ymd, -weekdayMonday(ymd));
}

const BYDAY_INDEX: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };

type Rrule = {
  freq: string;
  interval: number;
  count: number | null;
  untilMs: number | null;
  byday: number[];
};

function parseRrule(value: string): Rrule | null {
  const parts: Record<string, string> = {};
  for (const kv of value.split(";")) {
    const eq = kv.indexOf("=");
    if (eq > 0) parts[kv.slice(0, eq).toUpperCase()] = kv.slice(eq + 1);
  }
  const freq = (parts.FREQ ?? "").toUpperCase();
  if (!freq) return null;
  let untilMs: number | null = null;
  if (parts.UNTIL) {
    const dp = parseDateValue(parts.UNTIL, {});
    if (dp) untilMs = instantMs(dp.y, dp.mo, dp.d, dp.h, dp.mi, dp.s, dp.isUtc);
  }
  const byday = (parts.BYDAY ?? "")
    .split(",")
    .map((c) => BYDAY_INDEX[c.trim().slice(-2).toUpperCase()])
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  return {
    freq,
    interval: Math.max(1, Number(parts.INTERVAL ?? 1) || 1),
    count: parts.COUNT ? Math.max(0, Number(parts.COUNT) || 0) : null,
    untilMs,
    byday,
  };
}

type ParsedEvent = {
  start: DateParts;
  durMs: number;
  rrule: Rrule | null;
  summary: string;
};

function eventInstant(ev: ParsedEvent, ymd: Ymd): { startMs: number; endMs: number } {
  const startMs = instantMs(ymd.y, ymd.mo, ymd.d, ev.start.h, ev.start.mi, ev.start.s, ev.start.isUtc);
  return { startMs, endMs: startMs + ev.durMs };
}

/** Expandiert ein Event auf die Occurrences, die [windowStartMs, windowEndMs) überlappen. */
function expandEvent(ev: ParsedEvent, windowStartMs: number, windowEndMs: number): BusyInterval[] {
  const out: BusyInterval[] = [];
  const push = (startMs: number, endMs: number) => {
    if (endMs > windowStartMs && startMs < windowEndMs) {
      out.push({ startMs, endMs, summary: ev.summary });
    }
  };

  const base: Ymd = { y: ev.start.y, mo: ev.start.mo, d: ev.start.d };

  if (!ev.rrule || (ev.rrule.freq !== "DAILY" && ev.rrule.freq !== "WEEKLY")) {
    const { startMs, endMs } = eventInstant(ev, base);
    push(startMs, endMs);
    return out;
  }

  const r = ev.rrule;
  let emitted = 0;
  let counted = 0;
  const withinLimits = (startMs: number) =>
    (r.count == null || counted < r.count) && (r.untilMs == null || startMs <= r.untilMs);

  if (r.freq === "WEEKLY" && r.byday.length > 0) {
    let weekStart = mondayOf(base);
    for (let step = 0; step < MAX_STEPS; step++) {
      let anyFuture = false;
      for (const wd of r.byday) {
        const occ = addDays(weekStart, wd);
        if (ymdToUtcNoon(occ) < ymdToUtcNoon(base)) continue; // vor DTSTART
        const { startMs, endMs } = eventInstant(ev, occ);
        if (!withinLimits(startMs)) return out;
        counted++;
        if (startMs < windowEndMs) anyFuture = true;
        push(startMs, endMs);
        if (startMs >= windowStartMs || endMs > windowStartMs) emitted++;
        if (emitted > MAX_OCCURRENCES) return out;
      }
      if (!anyFuture && ymdToUtcNoon(weekStart) > windowEndMs) return out;
      weekStart = addDays(weekStart, r.interval * 7);
    }
    return out;
  }

  const stepDays = r.freq === "DAILY" ? r.interval : r.interval * 7;
  let occ = base;
  for (let step = 0; step < MAX_STEPS; step++) {
    const { startMs, endMs } = eventInstant(ev, occ);
    if (!withinLimits(startMs)) return out;
    counted++;
    push(startMs, endMs);
    if (startMs >= windowStartMs || endMs > windowStartMs) emitted++;
    if (emitted > MAX_OCCURRENCES) return out;
    if (startMs >= windowEndMs) return out;
    occ = addDays(occ, stepDays);
  }
  return out;
}

/** VCALENDAR-Text → Busy-Intervalle, die [windowStartMs, windowEndMs) überlappen. */
export function parseIcsBusyIntervals(ics: string, windowStartMs: number, windowEndMs: number): BusyInterval[] {
  if (!ics || windowEndMs <= windowStartMs) return [];
  const lines = unfoldLines(ics);
  const events: BusyInterval[] = [];

  let inEvent = false;
  let props: Record<string, { params: Record<string, string>; value: string }> = {};

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      inEvent = true;
      props = {};
      continue;
    }
    if (upper === "END:VEVENT") {
      inEvent = false;
      const ev = buildEvent(props);
      if (ev) events.push(...expandEvent(ev, windowStartMs, windowEndMs));
      continue;
    }
    if (!inEvent) continue;
    const p = parseProperty(line);
    if (p && !(p.name in props)) props[p.name] = { params: p.params, value: p.value };
  }

  return events.sort((a, b) => a.startMs - b.startMs);
}

function buildEvent(props: Record<string, { params: Record<string, string>; value: string }>): ParsedEvent | null {
  if ((props.STATUS?.value ?? "").toUpperCase() === "CANCELLED") return null;
  if ((props.TRANSP?.value ?? "").toUpperCase() === "TRANSPARENT") return null;

  const dtstart = props.DTSTART;
  if (!dtstart) return null;
  const start = parseDateValue(dtstart.value, dtstart.params);
  if (!start) return null;

  let durMs: number | null = null;
  if (props.DTEND) {
    const end = parseDateValue(props.DTEND.value, props.DTEND.params);
    if (end) {
      const s = instantMs(start.y, start.mo, start.d, start.h, start.mi, start.s, start.isUtc);
      const e = instantMs(end.y, end.mo, end.d, end.h, end.mi, end.s, end.isUtc);
      durMs = e - s;
    }
  } else if (props.DURATION) {
    durMs = parseDurationMs(props.DURATION.value);
  }
  if (durMs == null) durMs = start.isDate ? DAY_MS : 0;
  if (durMs <= 0) durMs = start.isDate ? DAY_MS : 0;
  if (durMs <= 0) return null;

  const rrule = props.RRULE ? parseRrule(props.RRULE.value) : null;
  const summary = (props.SUMMARY?.value ?? "").trim();
  return { start, durMs, rrule, summary };
}
