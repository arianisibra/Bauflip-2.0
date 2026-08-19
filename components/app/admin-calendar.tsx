"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { taskAssignedTechnicianIds } from "@/lib/domain/types";
import { resolveStageBadgeClass, resolveStageLabel } from "@/lib/domain/stage-visuals";
import { useWorkflowStages } from "@/components/app/workflow-stages-provider";
import {
  groupWeekTasksByProjectDay,
  swissDayKeyFromTaskStart,
  type WeekTaskProjectDayGroup,
} from "@/lib/tech/group-week-tasks-by-project-day";
import { swissYmdParts, todayKeySwiss } from "@/lib/date/swiss";
import { shiftSwissDayKey, shiftSwissWeekReference, swissWeekDays, swissWeekReferenceIsoFromDayKey } from "@/lib/date/swiss-week";
import { swissMonthLastDayKey } from "@/lib/date/week-bounds";
import { calendarRangeBoundsFromState } from "@/lib/kalender/calendar-range";
import {
  anchorDateFromDayKey,
  buildAdminCalendarHref,
  calendarQueriesEqual,
  dayKeyFromDate,
  parseAdminCalendarUrlState,
  syncAdminCalendarInUrl,
  type AdminCalendarViewMode,
} from "@/lib/navigation/admin-calendar-navigation";
import { prefetchProjectCore } from "@/lib/query/prefetch-project-core";
import { prefetchCalendarRange } from "@/lib/query/prefetch-calendar-range";
import { useKalenderSheet } from "@/components/app/kalender-sheet-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BauflipLoadingInline } from "@/components/ui/bauflip-loading";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAssignableProfiles, useCalendarRangeTasks } from "@/lib/query/hooks";
import { CalendarAvailabilityRail } from "@/components/app/calendar-availability-rail";
import { cn } from "@/lib/utils";

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
  onOpenProject,
  onProjectHover,
  showDate = true,
}: {
  group: WeekTaskProjectDayGroup;
  dimmed: boolean;
  onOpenProject: (projectId: string) => void;
  onProjectHover?: (projectId: string) => void;
  /** Aus (Tages-/Wochentag-Überschrift steht das Datum schon fett darüber) — dann nur die Zeit zeigen. */
  showDate?: boolean;
}) {
  const task = group.primary;
  const workflowStages = useWorkflowStages();
  return (
    <button
      type="button"
      onClick={() => onOpenProject(task.projectId)}
      onMouseEnter={() => onProjectHover?.(task.projectId)}
      onFocus={() => onProjectHover?.(task.projectId)}
      className={`flex min-h-0 w-full items-stretch gap-2 rounded-lg border bg-card px-2 py-1.5 text-left shadow-sm outline-none ring-offset-background transition-colors hover:border-border hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring ${
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
          {showDate ? `${formatDate(task.startsAt)} · ` : ""}
          {formatTime(task.startsAt)}
        </p>
        <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
          {task.projectTitle}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <Badge
            variant="outline"
            className={cn(
              "max-w-full truncate px-1 py-px text-[9px] font-semibold leading-tight",
              resolveStageBadgeClass(workflowStages, task.projectStatus),
            )}
          >
            {resolveStageLabel(workflowStages, task.projectStatus)}
          </Badge>
          {[
            { name: task.technicianName, color: task.calendarColor },
            { name: task.technicianName2, color: task.calendarColor2 },
          ]
            .filter((t): t is { name: string; color: string } => Boolean(t.name && t.color))
            .map((t, i) => (
              <span
                key={i}
                className="inline-flex max-w-full truncate rounded border px-1 py-px text-[9px] font-medium leading-tight"
                style={{
                  borderColor: `${t.color}55`,
                  backgroundColor: `${t.color}1f`,
                  color: t.color,
                }}
              >
                {t.name}
              </span>
            ))}
          {group.slots.length > 1 ? (
            <span className="text-[9px] text-muted-foreground">+{group.slots.length - 1}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function WeekSection({
  weekKey,
  groups,
  dimmed,
  subdivideByWeekDays = false,
  onOpenProject,
  onProjectHover,
}: {
  weekKey: string;
  groups: WeekTaskProjectDayGroup[];
  dimmed: boolean;
  /** In der Wochenansicht: Termine nach Kalendertag in eigene Karten-Blöcke mit Titel trennen. */
  subdivideByWeekDays?: boolean;
  onOpenProject: (projectId: string) => void;
  onProjectHover?: (projectId: string) => void;
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
          onOpenProject={onOpenProject}
          onProjectHover={onProjectHover}
          // Der Tag steht bereits als Überschrift über diesem Block (siehe unten).
          showDate={false}
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
              onOpenProject={onOpenProject}
              onProjectHover={onProjectHover}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type MonthGridDay = { key: string; day: number; monthShort: string };

const MONTH_GRID_WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function MonthDayCell({
  day,
  inCurrentMonth,
  isToday,
  groups,
  onOpenDay,
  onOpenProject,
  onProjectHover,
}: {
  day: MonthGridDay;
  inCurrentMonth: boolean;
  isToday: boolean;
  groups: WeekTaskProjectDayGroup[];
  onOpenDay: (dayKey: string) => void;
  onOpenProject: (projectId: string) => void;
  onProjectHover?: (projectId: string) => void;
}) {
  const MAX_VISIBLE = 3;
  const visible = groups.slice(0, MAX_VISIBLE);
  const overflow = groups.length - visible.length;

  return (
    <div
      className={cn(
        "flex min-h-[76px] flex-col gap-1 border-b border-r border-border/50 p-1.5 sm:min-h-[112px] sm:p-2",
        !inCurrentMonth && "bg-muted/20",
      )}
    >
      <button
        type="button"
        onClick={() => onOpenDay(day.key)}
        className={cn(
          "self-start rounded-full px-1.5 py-0.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          isToday
            ? "bg-foreground text-background"
            : inCurrentMonth
              ? "text-foreground hover:bg-muted"
              : "text-muted-foreground/50 hover:bg-muted/60",
        )}
      >
        {day.day}
      </button>

      {/* Desktop: Termin-Chips mit Titel */}
      <div className="hidden min-w-0 flex-1 flex-col gap-0.5 sm:flex">
        {visible.map((group) => (
          <button
            key={group.key}
            type="button"
            onClick={() => onOpenProject(group.projectId)}
            onMouseEnter={() => onProjectHover?.(group.projectId)}
            onFocus={() => onProjectHover?.(group.projectId)}
            className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: group.primary.calendarColor }}
              aria-hidden
            />
            <span className="truncate">{group.primary.projectTitle}</span>
          </button>
        ))}
        {overflow > 0 ? (
          <button
            type="button"
            onClick={() => onOpenDay(day.key)}
            className="px-1 text-left text-[10px] font-semibold text-muted-foreground hover:text-foreground"
          >
            +{overflow} mehr
          </button>
        ) : null}
      </div>

      {/* Mobil: Titel würde die Zelle sprengen — nur farbige Punkte, Tap öffnet die Tagesansicht. */}
      {groups.length > 0 ? (
        <button
          type="button"
          onClick={() => onOpenDay(day.key)}
          className="flex flex-wrap items-center gap-0.5 sm:hidden"
          aria-label={`${groups.length} Termin${groups.length === 1 ? "" : "e"} am ${day.key}`}
        >
          {groups.slice(0, 4).map((group) => (
            <span
              key={group.key}
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: group.primary.calendarColor }}
              aria-hidden
            />
          ))}
          {groups.length > 4 ? (
            <span className="text-[9px] font-medium text-muted-foreground">+{groups.length - 4}</span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

function MonthGrid({
  weeks,
  year,
  month,
  todayKey,
  dayGroups,
  onOpenDay,
  onOpenProject,
  onProjectHover,
}: {
  weeks: MonthGridDay[][];
  year: number;
  month: number;
  todayKey: string;
  dayGroups: Map<string, WeekTaskProjectDayGroup[]>;
  onOpenDay: (dayKey: string) => void;
  onOpenProject: (projectId: string) => void;
  onProjectHover?: (projectId: string) => void;
}) {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="grid grid-cols-7 border-b border-border/50 bg-muted/30">
        {MONTH_GRID_WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-1.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-l border-t border-border/50">
        {weeks.map((week) =>
          week.map((day) => (
            <MonthDayCell
              key={day.key}
              day={day}
              inCurrentMonth={day.key.startsWith(monthPrefix)}
              isToday={day.key === todayKey}
              groups={dayGroups.get(day.key) ?? []}
              onOpenDay={onOpenDay}
              onOpenProject={onOpenProject}
              onProjectHover={onProjectHover}
            />
          )),
        )}
      </div>
    </div>
  );
}

export function AdminCalendar() {
  const qc = useQueryClient();
  const { openProjectSheet } = useKalenderSheet();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const todayKey = useMemo(() => todayKeySwiss(), []);
  const hoverPrefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlState = useMemo(
    () => parseAdminCalendarUrlState(searchParams, todayKey),
    [searchParams, todayKey],
  );

  const [viewMode, setViewMode] = useState<AdminCalendarViewMode>(urlState.viewMode);
  const [dayKey, setDayKey] = useState(urlState.dayKey);
  // Abgeleitet statt als eigener State: `anchorDate`, `year` und `month` folgen
  // ausschliesslich `dayKey`. Als State gehalten kostete jede URL-Änderung einen
  // zusätzlichen Renderdurchgang — `setDayKey` und die drei Folge-Setter liefen
  // nacheinander, und `new Date(...)` erzeugt bei jedem Lauf ein neues Objekt,
  // das sich nie gleich vergleicht. `dayKey` ist eine Zeichenkette und stabil.
  const anchorDate = useMemo(() => anchorDateFromDayKey(dayKey), [dayKey]);
  const { y: year, m: month } = useMemo(() => swissYmdParts(anchorDate), [anchorDate]);
  const [calendarNowTs] = useState(() => Date.now());
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(urlState.selectedTechnicianId);
  const [sortMode, setSortMode] = useState<"time" | "technician">(urlState.sortMode);
  const skipUrlPushRef = useRef(false);

  // anchorDate/year/month folgen automatisch — hier genügt der Tagesschlüssel.
  const applyDayKey = useCallback((nextDayKey: string) => {
    setDayKey(nextDayKey);
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

  useEffect(() => {
    if (pathname !== "/kalender") return;
    const onPopState = () => {
      skipUrlPushRef.current = true;
      const params = new URLSearchParams(globalThis.location.search);
      const parsed = parseAdminCalendarUrlState(
        { get: (key) => params.get(key) },
        todayKey,
      );
      setViewMode(parsed.viewMode);
      applyDayKey(parsed.dayKey);
      setSelectedTechnicianId(parsed.selectedTechnicianId);
      setSortMode(parsed.sortMode);
      window.requestAnimationFrame(() => {
        skipUrlPushRef.current = false;
      });
    };
    globalThis.addEventListener("popstate", onPopState);
    return () => globalThis.removeEventListener("popstate", onPopState);
  }, [pathname, todayKey, applyDayKey]);

  const handleProjectHover = useCallback(
    (projectId: string) => {
      if (hoverPrefetchTimerRef.current) {
        clearTimeout(hoverPrefetchTimerRef.current);
      }
      hoverPrefetchTimerRef.current = setTimeout(() => {
        prefetchProjectCore(qc, projectId);
      }, 250);
    },
    [qc],
  );

  useEffect(() => {
    return () => {
      if (hoverPrefetchTimerRef.current) clearTimeout(hoverPrefetchTimerRef.current);
    };
  }, []);

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
      if (!calendarQueriesEqual(currentQs, next)) syncAdminCalendarInUrl(state);
    },
    [pathname, searchParams],
  );

  useEffect(() => {
    pushCalendarUrl({
      viewMode,
      dayKey,
      selectedTechnicianId,
      sortMode,
    });
  }, [viewMode, dayKey, selectedTechnicianId, sortMode, pushCalendarUrl]);

  const { startIso, endIso, heading, rangeLabel } = useMemo(
    () => calendarRangeBoundsFromState(viewMode, anchorDate, year, month),
    [viewMode, year, month, anchorDate],
  );

  const { data: tasks = [], isFetching: pending } = useCalendarRangeTasks(
    startIso,
    endIso,
    viewMode !== "availability",
  );

  // Nachbar-Zeitraum im Hintergrund vorladen, damit Vor/Zurück nicht jedes Mal auf das
  // Netzwerk wartet — der Kalender zeigt dank placeholderData ohnehin sofort den alten
  // Stand, aber mit Prefetch ist der neue Stand meist schon da, wenn er gebraucht wird.
  useEffect(() => {
    if (viewMode === "availability" || viewMode === "year") return;
    const monthNeighbor = (dir: -1 | 1) => {
      let nm = month + dir;
      let ny = year;
      if (nm < 1) {
        nm = 12;
        ny -= 1;
      } else if (nm > 12) {
        nm = 1;
        ny += 1;
      }
      return calendarRangeBoundsFromState("month", anchorDateForYearMonth(ny, nm), ny, nm);
    };
    const dayOrWeekNeighbor = (deltaDays: number) => {
      const nextAnchor = anchorDateFromDayKey(shiftSwissDayKey(dayKey, deltaDays));
      const { y: ny, m: nm } = swissYmdParts(nextAnchor);
      return calendarRangeBoundsFromState(viewMode, nextAnchor, ny, nm);
    };
    const neighbors =
      viewMode === "month"
        ? [monthNeighbor(-1), monthNeighbor(1)]
        : viewMode === "week"
          ? [dayOrWeekNeighbor(-7), dayOrWeekNeighbor(7)]
          : [dayOrWeekNeighbor(-1), dayOrWeekNeighbor(1)];
    for (const bounds of neighbors) {
      prefetchCalendarRange(qc, bounds.startIso, bounds.endIso);
    }
  }, [viewMode, dayKey, year, month, qc]);

  // Alle Team-Mitglieder der Organisation — nicht nur die, die an diesem Tag Termine haben,
  // sonst verschwinden freie Monteure aus dem Filter, sobald sie mal keinen Termin haben.
  const { data: assignableProfiles = [] } = useAssignableProfiles(viewMode !== "availability");
  const technicianOptions = useMemo(
    () =>
      assignableProfiles
        .map((p) => ({ id: p.id, name: p.displayName }))
        .sort((a, b) => a.name.localeCompare(b.name, "de-CH")),
    [assignableProfiles],
  );

  const visibleTasks = useMemo(() => {
    const filtered =
      selectedTechnicianId === "all"
        ? tasks
        : tasks.filter((task) => taskAssignedTechnicianIds(task).includes(selectedTechnicianId));
    if (viewMode !== "day") return filtered;
    return filtered.filter((task) => swissDayKeyFromTaskStart(task.startsAt) === dayKey);
  }, [selectedTechnicianId, tasks, viewMode, dayKey]);

  const sortAppointmentGroups = useCallback(
    (groups: ReturnType<typeof groupWeekTasksByProjectDay>) =>
      groups.sort((a, b) => {
        if (sortMode === "technician") {
          const byName = (a.primary.technicianName ?? "").localeCompare(
            b.primary.technicianName ?? "",
            "de-CH",
          );
          if (byName !== 0) return byName;
        }
        return a.primary.startsAt.localeCompare(b.primary.startsAt);
      }),
    [sortMode],
  );

  const dayViewGroups = useMemo(() => {
    if (viewMode !== "day") return null;
    const upcoming = visibleTasks.filter((t) => new Date(t.endsAt).getTime() >= calendarNowTs);
    const past = visibleTasks.filter((t) => new Date(t.endsAt).getTime() < calendarNowTs);
    return {
      upcoming: sortAppointmentGroups(groupWeekTasksByProjectDay(upcoming)),
      past: sortAppointmentGroups(groupWeekTasksByProjectDay(past)).reverse(),
    };
  }, [viewMode, visibleTasks, calendarNowTs, sortAppointmentGroups]);

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

  const monthGridWeeks = useMemo(() => {
    if (viewMode !== "month") return null;
    const firstDayKey = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDayKey = swissMonthLastDayKey(year, month);
    const lastWeekMonday = swissWeekReferenceIsoFromDayKey(lastDayKey);
    const weeks: MonthGridDay[][] = [];
    let cursor = swissWeekReferenceIsoFromDayKey(firstDayKey);
    while (true) {
      weeks.push(swissWeekDays(cursor));
      if (cursor === lastWeekMonday) break;
      cursor = shiftSwissWeekReference(cursor, 1);
    }
    return weeks;
  }, [viewMode, year, month]);

  const monthDayGroups = useMemo(() => {
    if (viewMode !== "month") return null;
    const groups = sortAppointmentGroups(groupWeekTasksByProjectDay(visibleTasks));
    const map = new Map<string, WeekTaskProjectDayGroup[]>();
    for (const g of groups) {
      const list = map.get(g.dayKey) ?? [];
      list.push(g);
      map.set(g.dayKey, list);
    }
    return map;
  }, [viewMode, visibleTasks, sortAppointmentGroups]);

  const bumpDayKey = useCallback((deltaDays: number) => {
    setDayKey((k) => shiftSwissDayKey(k, deltaDays));
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

  const openDayFromGrid = useCallback(
    (targetDayKey: string) => {
      setViewMode("day");
      applyDayKey(targetDayKey);
    },
    [applyDayKey],
  );

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
    // Für «Jahr» und «Monat» ist nichts mehr nachzuziehen: year/month leiten
    // sich bereits aus anchorDate ab. Nur die Wochenansicht springt auf den
    // Anker des angezeigten Monats.
    if (next === "week") {
      applyDayKey(dayKeyFromDate(anchorDateForYearMonth(year, month)));
    }
  }, [year, month, applyDayKey]);

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
          onOpenProject={openProjectSheet}
          onProjectHover={handleProjectHover}
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

      {viewMode === "availability" ? null : viewMode === "day" ? (
      <div className="space-y-3">
        {dayViewGroups && dayViewGroups.upcoming.length === 0 && dayViewGroups.past.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Keine Termine an diesem Tag.</p>
          </div>
        ) : dayViewGroups ? (
          <>
            {dayViewGroups.upcoming.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">Keine bevorstehenden Termine an diesem Tag.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {dayViewGroups.upcoming.map((group) => (
                  <AppointmentCard
                    key={group.key}
                    group={group}
                    dimmed={false}
                    onOpenProject={openProjectSheet}
                    onProjectHover={handleProjectHover}
                    // Datum steht schon gross im Seitentitel («Dienstag, 21. Juli 2026»).
                    showDate={false}
                  />
                ))}
              </div>
            )}
            {dayViewGroups.past.length > 0 ? (
              <>
                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                    Vergangene Termine
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {dayViewGroups.past.map((group) => (
                    <AppointmentCard
                      key={group.key}
                      group={group}
                      dimmed={true}
                      onOpenProject={openProjectSheet}
                      onProjectHover={handleProjectHover}
                      showDate={false}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
      ) : viewMode === "month" ? (
      <MonthGrid
        weeks={monthGridWeeks ?? []}
        year={year}
        month={month}
        todayKey={todayKey}
        dayGroups={monthDayGroups ?? new Map()}
        onOpenDay={openDayFromGrid}
        onOpenProject={openProjectSheet}
        onProjectHover={handleProjectHover}
      />
      ) : (
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
                  onOpenProject={openProjectSheet}
                  onProjectHover={handleProjectHover}
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
                onOpenProject={openProjectSheet}
                onProjectHover={handleProjectHover}
              />
            ))}
          </>
        )}
      </div>
      )}
    </div>
  );
}
