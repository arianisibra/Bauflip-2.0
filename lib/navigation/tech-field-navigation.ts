import type { ReadonlyURLSearchParams } from "next/navigation";
import { sanitizeAppReturnTo } from "@/lib/navigation/app-return-to";

export type TechCalendarView = "day" | "week" | "month";

export type TechCalendarUrlState = {
  viewMode: TechCalendarView;
  focusDayKey: string;
  selectedTechnicianId: string;
  searchQuery: string;
};

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseTechCalendarUrlState(
  searchParams: Pick<ReadonlyURLSearchParams, "get">,
  defaultDayKey: string,
): TechCalendarUrlState {
  const rawView = searchParams.get("view");
  const viewMode: TechCalendarView =
    rawView === "week" || rawView === "month" ? rawView : "day";
  const rawDay = searchParams.get("day");
  const focusDayKey = rawDay && DAY_KEY_RE.test(rawDay) ? rawDay : defaultDayKey;
  const tech = searchParams.get("tech");
  const selectedTechnicianId = tech && tech !== "all" ? tech : "all";
  const searchQuery = searchParams.get("q") ?? "";
  return { viewMode, focusDayKey, selectedTechnicianId, searchQuery };
}

export function buildTechCalendarSearchParams(state: TechCalendarUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.viewMode !== "day") params.set("view", state.viewMode);
  if (state.focusDayKey) params.set("day", state.focusDayKey);
  if (state.selectedTechnicianId !== "all") params.set("tech", state.selectedTechnicianId);
  const q = state.searchQuery.trim();
  if (q) params.set("q", q);
  return params;
}

export function buildTechCalendarHref(state: TechCalendarUrlState): string {
  const qs = buildTechCalendarSearchParams(state).toString();
  return qs ? `/wochenplan?${qs}` : "/wochenplan";
}

/** Interne Rücknavigation (Feld-Routen + Büro-Kalender). */
export const sanitizeTechReturnTo = sanitizeAppReturnTo;

export function buildAuftragHref(projectId: string, returnTo: string | null): string {
  const base = `/auftrag/${projectId}`;
  const safe = sanitizeTechReturnTo(returnTo);
  if (!safe) return base;
  const params = new URLSearchParams();
  params.set("returnTo", safe);
  return `${base}?${params.toString()}`;
}
