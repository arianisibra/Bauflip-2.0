import type { ReadonlyURLSearchParams } from "next/navigation";
import { swissYmdParts } from "@/lib/date/swiss";
import { sanitizeAppReturnTo } from "@/lib/navigation/app-return-to";

export function dayKeyFromDate(d: Date): string {
  const { y, m, day } = swissYmdParts(d);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type AdminCalendarViewMode = "year" | "month" | "week" | "day" | "availability";

export type AdminCalendarUrlState = {
  viewMode: AdminCalendarViewMode;
  dayKey: string;
  selectedTechnicianId: string;
  sortMode: "time" | "technician";
};

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const VIEW_MODES = new Set<AdminCalendarViewMode>(["year", "month", "week", "day", "availability"]);

/** Mittag UTC — vermeidet TZ-Drift zwischen dayKey (Zürich) und lokalem `Date`. */
export function anchorDateFromDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

export function calendarQueriesEqual(currentQs: string, builtHref: string): boolean {
  const builtQs = builtHref.includes("?") ? builtHref.split("?")[1] ?? "" : "";
  const a = new URLSearchParams(currentQs);
  const b = new URLSearchParams(builtQs);
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of keys) {
    if (a.get(k) !== b.get(k)) return false;
  }
  return true;
}

export function parseAdminCalendarUrlState(
  searchParams: Pick<ReadonlyURLSearchParams, "get">,
  defaultDayKey: string,
): AdminCalendarUrlState {
  const rawView = searchParams.get("view");
  const viewMode: AdminCalendarViewMode =
    rawView && VIEW_MODES.has(rawView as AdminCalendarViewMode)
      ? (rawView as AdminCalendarViewMode)
      : "day";
  const rawDay = searchParams.get("day");
  const dayKey = rawDay && DAY_KEY_RE.test(rawDay) ? rawDay : defaultDayKey;
  const tech = searchParams.get("tech");
  const selectedTechnicianId = tech && tech !== "all" ? tech : "all";
  const rawSort = searchParams.get("sort");
  const sortMode: AdminCalendarUrlState["sortMode"] =
    rawSort === "time" ? "time" : "technician";
  return { viewMode, dayKey, selectedTechnicianId, sortMode };
}

export function buildAdminCalendarSearchParams(state: AdminCalendarUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.viewMode !== "day") params.set("view", state.viewMode);
  if (state.dayKey) params.set("day", state.dayKey);
  if (state.selectedTechnicianId !== "all") params.set("tech", state.selectedTechnicianId);
  if (state.sortMode !== "technician") params.set("sort", state.sortMode);
  return params;
}

export function buildAdminCalendarHref(state: AdminCalendarUrlState): string {
  const qs = buildAdminCalendarSearchParams(state).toString();
  return qs ? `/kalender?${qs}` : "/kalender";
}

/** Kalender-Query sync ohne Next.js-Navigation — vermeidet RSC-Reload + weekTasksFromAppointmentRange. */
export function syncAdminCalendarInUrl(state: AdminCalendarUrlState): void {
  if (typeof globalThis.location === "undefined") return;
  const params = buildAdminCalendarSearchParams(state);
  const current = new URLSearchParams(globalThis.location.search);
  const sheet = current.get("sheet");
  if (sheet) params.set("sheet", sheet);
  const qs = params.toString();
  globalThis.history.replaceState(null, "", qs ? `/kalender?${qs}` : "/kalender");
}

/** Deep-link: Kalender-Ansicht + Projekt-Sheet ohne Route-Wechsel zu /projekte. */
export function buildKalenderSheetHref(
  projectId: string,
  calendarState: AdminCalendarUrlState,
): string {
  const params = buildAdminCalendarSearchParams(calendarState);
  params.set("sheet", projectId);
  return `/kalender?${params.toString()}`;
}

export function buildProjekteSheetHref(projectId: string, returnTo: string | null): string {
  const base = `/projekte?sheet=${encodeURIComponent(projectId)}&from=kalender`;
  const safe = sanitizeAppReturnTo(returnTo);
  if (!safe) return base;
  const params = new URLSearchParams();
  params.set("sheet", projectId);
  params.set("from", "kalender");
  params.set("returnTo", safe);
  return `/projekte?${params.toString()}`;
}

export { sanitizeAppReturnTo };
