import assert from "node:assert/strict";
import { test } from "node:test";
import { parseIcsBusyIntervals } from "./busy-ics";
import { zurichWallClockInstant } from "@/lib/date/swiss";

const WIN_START = Date.UTC(2026, 6, 1, 0, 0, 0); // 1. Juli 2026 UTC
const WIN_END = Date.UTC(2026, 7, 1, 0, 0, 0); // 1. Aug 2026 UTC

function ics(body: string): string {
  return `BEGIN:VCALENDAR\nVERSION:2.0\n${body}\nEND:VCALENDAR`;
}
function vevent(props: string[]): string {
  return ["BEGIN:VEVENT", "UID:x@test", ...props, "END:VEVENT"].join("\n");
}

test("Einzeltermin (UTC) im Fenster → 1 Intervall mit korrekten Zeiten", () => {
  const out = parseIcsBusyIntervals(
    ics(vevent(["SUMMARY:Zahnarzt", "DTSTART:20260710T090000Z", "DTEND:20260710T100000Z"])),
    WIN_START,
    WIN_END,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].startMs, Date.UTC(2026, 6, 10, 9, 0, 0));
  assert.equal(out[0].endMs, Date.UTC(2026, 6, 10, 10, 0, 0));
  assert.equal(out[0].summary, "Zahnarzt");
});

test("Termin ausserhalb des Fensters wird ignoriert", () => {
  const out = parseIcsBusyIntervals(
    ics(vevent(["DTSTART:20260901T090000Z", "DTEND:20260901T100000Z"])),
    WIN_START,
    WIN_END,
  );
  assert.equal(out.length, 0);
});

test("CANCELLED und TRANSPARENT werden übersprungen", () => {
  const out = parseIcsBusyIntervals(
    ics(
      [
        vevent(["DTSTART:20260710T090000Z", "DTEND:20260710T100000Z", "STATUS:CANCELLED"]),
        vevent(["DTSTART:20260711T090000Z", "DTEND:20260711T100000Z", "TRANSP:TRANSPARENT"]),
      ].join("\n"),
    ),
    WIN_START,
    WIN_END,
  );
  assert.equal(out.length, 0);
});

test("Ganztages-Termin (VALUE=DATE) → 1-Tages-Dauer in Europe/Zurich", () => {
  const out = parseIcsBusyIntervals(
    ics(vevent(["DTSTART;VALUE=DATE:20260715"])),
    WIN_START,
    WIN_END,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].startMs, zurichWallClockInstant("2026-07-15", 0, 0, 0, 0).getTime());
  assert.equal(out[0].endMs - out[0].startMs, 86_400_000);
});

test("DURATION statt DTEND wird berücksichtigt", () => {
  const out = parseIcsBusyIntervals(
    ics(vevent(["DTSTART:20260710T090000Z", "DURATION:PT1H30M"])),
    WIN_START,
    WIN_END,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].endMs - out[0].startMs, 90 * 60_000);
});

test("Line-Unfolding: gefaltete SUMMARY wird zusammengesetzt", () => {
  const raw = ics(
    ["BEGIN:VEVENT", "UID:x", "SUMMARY:Langer\n Titel", "DTSTART:20260710T090000Z", "DTEND:20260710T100000Z", "END:VEVENT"].join("\n"),
  );
  const out = parseIcsBusyIntervals(raw, WIN_START, WIN_END);
  assert.equal(out.length, 1);
  assert.equal(out[0].summary, "LangerTitel");
});

test("floating-Zeit ohne Z wird als Zurich-Wandzeit interpretiert", () => {
  const out = parseIcsBusyIntervals(
    ics(vevent(["DTSTART:20260710T090000", "DTEND:20260710T100000"])),
    WIN_START,
    WIN_END,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].startMs, zurichWallClockInstant("2026-07-10", 9, 0, 0, 0).getTime());
});

test("RRULE WEEKLY;BYDAY=MO,WE → nur Mo/Mi, aufsteigend sortiert", () => {
  const out = parseIcsBusyIntervals(
    ics(vevent(["DTSTART:20260706T170000Z", "DTEND:20260706T180000Z", "RRULE:FREQ=WEEKLY;BYDAY=MO,WE"])),
    WIN_START,
    WIN_END,
  );
  assert.ok(out.length >= 6, `erwartet mehrere Occurrences, waren ${out.length}`);
  for (const iv of out) {
    const wd = new Date(iv.startMs).getUTCDay(); // 1=Mo, 3=Mi (17:00Z liegt am selben Kalendertag)
    assert.ok(wd === 1 || wd === 3, `unerwarteter Wochentag ${wd}`);
  }
  for (let i = 1; i < out.length; i++) assert.ok(out[i].startMs >= out[i - 1].startMs);
});

test("RRULE DAILY;COUNT=3 → genau 3 Termine", () => {
  const out = parseIcsBusyIntervals(
    ics(vevent(["DTSTART:20260710T080000Z", "DTEND:20260710T083000Z", "RRULE:FREQ=DAILY;COUNT=3"])),
    WIN_START,
    WIN_END,
  );
  assert.equal(out.length, 3);
  assert.equal(out[0].startMs, Date.UTC(2026, 6, 10, 8, 0, 0));
  assert.equal(out[2].startMs, Date.UTC(2026, 6, 12, 8, 0, 0));
});

test("RRULE DAILY;INTERVAL=2 → jeder zweite Tag", () => {
  const out = parseIcsBusyIntervals(
    ics(vevent(["DTSTART:20260710T080000Z", "DTEND:20260710T083000Z", "RRULE:FREQ=DAILY;INTERVAL=2;COUNT=3"])),
    WIN_START,
    WIN_END,
  );
  assert.deepEqual(
    out.map((o) => o.startMs),
    [Date.UTC(2026, 6, 10, 8, 0, 0), Date.UTC(2026, 6, 12, 8, 0, 0), Date.UTC(2026, 6, 14, 8, 0, 0)],
  );
});

test("RRULE DAILY;UNTIL begrenzt die Serie", () => {
  const out = parseIcsBusyIntervals(
    ics(vevent(["DTSTART:20260710T080000Z", "DTEND:20260710T083000Z", "RRULE:FREQ=DAILY;UNTIL=20260712T235959Z"])),
    WIN_START,
    WIN_END,
  );
  assert.equal(out.length, 3);
});

test("leerer/kaputter Input → leeres Ergebnis, kein Wurf", () => {
  assert.deepEqual(parseIcsBusyIntervals("", WIN_START, WIN_END), []);
  assert.deepEqual(parseIcsBusyIntervals("kein ics", WIN_START, WIN_END), []);
  assert.deepEqual(parseIcsBusyIntervals(ics(vevent(["SUMMARY:ohne datum"])), WIN_START, WIN_END), []);
});
