"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { WeekTaskItem } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { fetchWeekTasksAction } from "@/app/(tech)/wochenplan/actions";

const DAY_NAMES_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getWeekDates(reference: Date): Date[] {
  const day = reference.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(reference);
  monday.setDate(reference.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatDateRange(dates: Date[]): string {
  if (dates.length < 2) return "";
  const fmt = new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "short" });
  return `${fmt.format(dates[0])} – ${fmt.format(dates[dates.length - 1])}`;
}

export function TechCalendar({
  initialTasks,
  userId,
}: {
  initialTasks: WeekTaskItem[];
  userId: string;
}) {
  const [refDate, setRefDate] = useState(() => new Date());
  const [tasks, setTasks] = useState(initialTasks);
  const [pending, startTransition] = useTransition();

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const weekDates = useMemo(() => getWeekDates(refDate), [refDate]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, WeekTaskItem[]>();
    for (const t of tasks) {
      const key = t.startsAt.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const navigate = useCallback(
    (dir: -1 | 1) => {
      const next = new Date(refDate);
      next.setDate(refDate.getDate() + dir * 7);
      setRefDate(next);
      startTransition(async () => {
        const result = await fetchWeekTasksAction(next.toISOString());
        setTasks(result);
      });
    },
    [refDate],
  );

  return (
    <div className={cn("space-y-4", pending && "opacity-60 transition-opacity")}>
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          onClick={() => navigate(-1)}
          disabled={pending}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-semibold text-foreground">
          {formatDateRange(weekDates)}
        </p>
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          onClick={() => navigate(1)}
          disabled={pending}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {weekDates.map((date, i) => {
          const dateKey = date.toISOString().slice(0, 10);
          const isToday = dateKey === todayKey;
          const dayTasks = tasksByDate.get(dateKey) ?? [];

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
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-foreground",
                  )}
                >
                  {date.getDate()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", isToday ? "text-primary" : "text-foreground")}>
                    {DAY_NAMES_SHORT[i]}
                  </p>
                </div>
                {dayTasks.length > 0 ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {dayTasks.length} {dayTasks.length === 1 ? "Termin" : "Termine"}
                  </Badge>
                ) : null}
              </div>

              {dayTasks.length > 0 ? (
                <div className="space-y-1 border-t border-border/50 px-3 pb-3 pt-2">
                  {dayTasks.map((task) => {
                    const isBesichtigung = task.kind === "besichtigung";
                    return (
                      <Link
                        key={task.appointmentId}
                        href={`/auftrag/${task.projectId}`}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-transform active:scale-[0.98]",
                          isBesichtigung
                            ? "border-l-4 border-amber-400 border-t-border border-r-border border-b-border bg-card"
                            : "border-l-4 border-emerald-400 border-t-border border-r-border border-b-border bg-card",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                            <Clock className="size-3" />
                            {formatTime(task.startsAt)}–{formatTime(task.endsAt)}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-foreground">
                            {task.projectTitle}
                          </p>
                          {task.serviceAddressShort ? (
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              <span className="line-clamp-1">{task.serviceAddressShort}</span>
                            </p>
                          ) : null}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px]",
                            isBesichtigung
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
                          )}
                        >
                          {isBesichtigung ? "Besichtigung" : "Ausführung"}
                        </Badge>
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
