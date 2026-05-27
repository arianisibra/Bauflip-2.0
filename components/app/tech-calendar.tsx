"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { WeekTaskItem } from "@/lib/domain/types";
import { projectStatusBadgeClassName, projectStatusLabels } from "@/lib/domain/types";
import { groupWeekTasksByProjectDay } from "@/lib/tech/group-week-tasks-by-project-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BauflipLoadingInline } from "@/components/ui/bauflip-loading";
import { ChevronLeft, ChevronRight, Clock, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  shiftSwissDayKey,
  shiftSwissMonthInDayKey,
  swissWeekDays,
  swissWeekReferenceIsoFromDayKey,
} from "@/lib/date/swiss-week";
import { todayKeySwiss } from "@/lib/date/swiss";
import { useTechMonthTasks, useWeekTasks } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import {
  buildAuftragHref,
  buildTechCalendarHref,
  parseTechCalendarUrlState,
  type TechCalendarView,
} from "@/lib/navigation/tech-field-navigation";

const DAY_NAMES_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const TZ = "Europe/Zurich";

function toSwissDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

function weekdayMon0FromDayKey(dayKey: string): number {
  const iso = swissWeekReferenceIsoFromDayKey(dayKey);
  const days = swissWeekDays(iso);
  const i = days.findIndex((x) => x.key === dayKey);
  return i >= 0 ? i : 0;
}

function taskMatchesSearch(task: WeekTaskItem, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const hay = [task.projectTitle, task.technicianName, task.serviceAddressShort, task.tenantDisplay]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const statusLabel = (projectStatusLabels[task.projectStatus] ?? task.projectStatus).toLowerCase();
  return hay.includes(q) || statusLabel.includes(q);
}

