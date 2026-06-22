/**
 * Invalidation helpers.
 *
 * Two flavors:
 * - `after*Change(qc, ...)` — **full** invalidation (primary + adjacent).
 *   Used by external triggers (SSE) that only know "something changed" and
 *   have no payload to prime with.
 * - `invalidate*Adjacencies(qc, ...)` — **adjacent only**. Used by mutation
 *   hooks that already called `setQueryData` on the primary; invalidating
 *   the primary here would cause a pointless refetch.
 *
 * All helpers are pure functions over a `QueryClient` → callable from React,
 * plain event listeners, anywhere. The optional `opts.refetchType` is forwarded
 * to TanStack's `invalidateQueries`. SSE callers pass `"all"` so stale queries
 * refetch silently in the background even if the user isn't currently viewing
 * them.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

export type RefetchType = "active" | "inactive" | "all" | "none";
export type InvalidateOpts = { refetchType?: RefetchType };

function inv(qc: QueryClient, queryKey: readonly unknown[], opts: InvalidateOpts = {}): void {
  qc.invalidateQueries({ queryKey, refetchType: opts.refetchType });
}

// ─── Adjacent-only (for mutation hooks) ───────────────────────────────────

/** List + bootstrap only — stammdaten/status/intake (sheet already primed via primeCore). */
export function invalidateProjectListCaches(
  qc: QueryClient,
  opts?: InvalidateOpts,
): void {
  inv(qc, queryKeys.projekteBootstrapAll(), opts);
  inv(qc, queryKeys.projekteListAll(), opts);
}

export function invalidateProjectAdjacencies(
  qc: QueryClient,
  _projectId: string,
  opts?: InvalidateOpts,
): void {
  inv(qc, queryKeys.projekteBootstrapAll(), opts);
  inv(qc, queryKeys.projekteListAll(), opts);
  inv(qc, queryKeys.weekTasks.all(), opts);
  inv(qc, queryKeys.monthTasks.all(), opts);
  inv(qc, queryKeys.techMonthTasks.all(), opts);
  inv(qc, queryKeys.calendarRange.all(), opts);
  inv(qc, queryKeys.availabilityRange.all(), opts);
}

export function invalidateReportAdjacencies(
  _qc: QueryClient,
  _projectId: string,
  _opts?: InvalidateOpts,
): void {
  // no adjacencies — sheet is the only surface
}

export function invalidateAttachmentAdjacencies(
  _qc: QueryClient,
  _projectId: string,
  _opts?: InvalidateOpts,
): void {
  // no adjacencies
}

function invalidateProjectCoreSplit(qc: QueryClient, projectId: string, opts?: Parameters<typeof inv>[2]) {
  inv(qc, queryKeys.projects.core(projectId), opts);
  inv(qc, queryKeys.projects.coreHead(projectId), opts);
  inv(qc, queryKeys.projects.coreDetails(projectId), opts);
}

export function afterProjectCoreChange(
  qc: QueryClient,
  projectId: string,
  opts?: InvalidateOpts,
): void {
  invalidateProjectCoreSplit(qc, projectId, opts);
  inv(qc, queryKeys.projects.auftragCore(projectId), opts);
  invalidateProjectListCaches(qc, opts);
}

export function afterAppointmentChange(
  qc: QueryClient,
  projectId: string,
  opts?: InvalidateOpts,
): void {
  invalidateProjectCoreSplit(qc, projectId, opts);
  inv(qc, queryKeys.projects.auftragCore(projectId), opts);
  invalidateProjectAdjacencies(qc, projectId, opts);
}

export function afterReportChange(
  qc: QueryClient,
  projectId: string,
  opts?: InvalidateOpts,
): void {
  invalidateProjectCoreSplit(qc, projectId, opts);
  invalidateReportAdjacencies(qc, projectId, opts);
}

export function afterAttachmentChange(
  qc: QueryClient,
  projectId: string,
  opts?: InvalidateOpts,
): void {
  invalidateProjectCoreSplit(qc, projectId, opts);
  inv(qc, queryKeys.projects.auftragCore(projectId), opts);
  invalidateAttachmentAdjacencies(qc, projectId, opts);
}

export function afterProjectDeleted(
  qc: QueryClient,
  projectId: string,
  opts?: InvalidateOpts,
): void {
  qc.removeQueries({ queryKey: queryKeys.projects.core(projectId) });
  qc.removeQueries({ queryKey: queryKeys.projects.coreHead(projectId) });
  qc.removeQueries({ queryKey: queryKeys.projects.coreDetails(projectId) });
  inv(qc, queryKeys.projekteBootstrapAll(), opts);
  inv(qc, queryKeys.projekteListAll(), opts);
  inv(qc, queryKeys.weekTasks.all(), opts);
  inv(qc, queryKeys.monthTasks.all(), opts);
  inv(qc, queryKeys.techMonthTasks.all(), opts);
  inv(qc, queryKeys.calendarRange.all(), opts);
  inv(qc, queryKeys.availabilityRange.all(), opts);
}

export function afterAbsenceChange(qc: QueryClient, opts?: InvalidateOpts): void {
  inv(qc, queryKeys.absences.all(), opts);
  inv(qc, queryKeys.availabilityRange.all(), opts);
}

export function afterMembershipChange(qc: QueryClient, opts?: InvalidateOpts): void {
  inv(qc, queryKeys.assignableProfiles(), opts);
  inv(qc, queryKeys.projekteBootstrapAll(), opts);
  inv(qc, queryKeys.projekteListAll(), opts);
}

export function afterOrderFormTemplateChange(qc: QueryClient, opts?: InvalidateOpts): void {
  inv(qc, queryKeys.orderFormTemplates.all(), opts);
}
