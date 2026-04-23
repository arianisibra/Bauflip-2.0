/**
 * Remote-event dispatcher. Single entry point for cache invalidations triggered
 * by something *other than* the current tab's own mutation — e.g., SSE,
 * WebSocket, Supabase Realtime, BroadcastChannel, postMessage.
 *
 * Wiring an event source is a separate concern: subscribe somewhere, parse the
 * message into a `RealtimeEvent`, then call `dispatchRealtimeEvent(qc, event)`.
 *
 * All invalidation logic lives in `./invalidations.ts`. Add a new event kind
 * here if the server ever emits a new class of change.
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
  | { type: "order_form_template.changed" };

export function dispatchRealtimeEvent(qc: QueryClient, event: RealtimeEvent): void {
  switch (event.type) {
    case "project.core_changed":
      inv.afterProjectCoreChange(qc, event.projectId);
      return;
    case "project.deleted":
      inv.afterProjectDeleted(qc, event.projectId);
      return;
    case "appointment.changed":
      inv.afterAppointmentChange(qc, event.projectId);
      return;
    case "report.changed":
      inv.afterReportChange(qc, event.projectId);
      return;
    case "attachment.changed":
      inv.afterAttachmentChange(qc, event.projectId);
      return;
    case "membership.changed":
      inv.afterMembershipChange(qc);
      return;
    case "order_form_template.changed":
      inv.afterOrderFormTemplateChange(qc);
      return;
  }
}
