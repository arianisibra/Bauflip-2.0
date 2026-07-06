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
import type { AuftragExtras } from "@/app/(tech)/auftrag-data-actions";
import type { ProjectCore } from "@/lib/db/repository";
import { swissYmdParts } from "@/lib/date/swiss";
import { swissWeekReferenceIso } from "@/lib/date/swiss-week";
import type { ProjectAttachment } from "@/lib/domain/types";
import { queryKeys } from "./keys";

export type RefetchType = "active" | "inactive" | "all" | "none";
export type InvalidateOpts = { refetchType?: RefetchType };

export type ProjectAdjacencyInvalidateOpts = InvalidateOpts & {
  appointmentWindow?: { startsAt: string; endsAt: string };
};

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

function rangesOverlapIso(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function invalidateSwissMonthCaches(
  qc: QueryClient,
  year: number,
  month: number,
  opts?: InvalidateOpts,
): void {
  inv(qc, queryKeys.monthTasks.byYearMonth(year, month), opts);
  inv(qc, queryKeys.techMonthTasks.byYearMonth(year, month), opts);
}

function invalidateAllCalendarRangeCaches(qc: QueryClient, opts?: InvalidateOpts): void {
  inv(qc, queryKeys.weekTasks.all(), opts);
  inv(qc, queryKeys.monthTasks.all(), opts);
  inv(qc, queryKeys.techMonthTasks.all(), opts);
  inv(qc, queryKeys.calendarRange.all(), opts);
  inv(qc, queryKeys.availabilityRange.all(), opts);
}

/** Invalidate week/month/range caches overlapping an appointment window only. */
export function invalidateAppointmentRangeCaches(
  qc: QueryClient,
  window: { startsAt: string; endsAt: string },
  opts?: InvalidateOpts,
): void {
  const { startsAt, endsAt } = window;

  const startWeekRef = swissWeekReferenceIso(new Date(startsAt));
  const endWeekRef = swissWeekReferenceIso(new Date(endsAt));
  inv(qc, queryKeys.weekTasks.byDate(startWeekRef), opts);
  if (endWeekRef !== startWeekRef) {
    inv(qc, queryKeys.weekTasks.byDate(endWeekRef), opts);
  }

  const startMonth = swissYmdParts(new Date(startsAt));
  const endMonth = swissYmdParts(new Date(endsAt));
  invalidateSwissMonthCaches(qc, startMonth.y, startMonth.m, opts);
  if (startMonth.y !== endMonth.y || startMonth.m !== endMonth.m) {
    invalidateSwissMonthCaches(qc, endMonth.y, endMonth.m, opts);
  }

  for (const [queryKey] of qc.getQueriesData({ queryKey: queryKeys.calendarRange.all() })) {
    const rangeStart = queryKey[1];
    const rangeEnd = queryKey[2];
    if (
      typeof rangeStart === "string" &&
      typeof rangeEnd === "string" &&
      rangesOverlapIso(startsAt, endsAt, rangeStart, rangeEnd)
    ) {
      inv(qc, queryKey, opts);
    }
  }

  for (const [queryKey] of qc.getQueriesData({ queryKey: queryKeys.availabilityRange.all() })) {
    const rangeStart = queryKey[1];
    const rangeEnd = queryKey[2];
    if (
      typeof rangeStart === "string" &&
      typeof rangeEnd === "string" &&
      rangesOverlapIso(startsAt, endsAt, rangeStart, rangeEnd)
    ) {
      inv(qc, queryKey, opts);
    }
  }
}

export function invalidateProjectAdjacencies(
  qc: QueryClient,
  _projectId: string,
  opts?: ProjectAdjacencyInvalidateOpts,
): void {
  invalidateProjectListCaches(qc, opts);
  const { appointmentWindow, ...invOpts } = opts ?? {};
  if (appointmentWindow) {
    invalidateAppointmentRangeCaches(qc, appointmentWindow, invOpts);
  } else {
    invalidateAllCalendarRangeCaches(qc, invOpts);
  }
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
  // Core includes status, shown on calendar tiles — invalidate adjacencies too.
  invalidateProjectAdjacencies(qc, projectId, opts);
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

function appendAttachment(
  list: ProjectAttachment[] | undefined,
  attachment: ProjectAttachment,
): ProjectAttachment[] {
  const existing = list ?? [];
  if (existing.some((a) => a.id === attachment.id)) return existing;
  return [...existing, attachment];
}

/** Patch caches after upload — avoids refetching full project core. */
export function patchAttachmentAdded(
  qc: QueryClient,
  projectId: string,
  attachment: ProjectAttachment,
): void {
  patchAttachmentsInCaches(qc, projectId, (list) => appendAttachment(list, attachment));
}

function patchAttachmentsInCaches(
  qc: QueryClient,
  projectId: string,
  patchList: (list: ProjectAttachment[] | undefined) => ProjectAttachment[],
): void {
  qc.setQueryData<ProjectCore>(queryKeys.projects.core(projectId), (old) =>
    old ? { ...old, attachments: patchList(old.attachments) } : old,
  );
  qc.setQueryData<{ attachments: ProjectAttachment[]; reports: ProjectCore["reports"] }>(
    queryKeys.projects.coreDetails(projectId),
    (old) => (old ? { ...old, attachments: patchList(old.attachments) } : old),
  );
  qc.setQueryData<ProjectCore>(queryKeys.projects.auftragCore(projectId), (old) =>
    old ? { ...old, attachments: patchList(old.attachments) } : old,
  );
  qc.setQueriesData<AuftragExtras>(
    { queryKey: queryKeys.auftragExtrasPrefix(projectId) },
    (old) => (old ? { ...old, signedAttachments: patchList(old.signedAttachments) } : old),
  );
}

export function patchAttachmentNotesUpdated(
  qc: QueryClient,
  projectId: string,
  attachmentId: string,
  notes: string | null,
): void {
  patchAttachmentsInCaches(qc, projectId, (list) =>
    (list ?? []).map((a) => (a.id === attachmentId ? { ...a, notes } : a)),
  );
}

export function patchAttachmentRemoved(
  qc: QueryClient,
  projectId: string,
  attachmentId: string,
): void {
  patchAttachmentsInCaches(qc, projectId, (list) =>
    (list ?? []).filter((a) => a.id !== attachmentId),
  );
}

export function afterAttachmentChange(
  qc: QueryClient,
  projectId: string,
  opts?: InvalidateOpts,
): void {
  invalidateProjectCoreSplit(qc, projectId, opts);
  inv(qc, queryKeys.projects.auftragCore(projectId), opts);
  inv(qc, queryKeys.auftragExtrasPrefix(projectId), opts);
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
  inv(qc, queryKeys.teamMembers(), opts);
  inv(qc, queryKeys.assignableProfiles(), opts);
  inv(qc, queryKeys.projekteBootstrapAll(), opts);
  inv(qc, queryKeys.projekteListAll(), opts);
}

export function afterOrderFormTemplateChange(qc: QueryClient, opts?: InvalidateOpts): void {
  inv(qc, queryKeys.orderFormTemplates.all(), opts);
}

export function afterTimeEntryChange(qc: QueryClient, opts?: InvalidateOpts): void {
  inv(qc, queryKeys.timeEntries.all(), opts);
}

export function afterPriceBookChange(qc: QueryClient, opts?: InvalidateOpts): void {
  inv(qc, queryKeys.priceBook(), opts);
}

export function afterQuoteChange(
  qc: QueryClient,
  projectId: string,
  opts?: InvalidateOpts,
): void {
  inv(qc, queryKeys.quotes.byProject(projectId), opts);
  // Status-Kopplung (sent/approved) ändert den Projekt-Status → Core + Liste.
  invalidateProjectCoreSplit(qc, projectId, opts);
  invalidateProjectListCaches(qc, opts);
}
