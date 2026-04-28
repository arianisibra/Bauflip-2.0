"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import type { WeekTaskItem } from "@/lib/domain/types";
import { groupWeekTasksByProjectDay } from "@/lib/tech/group-week-tasks-by-project-day";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BauflipLoadingInline } from "@/components/ui/bauflip-loading";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMonthTasks } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";

const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const TZ = "Europe/Zurich";

function padDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const cells: { day: number; inMonth: boolean; dateKey: string }[] = [];

  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month - 1, -startDow + i + 1);
    cells.push({
      day: d.getDate(),
      inMonth: false,
      dateKey: padDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate()),
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      inMonth: true,
      dateKey: padDateKey(year, month, d),
    });
  }

  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month, i);
      cells.push({
        day: d.getDate(),
        inMonth: false,
        dateKey: padDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      });
    }
  }

  return cells;
}

function toSwissDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

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

  // Seed initial month cache from SSR once — subsequent nav fetches via the hook.
  useMemo(() => {
    qc.setQueryData(queryKeys.monthTasks.byYearMonth(initialYear, initialMonth), initialTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: tasks = [], isFetching: pending } = useMonthTasks(year, month);

  const todayKey = useMemo(() => toSwissDateKey(new Date()), []);
  const cells = useMemo(() => getMonthGrid(year, month), [year, month]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, WeekTaskItem[]>();
    for (const t of tasks) {
      const key = toSwissDateKey(new Date(t.startsAt));
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

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

      <div className="space-y-2 md:hidden">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Keine Termine in diesem Monat.
          </div>
        ) : (
          groupWeekTasksByProjectDay(tasks)
            .sort((a, b) => a.primary.startsAt.localeCompare(b.primary.startsAt))
            .map((group) => {
              const task = group.primary;
              return (
                <Link
                  key={group.key}
                  href={`/projekte?sheet=${task.projectId}`}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-card px-3 py-3 shadow-sm"
                >
                  <div
                    className="mt-0.5 h-10 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: task.calendarColor }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {formatDate(task.startsAt)} · {formatTime(task.startsAt)}
                    </p>
                    <p className="text-sm font-semibold text-foreground">{task.projectTitle}</p>
                    {task.technicianName ? (
                      <span
                        className="inline-flex rounded-md border px-1.5 py-0 text-[10px] font-medium"
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
                      <p className="text-[11px] text-muted-foreground">+{group.slots.length - 1} weitere Termine</p>
                    ) : null}
                  </div>
                </Link>
              );
            })
        )}
      </div>

      <div className={cn("hidden grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid", pending && "opacity-60 transition-opacity")}>
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="bg-muted/50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {name}
          </div>
        ))}

        {cells.map((cell, i) => {
          const dayTasksRaw = tasksByDate.get(cell.dateKey) ?? [];
          const dayGroups = groupWeekTasksByProjectDay(dayTasksRaw);
          const isToday = cell.dateKey === todayKey;

          return (
            <div
              key={i}
              className={cn(
                "min-h-[110px] bg-card p-1.5 transition-colors",
                !cell.inMonth && "bg-muted/20",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday && "bg-primary text-primary-foreground",
                    !isToday && cell.inMonth && "text-foreground",
                    !isToday && !cell.inMonth && "text-muted-foreground/50",
                  )}
                >
                  {cell.day}
                </span>
                {dayGroups.length > 0 ? (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {dayGroups.length}
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-1">
                {dayGroups.map((group) => {
                  const task = group.primary;
                  const timesTitle = group.slots.map((s) => formatTime(s.startsAt)).join(", ");
                  return (
                    <Link
                      key={group.key}
                      href={`/projekte?sheet=${task.projectId}`}
                      className="block rounded-md px-1.5 py-1 text-[10px] font-medium leading-tight transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: task.calendarColor + "20",
                        color: task.calendarColor,
                        borderLeft: `3px solid ${task.calendarColor}`,
                      }}
                      title={`${timesTitle} ${task.projectTitle}${task.technicianName ? ` — ${task.technicianName}` : ""}`}
                    >
                      <span className="block font-semibold">{formatTime(task.startsAt)}</span>
                      <span className="block whitespace-normal break-words">{task.projectTitle}</span>
                      {group.slots.length > 1 ? (
                        <span className="block text-[9px] opacity-85">
                          +{group.slots.length - 1} weitere Termine
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
