import type { WorkflowStage } from "@/lib/domain/workflow-types";

/**
 * Automatik-Resolver für die Workflow-Engine (Stufe D) — reine Funktionen,
 * kein DB-/React-Zugriff. Jede Funktion fällt bei leerer `stages`-Liste
 * (kein Provider / Org noch nicht geseedet) automatisch auf den exakt
 * gleichen hartcodierten Wert zurück wie vor Stufe D — kein separater
 * Zweig im Aufrufer nötig.
 */

/** Ziel-Status bei Terminbuchung («=abgemacht»). */
export function resolveSchedulingTargetStatus(
  stages: readonly Pick<WorkflowStage, "key" | "isSchedulingTarget">[],
  fallback: string,
): string {
  const found = stages.find((s) => s.isSchedulingTarget);
  return found ? found.key : fallback;
}

/** Rückfall-Status ohne Termin («=offen»). */
export function resolveInitialStatus(
  stages: readonly Pick<WorkflowStage, "key" | "isInitial">[],
  fallback: string,
): string {
  const found = stages.find((s) => s.isInitial);
  return found ? found.key : fallback;
}

/** Ziel-Status nach Rapport «Behoben» («=abrechnen»). */
export function resolveRapportBehobenTarget(
  stages: readonly Pick<WorkflowStage, "key" | "rapportBehobenTarget">[],
  fallback: string,
): string {
  const found = stages.find((s) => s.rapportBehobenTarget);
  return found ? found.key : fallback;
}

/**
 * Neuer Status nach Terminbuchung, oder `null` wenn nicht anzufassen.
 * `fallbackPromotesList` wird nur benutzt, wenn `stages` leer ist.
 */
export function resolveNextStatusAfterAppointmentBooked(
  stages: readonly Pick<WorkflowStage, "key" | "isSchedulingTarget" | "promotesOnAppointment">[],
  currentStatus: string,
  appointmentIsUpcoming: boolean,
  fallbackPromotesList: readonly string[],
): string | null {
  if (!appointmentIsUpcoming) return null;
  const promotes =
    stages.length === 0
      ? fallbackPromotesList.includes(currentStatus)
      : (stages.find((s) => s.key === currentStatus)?.promotesOnAppointment ?? false);
  if (!promotes) return null;
  const target = resolveSchedulingTargetStatus(stages, "abgemacht");
  return target === currentStatus ? null : target;
}

/**
 * Neuer Status nach Löschen des letzten bevorstehenden Termins, oder `null`
 * wenn nicht anzufassen. Nur relevant, solange `currentStatus` der
 * Terminbuchungs-Zielstatus ist (`resolveSchedulingTargetStatus`).
 */
export function resolveStatusAfterLastAppointmentDeleted(
  stages: readonly Pick<
    WorkflowStage,
    "key" | "isSchedulingTarget" | "isInitial"
  >[],
  currentStatus: string,
  revertStatus: string | null | undefined,
): string | null {
  const schedulingTarget = resolveSchedulingTargetStatus(stages, "abgemacht");
  if (currentStatus !== schedulingTarget) return null;
  if (revertStatus && revertStatus !== schedulingTarget) return revertStatus;
  return resolveInitialStatus(stages, "offen");
}
