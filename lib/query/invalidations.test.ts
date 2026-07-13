import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { invalidateProjectAdjacencies } from "./invalidations";

/**
 * Regression: Buchen/Löschen eines Termins kann den Projektstatus promoten
 * (montagebereit → abgemacht). Der Status steht auf ALLEN Kalender-Kacheln des
 * Projekts — auch auf der eines Termins in einer anderen Woche als der neue.
 * Die frühere fenster-enge Invalidierung liess genau diese sichtbare Kachel stehen
 * (Symptom: Status wechselt erst nach Page-Refresh). Der Fix invalidiert breit.
 */

// Aktuell sichtbare Kalender-Range (zeigt den Ersttermin) im Juli.
const VISIBLE_RANGE_START = "2026-07-06T00:00:00.000Z";
const VISIBLE_RANGE_END = "2026-07-13T00:00:00.000Z";
// Neu gebuchter Zweittermin im September — überlappt die sichtbare Range NICHT.
const NEW_APPOINTMENT_WINDOW = {
  startsAt: "2026-09-01T08:00:00.000Z",
  endsAt: "2026-09-01T10:00:00.000Z",
};

function seedVisibleCalendarRange(qc: QueryClient): readonly unknown[] {
  const key = queryKeys.calendarRange.byStartEnd(VISIBLE_RANGE_START, VISIBLE_RANGE_END);
  qc.setQueryData(key, [{ id: "tile-1", projectStatus: "montagebereit" }]);
  return key;
}

test("breite Invalidierung erfasst eine nicht überlappende, sichtbare Kalender-Range", () => {
  const qc = new QueryClient();
  const key = seedVisibleCalendarRange(qc);
  assert.equal(qc.getQueryState(key)?.isInvalidated, false);

  // Fix: ohne appointmentWindow → breiter Zweig (alle Kalender-Ranges).
  invalidateProjectAdjacencies(qc, "project-1", { refetchType: "none" });

  assert.equal(
    qc.getQueryState(key)?.isInvalidated,
    true,
    "sichtbare Kalender-Range muss invalidiert werden, auch wenn sie das neue Terminfenster nicht überlappt",
  );
});

test("enge Invalidierung (altes Verhalten) verfehlt die nicht überlappende Range — dokumentiert den Bug", () => {
  const qc = new QueryClient();
  const key = seedVisibleCalendarRange(qc);

  // Alter Pfad: mit appointmentWindow des Zweittermins → nur überlappende Ranges.
  invalidateProjectAdjacencies(qc, "project-1", {
    appointmentWindow: NEW_APPOINTMENT_WINDOW,
    refetchType: "none",
  });

  assert.equal(
    qc.getQueryState(key)?.isInvalidated,
    false,
    "belegt, warum die fenster-enge Invalidierung die sichtbare Kachel stale liess",
  );
});
