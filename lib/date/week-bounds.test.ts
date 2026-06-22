import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSwissDayBounds, getWeekBounds } from "@/lib/date/week-bounds";
import { zurichWallClockInstant } from "@/lib/date/swiss";

/** Same as anchorDateFromDayKey — keeps test free of navigation imports. */
function anchorFromDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0, 0));
}

describe("zurichWallClockInstant", () => {
  it("maps summer day start to UTC (CEST)", () => {
    const start = zurichWallClockInstant("2026-06-22", 0, 0, 0, 0);
    assert.equal(start.toISOString(), "2026-06-21T22:00:00.000Z");
  });

  it("maps summer day end to UTC (CEST)", () => {
    const end = zurichWallClockInstant("2026-06-22", 23, 59, 59, 999);
    assert.equal(end.toISOString(), "2026-06-22T21:59:59.999Z");
  });

  it("maps winter day start to UTC (CET)", () => {
    const start = zurichWallClockInstant("2026-01-15", 0, 0, 0, 0);
    assert.equal(start.toISOString(), "2026-01-14T23:00:00.000Z");
  });
});

describe("getSwissDayBounds timezone parity", () => {
  it("returns identical ISO bounds regardless of process TZ", () => {
    const { start, end } = getSwissDayBounds(anchorFromDayKey("2026-06-22"));
    assert.equal(start.toISOString(), "2026-06-21T22:00:00.000Z");
    assert.equal(end.toISOString(), "2026-06-22T21:59:59.999Z");
  });
});

describe("getWeekBounds timezone parity", () => {
  it("returns stable week bounds for a mid-week anchor", () => {
    const { start, end } = getWeekBounds(anchorFromDayKey("2026-06-25"));
    assert.equal(start.toISOString(), "2026-06-21T22:00:00.000Z");
    assert.equal(end.toISOString(), "2026-06-28T21:59:59.999Z");
  });
});

describe("process TZ independence", () => {
  it("matches under TZ=UTC and TZ=Europe/Zurich", () => {
    const ref = anchorFromDayKey("2026-06-22");
    const underUtc = runInTz("UTC", () => getSwissDayBounds(ref));
    const underCh = runInTz("Europe/Zurich", () => getSwissDayBounds(ref));
    assert.equal(underUtc.start.toISOString(), underCh.start.toISOString());
    assert.equal(underUtc.end.toISOString(), underCh.end.toISOString());
  });
});

function runInTz<T>(tz: string, fn: () => T): T {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
}
