import type { Appointment } from "@/lib/domain/types";

export type MonteurAppointmentPick = {
  /** Aktueller oder nächster Termin (`endsAt >= now`), sonst letzter vergangener Termin. */
  displayAppt: Appointment | undefined;
  /** Weitere zukünftige Termine nach dem angezeigten (chronologisch). */
  furtherFuture: Appointment[];
  /** Alle Termine liegen in der Vergangenheit (nur relevant wenn displayAppt gesetzt). */
  allPast: boolean;
};

/**
 * Wählt den für den Monteur relevanten Termin: frühester Slot mit `endsAt >= now`
 * (laufender oder zukünftiger Termin), sonst Fallback auf den letzten beendeten Termin.
 */
export function pickMonteurAppointmentDisplay(appointments: Appointment[]): MonteurAppointmentPick {
  const sorted = [...appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (sorted.length === 0) {
    return { displayAppt: undefined, furtherFuture: [], allPast: false };
  }
  const now = Date.now();
  const currentOrUpcoming = sorted.filter((a) => new Date(a.endsAt).getTime() >= now);
  if (currentOrUpcoming.length > 0) {
    const displayAppt = currentOrUpcoming[0];
    const furtherFuture = currentOrUpcoming.slice(1);
    return { displayAppt, furtherFuture, allPast: false };
  }
  return {
    displayAppt: sorted[sorted.length - 1],
    furtherFuture: [],
    allPast: true,
  };
}
