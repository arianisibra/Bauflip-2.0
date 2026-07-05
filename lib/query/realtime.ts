/**
 * Realtime-event dispatcher. Single entry point for cache invalidations
 * triggered by something *other than* the current tab's own mutation — today
 * Supabase Realtime broadcast (wired in `realtime-bridge.tsx`). The same
 * dispatcher would accept events from polling or `postMessage` without logic changes.
 *
 * Events carry an optional `originTabId`. The realtime bridge filters echoes by
 * comparing against the local tab ID *before* dispatching, so this module
 * stays source-agnostic.
 */
import type { QueryClient } from "@tanstack/react-query";
import * as inv from "./invalidations";

export type RealtimeEvent =
  | { type: "project.core_changed"; projectId: string }
  | { type: "project.deleted"; projectId: string }
  | { type: "appointment.changed"; projectId: string }
  | { type: "report.changed"; projectId: string }
  | { type: "attachment.changed"; projectId: string }
  | { type: "membership.changed" }
  | { type: "order_form_template.changed" }
  | { type: "time_entry.changed" };

export type DispatchOpts = inv.InvalidateOpts;

/**
 * Route an event to the correct invalidation helper. `opts.refetchType`
 * controls whether inactive queries should refetch silently — realtime callers
 * pass `"all"` so the data is already fresh when the user navigates to the
 * affected page.
 */
export function dispatchRealtimeEvent(
  qc: QueryClient,
  event: RealtimeEvent,
  opts: DispatchOpts = {},
): void {
  switch (event.type) {
    case "project.core_changed":
      inv.afterProjectCoreChange(qc, event.projectId, opts);
      return;
    case "project.deleted":
      inv.afterProjectDeleted(qc, event.projectId, opts);
      return;
    case "appointment.changed":
      inv.afterAppointmentChange(qc, event.projectId, opts);
      return;
    case "report.changed":
      inv.afterReportChange(qc, event.projectId, opts);
      return;
    case "attachment.changed":
      inv.afterAttachmentChange(qc, event.projectId, opts);
      return;
    case "membership.changed":
      inv.afterMembershipChange(qc, opts);
      return;
    case "order_form_template.changed":
      inv.afterOrderFormTemplateChange(qc, opts);
      return;
    case "time_entry.changed":
      inv.afterTimeEntryChange(qc, opts);
      return;
  }
}
