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
import { Button } from "@/components/ui/button";
import { BauflipLoadingInline } from "@/components/ui/bauflip-loading";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMonthTasks } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";

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
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>("all");
  const [sortMode, setSortMode] = useState<"time" | "technician">("time");
  /** Nur Desktop (md+): vergangene Termine standardmäßig ausblenden; mobil immer alle. */
  const [isMdUp, setIsMdUp] = useState(false);
  const [showPastAppointments, setShowPastAppointments] = useState(false);

  useEffect(() => {
    const mq = globalThis.matchMedia("(min-width: 768px)");
    const sync = () => setIsMdUp(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Seed initial month cache from SSR once — subsequent nav fetches via the hook.
  useMemo(() => {
    qc.setQueryData(queryKeys.monthTasks.byYearMonth(initialYear, initialMonth), initialTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: tasks = [], isFetching: pending } = useMonthTasks(year, month);

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

  const hidePastByDefault = isMdUp && !showPastAppointments;

  const timeFilteredTasks = useMemo(() => {
    if (!hidePastByDefault) return visibleTasks;
    const now = Date.now();
    return visibleTasks.filter((t) => new Date(t.endsAt).getTime() >= now);
  }, [visibleTasks, hidePastByDefault]);

  const groupedTasks = useMemo(() => {
    const groups = groupWeekTasksByProjectDay(timeFilteredTasks);
    return groups.sort((a, b) => {
      if (sortMode === "technician") {
        const byName = (a.primary.technicianName ?? "").localeCompare(b.primary.technicianName ?? "", "de-CH");
        if (byName !== 0) return byName;
      }
      return a.primary.startsAt.localeCompare(b.primary.startsAt);
    });
  }, [sortMode, timeFilteredTasks]);

  const hasOnlyHiddenPast =
    hidePastByDefault && visibleTasks.length > 0 && timeFilteredTasks.length === 0;

  const groupedByWeek = useMemo(() => bucketGroupsByIsoWeek(groupedTasks), [groupedTasks]);

  const navigate = useCallback(
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
    },
    [year, month],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(-1)}
          disabled={pending}
          aria-label="Vorheriger Monat"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex min-h-9 flex-col items-center justify-center gap-1 text-center">
          <h2 className="text-lg font-semibold tracking-tight">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          {pending ? <BauflipLoadingInline label="Wird geladen …" /> : null}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(1)}
          disabled={pending}
          aria-label="Nächster Monat"
        >
          <ChevronRight className="size-4" />
        </Button>
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
        <label
          htmlFor="admin-kalender-vergangene"
          className="hidden cursor-pointer items-center gap-2 rounded-md border border-border/80 bg-muted/40 px-2.5 py-1 md:inline-flex"
        >
          <input
            id="admin-kalender-vergangene"
            type="checkbox"
            checked={showPastAppointments}
            onChange={(e) => setShowPastAppointments(e.target.checked)}
            className="size-3.5 shrink-0 rounded border-input accent-primary"
          />
          <span className="text-xs font-medium leading-none text-foreground">Vergangene Termine</span>
        </label>
      </div>

      <div className="space-y-3">
        {groupedTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              {hasOnlyHiddenPast
                ? "Keine anstehenden Termine in diesem Monat."
                : "Keine Termine in diesem Monat."}
            </p>
            {hasOnlyHiddenPast ? (
              <p className="mt-2 hidden text-xs md:block">
                Vergangene Termine sind ausgeblendet. Aktivieren Sie oben „Vergangene Termine“, um sie
                anzuzeigen.
              </p>
            ) : null}
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
