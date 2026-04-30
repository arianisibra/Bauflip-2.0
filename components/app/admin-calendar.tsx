"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import type { WeekTaskItem } from "@/lib/domain/types";
import {
  groupWeekTasksByProjectDay,
  swissDayKeyFromTaskStart,
  type WeekTaskProjectDayGroup,
} from "@/lib/tech/group-week-tasks-by-project-day";
import { formatWeekRangeDe, getSwissDayBounds, getWeekBounds } from "@/lib/date/week-bounds";
import { Button } from "@/components/ui/button";
import { BauflipLoadingInline } from "@/components/ui/bauflip-loading";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCalendarRangeTasks } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const TZ = "Europe/Zurich";

type CalendarViewMode = "month" | "week" | "day";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: TZ,
  });
}

function swissYmdFromDate(d: Date): { y: number; m: number; day: number } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m, day] = s.split("-").map(Number);
  return { y, m, day };
}

function shiftCalendarDays(d: Date, deltaDays: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + deltaDays);
  return n;
}

/** ISO-Woche (Jahr laut ISO) aus Kalendertag Y-M-D (Schweizer Tag des Termins). */
function isoWeekKeyFromYmd(y: number, m: number, d: number): string {
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, "0")}`;
}

function isoWeekKeyFromTaskStart(iso: string): string {
  const dk = swissDayKeyFromTaskStart(iso);
  const [y, m, d] = dk.split("-").map(Number);
  return isoWeekKeyFromYmd(y, m, d);
}

function formatIsoWeekHeading(key: string): string {
  const [ys, w] = key.split("-W");
  return `KW ${Number(w)} · ${ys}`;
}

function bucketGroupsByIsoWeek(groups: WeekTaskProjectDayGroup[]): { weekKey: string; groups: WeekTaskProjectDayGroup[] }[] {
  const map = new Map<string, WeekTaskProjectDayGroup[]>();
  for (const g of groups) {
    const wk = isoWeekKeyFromTaskStart(g.primary.startsAt);
    const list = map.get(wk) ?? [];
    list.push(g);
    map.set(wk, list);
  }
  const keys = [...map.keys()].sort();
  return keys.map((weekKey) => ({
    weekKey,
    groups: (map.get(weekKey) ?? []).sort((a, b) => a.primary.startsAt.localeCompare(b.primary.startsAt)),
  }));
}

export function AdminCalendar({
  initialTasks,
  initialYear,
  initialMonth,
}: {
  initialTasks: WeekTaskItem[];
  initialYear: number;
  initialMonth: number;
}) {
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [anchorDate, setAnchorDate] = useState(() => new Date(initialYear, initialMonth - 1, 15));
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>("all");
  const [sortMode, setSortMode] = useState<"time" | "technician">("time");

  const { startIso, endIso, heading, rangeLabel } = useMemo(() => {
    if (viewMode === "month") {
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      return {
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        heading: `${MONTH_NAMES[month - 1]} ${year}`,
        rangeLabel: "Monat",
      };
    }
    if (viewMode === "week") {
      const { start, end } = getWeekBounds(anchorDate);
      return {
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        heading: formatWeekRangeDe(start, end),
        rangeLabel: "Kalenderwoche",
      };
    }
    const { start, end } = getSwissDayBounds(anchorDate);
    const headingLong = new Intl.DateTimeFormat("de-CH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: TZ,
    }).format(anchorDate);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      heading: headingLong,
      rangeLabel: "Tag",
    };
  }, [viewMode, year, month, anchorDate]);

  useEffect(() => {
    const start = new Date(initialYear, initialMonth - 1, 1, 0, 0, 0, 0);
    const end = new Date(initialYear, initialMonth, 0, 23, 59, 59, 999);
    qc.setQueryData(queryKeys.calendarRange.byStartEnd(start.toISOString(), end.toISOString()), initialTasks);
    qc.setQueryData(queryKeys.monthTasks.byYearMonth(initialYear, initialMonth), initialTasks);
  }, [qc, initialYear, initialMonth, initialTasks]);

  const { data: tasks = [], isFetching: pending } = useCalendarRangeTasks(startIso, endIso);

  const technicianOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const task of tasks) {
      if (!task.assignedTechnicianId || !task.technicianName) continue;
      if (!map.has(task.assignedTechnicianId)) {
        map.set(task.assignedTechnicianId, { id: task.assignedTechnicianId, name: task.technicianName });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    if (selectedTechnicianId === "all") return tasks;
    return tasks.filter((task) => task.assignedTechnicianId === selectedTechnicianId);
  }, [selectedTechnicianId, tasks]);

  const groupedTasks = useMemo(() => {
    const groups = groupWeekTasksByProjectDay(visibleTasks);
    return groups.sort((a, b) => {
      if (sortMode === "technician") {
        const byName = (a.primary.technicianName ?? "").localeCompare(b.primary.technicianName ?? "", "de-CH");
        if (byName !== 0) return byName;
      }
      return a.primary.startsAt.localeCompare(b.primary.startsAt);
    });
  }, [sortMode, visibleTasks]);

  const groupedByWeek = useMemo(() => bucketGroupsByIsoWeek(groupedTasks), [groupedTasks]);

  const navigateMonth = useCallback(
    (dir: -1 | 1) => {
      let newMonth = month + dir;
      let newYear = year;
      if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      } else if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
      setYear(newYear);
      setMonth(newMonth);
      setAnchorDate(new Date(newYear, newMonth - 1, 15));
    },
    [year, month],
  );

  const navigateWeek = useCallback((dir: -1 | 1) => {
    setAnchorDate((d) => shiftCalendarDays(d, dir * 7));
  }, []);

  const navigateDay = useCallback((dir: -1 | 1) => {
    setAnchorDate((d) => shiftCalendarDays(d, dir));
  }, []);

  const onNavigate = useCallback(
    (dir: -1 | 1) => {
      if (viewMode === "month") navigateMonth(dir);
      else if (viewMode === "week") navigateWeek(dir);
      else navigateDay(dir);
    },
    [viewMode, navigateMonth, navigateWeek, navigateDay],
  );

  const onViewModeChange = useCallback((next: CalendarViewMode) => {
    setViewMode(next);
    if (next === "month") {
      const { y, m } = swissYmdFromDate(anchorDate);
      setYear(y);
      setMonth(m);
    }
    if (next === "week" || next === "day") {
      setAnchorDate(new Date(year, month - 1, 15));
    }
  }, [anchorDate, year, month]);

  const dayPickerValue = useMemo(() => {
    const { y, m, day } = swissYmdFromDate(anchorDate);
    return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }, [anchorDate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onNavigate(-1)}
            disabled={pending}
            aria-label={
              viewMode === "month"
                ? "Vorheriger Monat"
                : viewMode === "week"
                  ? "Vorherige Woche"
                  : "Vorheriger Tag"
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex min-h-9 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center sm:flex-initial">
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">{heading}</h2>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{rangeLabel}</p>
            {pending ? <BauflipLoadingInline label="Wird geladen …" /> : null}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onNavigate(1)}
            disabled={pending}
            aria-label={
              viewMode === "month" ? "Nächster Monat" : viewMode === "week" ? "Nächste Woche" : "Nächster Tag"
            }
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Zeitraum:</span>
          <select
            className="h-9 min-w-[7rem] rounded-md border border-input bg-background px-2 text-xs font-medium"
            value={viewMode}
            onChange={(e) => onViewModeChange(e.target.value as CalendarViewMode)}
          >
            <option value="month">Monat</option>
            <option value="week">Woche</option>
            <option value="day">Tag</option>
          </select>
          {viewMode === "day" ? (
            <input
              type="date"
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              value={dayPickerValue}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const [y, mo, d] = v.split("-").map(Number);
                if (!y || !mo || !d) return;
                setAnchorDate(new Date(y, mo - 1, d));
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        <span className="ml-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sortierung:</span>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as "time" | "technician")}
        >
          <option value="time">Uhrzeit</option>
          <option value="technician">Monteur</option>
        </select>
      </div>

      <div className="space-y-3">
        {groupedTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Keine Termine in diesem Zeitraum.</p>
          </div>
        ) : (
          groupedByWeek.map(({ weekKey, groups }) => (
            <section key={weekKey} aria-label={formatIsoWeekHeading(weekKey)} className="space-y-1.5">
              <h3 className="border-b border-border/70 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {formatIsoWeekHeading(weekKey)}
              </h3>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {groups.map((group) => {
                  const task = group.primary;
                  return (
                    <Link
                      key={group.key}
                      href={`/projekte?sheet=${task.projectId}`}
                      className="flex min-h-0 items-stretch gap-2 rounded-lg border border-border/90 bg-card px-2 py-1.5 text-left shadow-sm outline-none ring-offset-background transition-colors hover:border-border hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div
                        className="w-1 shrink-0 self-stretch rounded-full"
                        style={{ backgroundColor: task.calendarColor }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
                          {formatDate(task.startsAt)} · {formatTime(task.startsAt)}
                        </p>
                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                          {task.projectTitle}
                        </p>
                        <div className="flex flex-wrap items-center gap-1">
                          {task.technicianName ? (
                            <span
                              className="inline-flex max-w-full truncate rounded border px-1 py-px text-[9px] font-medium leading-tight"
                              style={{
                                borderColor: `${task.calendarColor}55`,
                                backgroundColor: `${task.calendarColor}1f`,
                                color: task.calendarColor,
                              }}
                            >
                              {task.technicianName}
                            </span>
                          ) : null}
                          {group.slots.length > 1 ? (
                            <span className="text-[9px] text-muted-foreground">
                              +{group.slots.length - 1}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
