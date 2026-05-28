"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { WeekTaskItem } from "@/lib/domain/types";
import { projectStatusBadgeClassName, projectStatusLabels } from "@/lib/domain/types";
import {
  groupWeekTasksByProjectDay,
  swissDayKeyFromTaskStart,
  type WeekTaskProjectDayGroup,
} from "@/lib/tech/group-week-tasks-by-project-day";
import { formatWeekRangeDe, getSwissDayBounds, getWeekBounds } from "@/lib/date/week-bounds";
import { swissYmdParts, todayKeySwiss } from "@/lib/date/swiss";
import { shiftSwissDayKey } from "@/lib/date/swiss-week";
import {
  anchorDateFromDayKey,
  buildAdminCalendarHref,
  buildProjekteSheetHref,
  calendarQueriesEqual,
  dayKeyFromDate,
  parseAdminCalendarUrlState,
  type AdminCalendarViewMode,
} from "@/lib/navigation/admin-calendar-navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BauflipLoadingInline } from "@/components/ui/bauflip-loading";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCalendarRangeTasks } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { CalendarAvailabilityRail } from "@/components/app/calendar-availability-rail";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const TZ = "Europe/Zurich";

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

/** Today's Swiss calendar day when `(y,m)` is the current month; otherwise 15 for browsing other months. */
function defaultDayInVisibleMonth(y: number, m: number, now = new Date()): number {
  const { y: cy, m: cm, day: cd } = swissYmdParts(now);
  if (y === cy && m === cm) return cd;
  return 15;
}

function anchorDateForYearMonth(y: number, m: number, now = new Date()): Date {
  return new Date(y, m - 1, defaultDayInVisibleMonth(y, m, now));
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

/** Kalendertag YYYY-MM-DD (Schweiz) als lesbare Überschrift für Wochen-Gruppierung. */
function formatSwissDayHeading(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  const ref = new Date(y, m - 1, d, 12, 0, 0, 0);
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  }).format(ref);
}

