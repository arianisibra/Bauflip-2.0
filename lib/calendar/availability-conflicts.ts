import { taskAssignedTechnicianIds, type TechnicianAbsence, type WeekTaskItem } from "@/lib/domain/types";

/** Belegtes Zeitfenster aus einem privaten Kalender (nur Zeiten, kein Titel). */
export type BusyBlock = { technicianId: string; startsAt: string; endsAt: string };

export type Conflict =
  | { type: "appointment"; task: WeekTaskItem }
  | { type: "absence"; absence: TechnicianAbsence }
  | { type: "external_busy"; busy: BusyBlock };

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Konflikte einer Person im Zeitfenster — optional den eigenen (gerade bearbeiteten) Termin ausschliessen. */
export function computeConflicts(
  technicianId: string,
  bundle:
    | { appointments: WeekTaskItem[]; absences: TechnicianAbsence[]; externalBusy?: BusyBlock[] }
    | undefined,
  range: { slotStart: number; slotEnd: number } | null,
  excludeAppointmentId?: string,
): Conflict[] {
  if (!bundle || !range || !technicianId) return [];
  const out: Conflict[] = [];
  for (const t of bundle.appointments) {
    if (excludeAppointmentId && t.appointmentId === excludeAppointmentId) continue;
    if (!taskAssignedTechnicianIds(t).includes(technicianId)) continue;
    const s = Date.parse(t.startsAt);
    const e = Date.parse(t.endsAt);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    if (rangesOverlap(range.slotStart, range.slotEnd, s, e)) {
      out.push({ type: "appointment", task: t });
    }
  }
  for (const a of bundle.absences) {
    if (a.technicianId !== technicianId) continue;
    const s = Date.parse(a.startsAt);
    const e = Date.parse(a.endsAt);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    if (rangesOverlap(range.slotStart, range.slotEnd, s, e)) {
      out.push({ type: "absence", absence: a });
    }
  }
  for (const b of bundle.externalBusy ?? []) {
    if (b.technicianId !== technicianId) continue;
    const s = Date.parse(b.startsAt);
    const e = Date.parse(b.endsAt);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    if (rangesOverlap(range.slotStart, range.slotEnd, s, e)) {
      out.push({ type: "external_busy", busy: b });
    }
  }
  return out;
}

export type ConflictStatus = "idle" | "free" | "conflict" | "absence";

export function conflictStatus(
  ready: boolean,
  technicianId: string,
  conflicts: Conflict[],
): ConflictStatus {
  if (!ready || !technicianId) return "idle";
  if (conflicts.some((c) => c.type === "absence")) return "absence";
  if (conflicts.length > 0) return "conflict";
  return "free";
}

/** Ferien blockiert die Buchung hart — Krank/Blocker bleiben nur eine Warnung. */
export function hasFerienConflict(conflicts: Conflict[]): boolean {
  return conflicts.some((c) => c.type === "absence" && c.absence.kind === "ferien");
}