/** `type="week"` value `YYYY-Www` for the ISO week of a Swiss calendar day `YYYY-MM-DD`. */
function isoWeekInputValueFromDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, "0")}`;
}

export function TechCalendar({
  initialTasks,
  isTechnicianView,
}: {
  initialTasks: WeekTaskItem[];
  isTechnicianView: boolean;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const todayKey = useMemo(() => todayKeySwiss(), []);

  const urlState = useMemo(
    () => parseTechCalendarUrlState(searchParams, todayKey),
    [searchParams, todayKey],
  );

  const [viewMode, setViewMode] = useState<TechCalendarView>(urlState.viewMode);
  const [focusDayKey, setFocusDayKey] = useState(urlState.focusDayKey);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(urlState.selectedTechnicianId);
  const [searchQuery, setSearchQuery] = useState(urlState.searchQuery);

  useEffect(() => {
    setViewMode(urlState.viewMode);
    setFocusDayKey(urlState.focusDayKey);
    setSelectedTechnicianId(urlState.selectedTechnicianId);
    setSearchQuery(urlState.searchQuery);
  }, [urlState]);

  const calendarReturnHref = useMemo(
    () =>
      buildTechCalendarHref({
        viewMode,
        focusDayKey,
        selectedTechnicianId,
        searchQuery,
      }),
    [viewMode, focusDayKey, selectedTechnicianId, searchQuery],
  );

  const pushCalendarUrl = useCallback(
    (state: {
      viewMode: TechCalendarView;
      focusDayKey: string;
      selectedTechnicianId: string;
      searchQuery: string;
    }) => {
      if (pathname !== "/wochenplan") return;
      const next = buildTechCalendarHref(state);
      const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      if (current !== next) router.replace(next, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    pushCalendarUrl({ viewMode, focusDayKey, selectedTechnicianId, searchQuery });
  }, [viewMode, focusDayKey, selectedTechnicianId, searchQuery, pushCalendarUrl]);

  const refDateIso = useMemo(() => swissWeekReferenceIsoFromDayKey(focusDayKey), [focusDayKey]);
  const monthY = Number(focusDayKey.slice(0, 4));
  const monthM = Number(focusDayKey.slice(5, 7));

  // Seed the initial week's cache from SSR so the first render has data without a fetch.
  useMemo(() => {
    qc.setQueryData(queryKeys.weekTasks.byDate(refDateIso), initialTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: weekTasks = [], isFetching: weekPending } = useWeekTasks(refDateIso, viewMode !== "month");
  const { data: monthTasks = [], isFetching: monthPending } = useTechMonthTasks(monthY, monthM, viewMode === "month");

  const tasks = viewMode === "month" ? monthTasks : weekTasks;
  const pending = viewMode === "month" ? monthPending : weekPending;

  const technicianOptions = useMemo(() => {
    if (isTechnicianView) return [];
    const map = new Map<string, { id: string; name: string }>();
    for (const task of tasks) {
      if (!task.assignedTechnicianId || !task.technicianName) continue;
      if (!map.has(task.assignedTechnicianId)) {
        map.set(task.assignedTechnicianId, {
          id: task.assignedTechnicianId,
          name: task.technicianName,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
  }, [isTechnicianView, tasks]);

  const visibleTasks = useMemo(() => {
    if (isTechnicianView || selectedTechnicianId === "all") return tasks;
    return tasks.filter((task) => task.assignedTechnicianId === selectedTechnicianId);
  }, [isTechnicianView, selectedTechnicianId, tasks]);

  const searchFilteredTasks = useMemo(
    () => visibleTasks.filter((t) => taskMatchesSearch(t, searchQuery)),
    [visibleTasks, searchQuery],
  );

  const daysToRender = useMemo(() => {
    if (viewMode === "week") {
      return swissWeekDays(refDateIso).map((x, i) => ({
        key: x.key,
        day: x.day,
        monthShort: x.monthShort,
        weekdayShort: DAY_NAMES_SHORT[i],
      }));
    }
    if (viewMode === "day") {
      const days = swissWeekDays(refDateIso);
      const one = days.find((x) => x.key === focusDayKey);
      if (!one) return [];
      const i = days.indexOf(one);
      return [
        {
          key: one.key,
          day: one.day,
          monthShort: one.monthShort,
          weekdayShort: DAY_NAMES_SHORT[i],
        },
      ];
    }
    const dim = new Date(monthY, monthM, 0).getDate();
    const monthShortLabel = new Intl.DateTimeFormat("de-CH", { month: "short", timeZone: TZ }).format(
      new Date(Date.UTC(monthY, monthM - 1, 15, 12, 0, 0)),
    );
    const rows: { key: string; day: number; monthShort: string; weekdayShort: string }[] = [];
    for (let d = 1; d <= dim; d++) {
      const key = `${monthY}-${String(monthM).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      rows.push({
        key,
        day: d,
        monthShort: monthShortLabel,
        weekdayShort: DAY_NAMES_SHORT[weekdayMon0FromDayKey(key)],
      });
    }
    return rows;
  }, [viewMode, refDateIso, focusDayKey, monthY, monthM]);

  const headerLabel = useMemo(() => {
    if (viewMode === "day") {
      const [y, m, d] = focusDayKey.split("-").map(Number);
      return new Intl.DateTimeFormat("de-CH", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: TZ,
      }).format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
    }
    if (viewMode === "week") {
      const days = swissWeekDays(refDateIso);
      if (days.length < 2) return "";
      const first = days[0];
      const last = days[days.length - 1];
      return `${first.day}. ${first.monthShort} – ${last.day}. ${last.monthShort}`;
    }
    return new Intl.DateTimeFormat("de-CH", { month: "long", year: "numeric", timeZone: TZ }).format(
      new Date(Date.UTC(monthY, monthM - 1, 15, 12, 0, 0)),
    );
  }, [viewMode, focusDayKey, refDateIso, monthY, monthM]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, WeekTaskItem[]>();
    for (const t of searchFilteredTasks) {
      const key = toSwissDateKey(new Date(t.startsAt));
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return map;
  }, [searchFilteredTasks]);

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (viewMode === "day") setFocusDayKey((k) => shiftSwissDayKey(k, dir));
      else if (viewMode === "week") setFocusDayKey((k) => shiftSwissDayKey(k, dir * 7));
      else setFocusDayKey((k) => shiftSwissMonthInDayKey(k, dir));
    },
    [viewMode],
  );

  const navAria =
    viewMode === "day" ? { prev: "Vorheriger Tag", next: "Nächster Tag" } :
    viewMode === "week" ? { prev: "Vorherige Woche", next: "Nächste Woche" } :
    { prev: "Vorheriger Monat", next: "Nächster Monat" };

  const monthPickerValue = `${monthY}-${String(monthM).padStart(2, "0")}`;
  const weekPickerValue = useMemo(() => isoWeekInputValueFromDayKey(focusDayKey), [focusDayKey]);

  return (
    <div className={cn("space-y-4", pending && "opacity-60 transition-opacity")}>
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-2 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Suchen …"
          aria-label="Termine durchsuchen"
          className="h-7 pl-8 text-xs"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          onClick={() => navigate(-1)}
          disabled={pending}
          aria-label={navAria.prev}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex min-h-9 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-semibold leading-snug text-foreground">{headerLabel}</p>
          {pending ? <BauflipLoadingInline label="Wird geladen …" /> : null}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          onClick={() => navigate(1)}
          disabled={pending}
          aria-label={navAria.next}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {viewMode === "day" ? (
        <input
          type="date"
          className="h-9 w-full rounded-lg border border-border/70 bg-background px-2 text-sm font-medium shadow-sm sm:max-w-[11rem]"
          value={focusDayKey}
          onChange={(e) => {
            const v = e.target.value;
            if (v) setFocusDayKey(v);
          }}
          aria-label="Datum wählen"
        />
      ) : null}
      {viewMode === "week" ? (
        <input
          type="week"
          className="h-9 w-full rounded-lg border border-border/70 bg-background px-2 text-sm font-medium shadow-sm sm:max-w-[12.5rem]"
          value={weekPickerValue}
          aria-label="Kalenderwoche wählen"
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const parsed = /^(\d{4})-W(\d{2})$/.exec(v);
            if (!parsed) return;
            const y = Number(parsed[1]);
            const w = Number(parsed[2]);
            if (!y || !w) return;
            const jan4 = new Date(Date.UTC(y, 0, 4));
            const jan4Day = jan4.getUTCDay() || 7;
            const mondayWeek1 = new Date(jan4);
            mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
            const targetMonday = new Date(mondayWeek1);
            targetMonday.setUTCDate(mondayWeek1.getUTCDate() + (w - 1) * 7);
            setFocusDayKey(toSwissDateKey(targetMonday));
          }}
        />
      ) : null}
      {viewMode === "month" ? (
        <input
          type="month"
          className="h-9 w-full rounded-lg border border-border/70 bg-background px-2 text-sm font-medium shadow-sm sm:max-w-[11rem]"
          value={monthPickerValue}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const [y, mo] = v.split("-").map(Number);
            if (!y || !mo) return;
            setFocusDayKey((prev) => {
              const d0 = Number(prev.slice(8, 10));
              const dim = new Date(y, mo, 0).getDate();
              const d = Math.min(d0, dim);
              return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            });
          }}
          aria-label="Monat wählen"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {!isTechnicianView ? (
          <>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Monteur:</span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={selectedTechnicianId}
              onChange={(e) => setSelectedTechnicianId(e.target.value)}
            >
              <option value="all">Alle</option>
              {technicianOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <div
          className={cn(
            "inline-flex h-8 items-stretch rounded-lg border border-border/60 bg-muted/45 p-0.5 text-[11px] font-semibold",
            !isTechnicianView && "sm:ml-1",
          )}
          role="tablist"
          aria-label="Zeitraum"
        >
          {(["day", "week", "month"] as TechCalendarView[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={viewMode === m}
              onClick={() => setViewMode(m)}
              className={cn(
                "min-w-[3.25rem] rounded-md px-2.5 transition-[color,background-color,box-shadow]",
                viewMode === m
                  ? "bg-background text-foreground shadow-sm"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "day" ? "Tag" : m === "week" ? "Woche" : "Monat"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {daysToRender.map((dayInfo) => {
          const dateKey = dayInfo.key;
          const isToday = dateKey === todayKey;
          const dayTasksRaw = tasksByDate.get(dateKey) ?? [];
          const dayTaskGroups = groupWeekTasksByProjectDay(dayTasksRaw);

          return (
            <div
              key={dateKey}
              className={cn(
                "rounded-2xl border bg-card shadow-sm",
                isToday ? "border-primary/30 ring-1 ring-primary/20" : "border-border",
              )}
            >
              <div className="flex items-center gap-2 px-4 py-2.5">
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-sm font-semibold",
                    isToday ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground",
                  )}
                >
                  {dayInfo.day}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", isToday ? "text-primary" : "text-foreground")}>
                    {viewMode === "month" ? `${dayInfo.weekdayShort} · ${dayInfo.monthShort}` : dayInfo.weekdayShort}
                  </p>
                </div>
                {dayTaskGroups.length > 0 ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {dayTaskGroups.length} {dayTaskGroups.length === 1 ? "Einsatz" : "Einsätze"}
                  </Badge>
                ) : null}
              </div>

              {dayTaskGroups.length > 0 ? (
                <div className="space-y-1 border-t border-border/50 px-3 pb-3 pt-2">
                  {dayTaskGroups.map((group) => {
                    const task = group.primary;
                    const isBesichtigung = task.kind === "besichtigung";
                    const isDone = task.projectStatus === "abgeschlossen";
                    return (
                      <Link
                        key={group.key}
                        href={buildAuftragHref(task.projectId, calendarReturnHref)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-transform active:scale-[0.98]",
                          isDone
                            ? "border-l-4 border-muted-foreground/30 border-t-border border-r-border border-b-border bg-card opacity-60"
                            : isBesichtigung
                              ? "border-l-4 border-orange-500 border-t-border border-r-border border-b-border bg-card"
                              : "border-l-4 border-emerald-400 border-t-border border-r-border border-b-border bg-card",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="space-y-0.5">
                            {group.slots.map((s) => (
                              <p
                                key={s.appointmentId}
                                className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground"
                              >
                                <Clock className="size-3 shrink-0" />
                                {formatTime(s.startsAt)}–{formatTime(s.endsAt)}
                              </p>
                            ))}
                          </div>
                          <p
                            className={cn(
                              "mt-0.5 line-clamp-1 text-sm font-semibold",
                              isDone ? "text-muted-foreground line-through" : "text-foreground",
                            )}
                          >
                            {task.projectTitle}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                "max-w-full truncate px-1.5 py-px text-[9px] font-semibold leading-tight",
                                projectStatusBadgeClassName(task.projectStatus),
                              )}
                            >
                              {projectStatusLabels[task.projectStatus] ?? task.projectStatus}
                            </Badge>
                          </div>
                          {task.serviceAddressShort ? (
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              <span className="line-clamp-1">{task.serviceAddressShort}</span>
                            </p>
                          ) : null}
                        </div>
                        {!isDone ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 max-w-[10rem] truncate text-[9px] font-semibold",
                              isBesichtigung
                                ? "border-orange-500/30 bg-orange-500/10 text-orange-900 dark:text-orange-200"
                                : "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
                            )}
                          >
                            {isBesichtigung ? "Besichtigung" : "Ausführung"}
                          </Badge>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="border-t border-border/30 px-4 py-2">
                  <p className="text-[11px] text-muted-foreground">Keine Termine</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