function isoWeekInputValueFromDate(d: Date): string {
  const { y, m, day } = swissYmdParts(d);
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

function AppointmentCard({
  group,
  dimmed,
  href,
}: {
  group: WeekTaskProjectDayGroup;
  dimmed: boolean;
  href: string;
}) {
  const task = group.primary;
  return (
    <Link
      href={href}
      className={`flex min-h-0 items-stretch gap-2 rounded-lg border bg-card px-2 py-1.5 text-left shadow-sm outline-none ring-offset-background transition-colors hover:border-border hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring ${
        dimmed ? "border-border/40 opacity-50" : "border-border/90"
      }`}
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
          <Badge
            variant="outline"
            className={cn(
              "max-w-full truncate px-1 py-px text-[9px] font-semibold leading-tight",
              projectStatusBadgeClassName(task.projectStatus),
            )}
          >
            {projectStatusLabels[task.projectStatus] ?? task.projectStatus}
          </Badge>
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
            <span className="text-[9px] text-muted-foreground">+{group.slots.length - 1}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function WeekSection({
  weekKey,
  groups,
  dimmed,
  subdivideByWeekDays = false,
  buildProjectHref,
}: {
  weekKey: string;
  groups: WeekTaskProjectDayGroup[];
  dimmed: boolean;
  /** In der Wochenansicht: Termine nach Kalendertag in eigene Karten-Blöcke mit Titel trennen. */
  subdivideByWeekDays?: boolean;
  buildProjectHref: (projectId: string) => string;
}) {
  const dayChunks = useMemo(() => {
    if (!subdivideByWeekDays || groups.length === 0) return null;
    const map = new Map<string, WeekTaskProjectDayGroup[]>();
    for (const g of groups) {
      const dk = g.dayKey || swissDayKeyFromTaskStart(g.primary.startsAt);
      const list = map.get(dk) ?? [];
      list.push(g);
      map.set(dk, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayKey, dayGroups]) => ({
        dayKey,
        groups: [...dayGroups].sort((x, y) => x.primary.startsAt.localeCompare(y.primary.startsAt)),
      }));
  }, [groups, subdivideByWeekDays]);

  const cardGrid = (chunk: WeekTaskProjectDayGroup[]) => (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {chunk.map((group) => (
        <AppointmentCard
          key={group.key}
          group={group}
          dimmed={dimmed}
          href={buildProjectHref(group.primary.projectId)}
        />
      ))}
    </div>
  );

  return (
    <section aria-label={formatIsoWeekHeading(weekKey)} className="space-y-2">
      <h3
        className={cn(
          "border-b pb-1 text-[10px] font-semibold uppercase tracking-wide",
          dimmed ? "border-border/40 text-muted-foreground/50" : "border-border/70 text-muted-foreground",
        )}
      >
        {formatIsoWeekHeading(weekKey)}
      </h3>
      {dayChunks ? (
        <div className="flex flex-col gap-4">
          {dayChunks.map(({ dayKey, groups: dayGroups }) => (
            <div
              key={dayKey}
              className={cn(
                "rounded-xl border border-border/60 bg-muted/15 p-3 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]",
                dimmed && "border-border/40 bg-muted/10 opacity-55",
              )}
            >
              <h4
                className={cn(
                  "mb-2.5 border-b border-border/50 pb-2 text-xs font-semibold tracking-tight text-foreground sm:text-sm",
                  dimmed && "text-muted-foreground",
                )}
              >
                {formatSwissDayHeading(dayKey)}
              </h4>
              {cardGrid(dayGroups)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <AppointmentCard
              key={group.key}
              group={group}
              dimmed={dimmed}
              href={buildProjectHref(group.primary.projectId)}
            />
          ))}
        </div>
      )}
    </section>
  );
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const todayKey = useMemo(() => todayKeySwiss(), []);

  const urlState = useMemo(
    () => parseAdminCalendarUrlState(searchParams, todayKey),
    [searchParams, todayKey],
  );

  const [viewMode, setViewMode] = useState<AdminCalendarViewMode>(urlState.viewMode);
  const [dayKey, setDayKey] = useState(urlState.dayKey);
  const [year, setYear] = useState(() => swissYmdParts(anchorDateFromDayKey(urlState.dayKey)).y);
  const [month, setMonth] = useState(() => swissYmdParts(anchorDateFromDayKey(urlState.dayKey)).m);
  const [anchorDate, setAnchorDate] = useState(() => anchorDateFromDayKey(urlState.dayKey));
  const [calendarNowTs] = useState(() => Date.now());
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(urlState.selectedTechnicianId);
  const [sortMode, setSortMode] = useState<"time" | "technician">(urlState.sortMode);
  const skipUrlPushRef = useRef(false);

  const applyDayKey = useCallback((nextDayKey: string) => {
    setDayKey(nextDayKey);
    const ad = anchorDateFromDayKey(nextDayKey);
    setAnchorDate(ad);
    const { y, m } = swissYmdParts(ad);
    setYear(y);
    setMonth(m);
  }, []);

  useEffect(() => {
    skipUrlPushRef.current = true;
    setViewMode(urlState.viewMode);
    applyDayKey(urlState.dayKey);
    setSelectedTechnicianId(urlState.selectedTechnicianId);
    setSortMode(urlState.sortMode);
    const id = window.requestAnimationFrame(() => {
      skipUrlPushRef.current = false;
    });
    return () => window.cancelAnimationFrame(id);
  }, [urlState, applyDayKey]);

  const calendarReturnHref = useMemo(
    () =>
      buildAdminCalendarHref({
        viewMode,
        dayKey,
        selectedTechnicianId,
        sortMode,
      }),
    [viewMode, dayKey, selectedTechnicianId, sortMode],
  );

  const buildProjectHref = useCallback(
    (projectId: string) => buildProjekteSheetHref(projectId, calendarReturnHref),
    [calendarReturnHref],
  );

  const pushCalendarUrl = useCallback(
    (state: {
      viewMode: AdminCalendarViewMode;
      dayKey: string;
      selectedTechnicianId: string;
      sortMode: "time" | "technician";
    }) => {
      if (pathname !== "/kalender") return;
      const next = buildAdminCalendarHref(state);
      const currentQs = searchParams.toString();
      if (skipUrlPushRef.current) return;
      if (!calendarQueriesEqual(currentQs, next)) router.replace(next, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    pushCalendarUrl({
      viewMode,
      dayKey,
      selectedTechnicianId,
      sortMode,
    });
  }, [viewMode, dayKey, selectedTechnicianId, sortMode, pushCalendarUrl]);

  const { startIso, endIso, heading, rangeLabel } = useMemo(() => {
    if (viewMode === "availability") {
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
        rangeLabel: "Verfügbarkeit",
      };
    }
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
    if (selectedTechnicianId === "all") return tasks;
    return tasks.filter((task) => task.assignedTechnicianId === selectedTechnicianId);
  }, [selectedTechnicianId, tasks]);

  const { upcomingByWeek, pastByWeek } = useMemo(() => {
    const upcoming = visibleTasks.filter((t) => new Date(t.endsAt).getTime() >= calendarNowTs);
    const past = visibleTasks.filter((t) => new Date(t.endsAt).getTime() < calendarNowTs);

    const sortGroups = (groups: ReturnType<typeof groupWeekTasksByProjectDay>) =>
      groups.sort((a, b) => {
        if (sortMode === "technician") {
          const byName = (a.primary.technicianName ?? "").localeCompare(b.primary.technicianName ?? "", "de-CH");
          if (byName !== 0) return byName;
        }
        return a.primary.startsAt.localeCompare(b.primary.startsAt);
      });

    const upcomingWeeks = bucketGroupsByIsoWeek(sortGroups(groupWeekTasksByProjectDay(upcoming)));
    // Past: most recent week first (reverse) so it sits closest to the divider
    const pastWeeks = bucketGroupsByIsoWeek(sortGroups(groupWeekTasksByProjectDay(past))).reverse();

    return { upcomingByWeek: upcomingWeeks, pastByWeek: pastWeeks };
  }, [calendarNowTs, sortMode, visibleTasks]);

  const bumpDayKey = useCallback((deltaDays: number) => {
    setDayKey((k) => {
      const next = shiftSwissDayKey(k, deltaDays);
      const ad = anchorDateFromDayKey(next);
      setAnchorDate(ad);
      const { y, m } = swissYmdParts(ad);
      setYear(y);
      setMonth(m);
      return next;
    });
  }, []);

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
      const ad = anchorDateForYearMonth(newYear, newMonth);
      applyDayKey(dayKeyFromDate(ad));
    },
    [year, month, applyDayKey],
  );

  const navigateWeek = useCallback((dir: -1 | 1) => bumpDayKey(dir * 7), [bumpDayKey]);

  const navigateDay = useCallback((dir: -1 | 1) => bumpDayKey(dir), [bumpDayKey]);

  const navigateYear = useCallback(
    (dir: -1 | 1) => {
      const nextYear = year + dir;
      applyDayKey(dayKeyFromDate(anchorDateForYearMonth(nextYear, month)));
    },
    [year, month, applyDayKey],
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

  const onViewModeChange = useCallback((next: AdminCalendarViewMode) => {
    setViewMode(next);
    if (next === "year" || next === "month") {
      const { y, m } = swissYmdParts(anchorDate);
      setYear(y);
      setMonth(m);
    }
    if (next === "week" || next === "day" || next === "availability") {
      applyDayKey(dayKeyFromDate(anchorDateForYearMonth(year, month)));
    }
  }, [anchorDate, year, month, applyDayKey]);

  const dayPickerValue = dayKey;
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
            aria-label={viewMode === "year" ? "Vorheriges Jahr" : viewMode === "month" ? "Vorheriger Monat" : viewMode === "week" ? "Vorherige Woche" : viewMode === "availability" ? "Vorheriger Tag" : "Vorheriger Tag"}
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
            aria-label={viewMode === "year" ? "Nächstes Jahr" : viewMode === "month" ? "Nächster Monat" : viewMode === "week" ? "Nächste Woche" : viewMode === "availability" ? "Nächster Tag" : "Nächster Tag"}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        {/* Steuerleiste */}
        <div className="flex flex-wrap items-center gap-2 bg-muted/30 px-4 py-2.5">

          {/* Zeitraum-Selector */}
          <div className="flex h-8 overflow-hidden rounded-lg border border-border/70 bg-background text-xs font-semibold shadow-sm">
            {(["day", "week", "month", "year", "availability"] as AdminCalendarViewMode[]).map((m) => (
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
                {m === "year"
                  ? "Jahr"
                  : m === "month"
                    ? "Monat"
                    : m === "week"
                      ? "Woche"
                      : m === "day"
                        ? "Tag"
                        : "Verfügbarkeit"}
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
                applyDayKey(dayKeyFromDate(anchorDateForYearMonth(clamped, month)));
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
                applyDayKey(dayKeyFromDate(anchorDateForYearMonth(y, mo)));
              }}
            />
          ) : viewMode === "availability" ? (
            <input
              type="date"
              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs font-semibold shadow-sm"
              value={dayPickerValue}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                if (v) applyDayKey(v);
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
                applyDayKey(dayKeyFromDate(targetMonday));
              }}
            />
          ) : (
            <input
              type="date"
              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs font-semibold shadow-sm"
              value={dayPickerValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v) applyDayKey(v);
              }}
            />
          )}
        </div>
      </div>

      {viewMode === "availability" ? (
        <CalendarAvailabilityRail
          year={swissYmdParts(anchorDate).y}
          month={swissYmdParts(anchorDate).m}
          day={swissYmdParts(anchorDate).day}
        />
      ) : null}

      {viewMode === "availability" ? null : (
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
      )}

      {viewMode === "availability" ? null : (
      <div className="space-y-3">
        {upcomingByWeek.length === 0 && pastByWeek.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Keine Termine in diesem Zeitraum.</p>
          </div>
        ) : (
          <>
            {/* ── Bevorstehende & aktuelle Termine ── */}
            {upcomingByWeek.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">Keine bevorstehenden Termine.</p>
            ) : (
              upcomingByWeek.map(({ weekKey, groups }) => (
                <WeekSection
                  key={weekKey}
                  weekKey={weekKey}
                  groups={groups}
                  dimmed={false}
                  subdivideByWeekDays={viewMode === "week"}
                  buildProjectHref={buildProjectHref}
                />
              ))
            )}

            {/* ── Trennlinie vergangene Termine ── */}
            {pastByWeek.length > 0 ? (
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                  Vergangene Termine
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
            ) : null}

            {/* ── Vergangene Termine (gedimmt) ── */}
            {pastByWeek.map(({ weekKey, groups }) => (
              <WeekSection
                key={weekKey}
                weekKey={weekKey}
                groups={groups}
                dimmed={true}
                subdivideByWeekDays={viewMode === "week"}
                buildProjectHref={buildProjectHref}
              />
            ))}
          </>
        )}
      </div>
      )}
    </div>
  );
}
