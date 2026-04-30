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

type CalendarViewMode = "year" | "month" | "week" | "day";
type CalendarScope = "upcoming" | "all";

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

function isoWeekInputValueFromDate(d: Date): string {
  const { y, m, day } = swissYmdFromDate(d);
  return isoWeekKeyFromYmd(y, m, day);
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
  const [calendarScope, setCalendarScope] = useState<CalendarScope>("upcoming");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>("all");
  const [sortMode, setSortMode] = useState<"time" | "technician">("technician");

  const { startIso, endIso, heading, rangeLabel } = useMemo(() => {
    if (viewMode === "year") {
      const start = new Date(year, 0, 1, 0, 0, 0, 0);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
      return {
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        heading: `${year}`,
        rangeLabel: "Jahr",
      };
    }
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
    const byScope =
      calendarScope === "all"
        ? tasks
        : tasks.filter((task) => new Date(task.endsAt).getTime() >= Date.now());
    if (selectedTechnicianId === "all") return byScope;
    return byScope.filter((task) => task.assignedTechnicianId === selectedTechnicianId);
  }, [selectedTechnicianId, tasks, calendarScope]);

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

  const navigateYear = useCallback(
    (dir: -1 | 1) => {
      const nextYear = year + dir;
      setYear(nextYear);
      setAnchorDate(new Date(nextYear, month - 1, 15));
    },
    [year, month],
  );

  const onNavigate = useCallback(
    (dir: -1 | 1) => {
      if (viewMode === "year") navigateYear(dir);
      else if (viewMode === "month") navigateMonth(dir);
      else if (viewMode === "week") navigateWeek(dir);
      else navigateDay(dir);
    },
    [viewMode, navigateYear, navigateMonth, navigateWeek, navigateDay],
  );

  const onViewModeChange = useCallback((next: CalendarViewMode) => {
    setViewMode(next);
    if (next === "year" || next === "month") {
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
  const monthPickerValue = useMemo(() => `${year}-${String(month).padStart(2, "0")}`, [year, month]);
  const weekPickerValue = useMemo(() => isoWeekInputValueFromDate(anchorDate), [anchorDate]);

  return (
    <div className="space-y-4">
      {/* ── Kalender-Header ─────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">

        {/* Datum + Navigation */}
        <div className="flex items-center gap-0 border-b border-border/50">
          <Button
            variant="ghost"
            size="icon"
            className="h-14 w-12 shrink-0 rounded-none rounded-tl-2xl border-r border-border/50 text-muted-foreground hover:bg-muted/60"
            onClick={() => onNavigate(-1)}
            disabled={pending}
            aria-label={viewMode === "year" ? "Vorheriges Jahr" : viewMode === "month" ? "Vorheriger Monat" : viewMode === "week" ? "Vorherige Woche" : "Vorheriger Tag"}
          >
            <ChevronLeft className="size-5" />
          </Button>

          <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0 py-3 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{rangeLabel}</span>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{heading}</h2>
            {pending ? (
              <span className="mt-0.5">
                <BauflipLoadingInline label="Wird geladen …" />
              </span>
            ) : null}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-14 w-12 shrink-0 rounded-none rounded-tr-2xl border-l border-border/50 text-muted-foreground hover:bg-muted/60"
            onClick={() => onNavigate(1)}
            disabled={pending}
            aria-label={viewMode === "year" ? "Nächstes Jahr" : viewMode === "month" ? "Nächster Monat" : viewMode === "week" ? "Nächste Woche" : "Nächster Tag"}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        {/* Steuerleiste */}
        <div className="flex flex-wrap items-center gap-2 bg-muted/30 px-4 py-2.5">

          {/* Vergangene-Toggle */}
          <button
            type="button"
            onClick={() => setCalendarScope((prev) => (prev === "upcoming" ? "all" : "upcoming"))}
            aria-pressed={calendarScope === "all"}
            title={calendarScope === "upcoming" ? "Vergangene Termine einblenden" : "Nur bevorstehende Termine"}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
              calendarScope === "all"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/70 bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <span
              className={`flex size-4 items-center justify-center rounded text-[11px] font-bold leading-none ${
                calendarScope === "all" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
              }`}
            >
              {calendarScope === "all" ? "×" : "○"}
            </span>
            Vergangene
          </button>

          <div className="mx-1 h-5 w-px bg-border/60" aria-hidden />

          {/* Zeitraum-Selector */}
          <div className="flex h-8 overflow-hidden rounded-lg border border-border/70 bg-background text-xs font-semibold shadow-sm">
            {(["year", "month", "week", "day"] as CalendarViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onViewModeChange(m)}
                className={`px-3 transition-colors ${
                  viewMode === m
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {m === "year" ? "Jahr" : m === "month" ? "Monat" : m === "week" ? "Woche" : "Tag"}
              </button>
            ))}
          </div>

          {/* Datums-Picker je nach Modus */}
          {viewMode === "year" ? (
            <input
              type="number"
              min={2000}
              max={2100}
              className="h-8 w-[5.5rem] rounded-lg border border-border/70 bg-background px-2.5 text-xs font-semibold shadow-sm"
              value={year}
              onChange={(e) => {
                const y = Number(e.target.value);
                if (!Number.isFinite(y)) return;
                const clamped = Math.min(2100, Math.max(2000, y));
                setYear(clamped);
                setAnchorDate(new Date(clamped, month - 1, 15));
              }}
            />
          ) : viewMode === "month" ? (
            <input
              type="month"
              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs font-semibold shadow-sm"
              value={monthPickerValue}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const [y, mo] = v.split("-").map(Number);
                if (!y || !mo) return;
                setYear(y);
                setMonth(mo);
                setAnchorDate(new Date(y, mo - 1, 15));
              }}
            />
          ) : viewMode === "week" ? (
            <input
              type="week"
              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs font-semibold shadow-sm"
              value={weekPickerValue}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const m = /^(\d{4})-W(\d{2})$/.exec(v);
                if (!m) return;
                const y = Number(m[1]);
                const w = Number(m[2]);
                if (!y || !w) return;
                const jan4 = new Date(Date.UTC(y, 0, 4));
                const jan4Day = jan4.getUTCDay() || 7;
                const mondayWeek1 = new Date(jan4);
                mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
                const targetMonday = new Date(mondayWeek1);
                targetMonday.setUTCDate(mondayWeek1.getUTCDate() + (w - 1) * 7);
                setAnchorDate(targetMonday);
                const sm = swissYmdFromDate(targetMonday);
                setYear(sm.y);
                setMonth(sm.m);
              }}
            />
          ) : (
            <input
              type="date"
              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs font-semibold shadow-sm"
              value={dayPickerValue}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const [y, mo, d] = v.split("-").map(Number);
                if (!y || !mo || !d) return;
                setAnchorDate(new Date(y, mo - 1, d));
              }}
            />
          )}
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
          <option value="technician">Zugehörige Person</option>
          <option value="time">Uhrzeit</option>
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
