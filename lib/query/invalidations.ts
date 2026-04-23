/**
 * Invalidation helpers — one function per mutation class.
 *
 * These are pure functions that take a QueryClient, so they can be invoked from
 * *any* context: React components (via `useQueryClient()`), event listeners,
 * SSE/WebSocket handlers, Supabase Realtime callbacks, etc.
 *
 * If a new mutation path is added, extend this file — do not call
 * `queryClient.invalidateQueries` directly from a component.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

/** Stammdaten update, status update — may affect list labels/status AND scheduling. */
export function afterProjectCoreChange(qc: QueryClient, projectId: string): void {
  qc.invalidateQueries({ queryKey: queryKeys.projects.core(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.projects.list() });
  qc.invalidateQueries({ queryKey: queryKeys.weekTasks.all() });
  qc.invalidateQueries({ queryKey: queryKeys.monthTasks.all() });
}

/** Appointment add/delete/reassign — affects scheduling views and project status. */
export function afterAppointmentChange(qc: QueryClient, projectId: string): void {
  qc.invalidateQueries({ queryKey: queryKeys.projects.core(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.projects.list() });
  qc.invalidateQueries({ queryKey: queryKeys.weekTasks.all() });
  qc.invalidateQueries({ queryKey: queryKeys.monthTasks.all() });
}

/** Technician report submit/delete — affects the project sheet's report history. */
export function afterReportChange(qc: QueryClient, projectId: string): void {
  qc.invalidateQueries({ queryKey: queryKeys.projects.core(projectId) });
}

/** Attachment upload/delete/notes — affects sheet's attachment list only. */
export function afterAttachmentChange(qc: QueryClient, projectId: string): void {
  qc.invalidateQueries({ queryKey: queryKeys.projects.core(projectId) });
}

/** Full project deletion — core no longer exists, list must drop the row. */
export function afterProjectDeleted(qc: QueryClient, projectId: string): void {
  qc.removeQueries({ queryKey: queryKeys.projects.core(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.projects.list() });
  qc.invalidateQueries({ queryKey: queryKeys.weekTasks.all() });
  qc.invalidateQueries({ queryKey: queryKeys.monthTasks.all() });
}

/** Team membership changes (invite, role change) — affects assignable dropdown. */
export function afterMembershipChange(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: queryKeys.assignableProfiles() });
}

/** Order form template CRUD — affects any place that lists templates. */
export function afterOrderFormTemplateChange(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: queryKeys.orderFormTemplates.all() });
  // Report submission re-reads templates; invalidate core too in case a sheet is open.
  qc.invalidateQueries({ queryKey: queryKeys.projects.all() });
}
