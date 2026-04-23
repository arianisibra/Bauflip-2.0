/**
 * Invalidation helpers.
 *
 * Two flavors:
 * - `after*Change(qc, ...)` — **full** invalidation (primary + adjacent).
 *   Used by external triggers (SSE, BroadcastChannel, Realtime) that only
 *   know "something changed" and have no payload to prime with.
 * - `invalidate*Adjacencies(qc, ...)` — **adjacent only**. Used by mutation
 *   hooks that already called `setQueryData` on the primary; invalidating
 *   the primary here would cause a pointless refetch.
 *
 * All helpers are pure functions over a `QueryClient` → callable from React,
 * plain event listeners, anywhere.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

// ─── Adjacent-only (for mutation hooks) ───────────────────────────────────

/** List + scheduling views; excludes the project's own core. */
export function invalidateProjectAdjacencies(qc: QueryClient, _projectId: string): void {
  qc.invalidateQueries({ queryKey: queryKeys.projects.list() });
  qc.invalidateQueries({ queryKey: queryKeys.weekTasks.all() });
  qc.invalidateQueries({ queryKey: queryKeys.monthTasks.all() });
}

/** Report CRUD only affects the project's sheet (primary). No adjacencies. */
export function invalidateReportAdjacencies(_qc: QueryClient, _projectId: string): void {
  // nothing — the sheet is the only surface; primed via setQueryData
}

/** Attachment CRUD — same story as reports. */
export function invalidateAttachmentAdjacencies(_qc: QueryClient, _projectId: string): void {
  // nothing
}

// ─── Full invalidation (for external events — SSE / Realtime / etc.) ──────

/** Stammdaten or status changed. Invalidates the sheet *and* adjacent views. */
export function afterProjectCoreChange(qc: QueryClient, projectId: string): void {
  qc.invalidateQueries({ queryKey: queryKeys.projects.core(projectId) });
  invalidateProjectAdjacencies(qc, projectId);
}

/** Appointment added/deleted/reassigned. */
export function afterAppointmentChange(qc: QueryClient, projectId: string): void {
  qc.invalidateQueries({ queryKey: queryKeys.projects.core(projectId) });
  invalidateProjectAdjacencies(qc, projectId);
}

/** Technician report submitted/deleted. */
export function afterReportChange(qc: QueryClient, projectId: string): void {
  qc.invalidateQueries({ queryKey: queryKeys.projects.core(projectId) });
  invalidateReportAdjacencies(qc, projectId);
}

/** Attachment upload/update/delete. */
export function afterAttachmentChange(qc: QueryClient, projectId: string): void {
  qc.invalidateQueries({ queryKey: queryKeys.projects.core(projectId) });
  invalidateAttachmentAdjacencies(qc, projectId);
}

/** Full project deletion — core is gone, list must drop the row. */
export function afterProjectDeleted(qc: QueryClient, projectId: string): void {
  qc.removeQueries({ queryKey: queryKeys.projects.core(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.projects.list() });
  qc.invalidateQueries({ queryKey: queryKeys.weekTasks.all() });
  qc.invalidateQueries({ queryKey: queryKeys.monthTasks.all() });
}

/** Team membership changes (invite, role change) — assignable-person dropdown. */
export function afterMembershipChange(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: queryKeys.assignableProfiles() });
}

/** Order form template CRUD. */
export function afterOrderFormTemplateChange(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: queryKeys.orderFormTemplates.all() });
  qc.invalidateQueries({ queryKey: queryKeys.projects.all() });
}
