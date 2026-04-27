"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import type { WeekTaskItem } from "@/lib/domain/types";
import { groupWeekTasksByProjectDay } from "@/lib/tech/group-week-tasks-by-project-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BauflipLoadingInline } from "@/components/ui/bauflip-loading";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import {
  shiftSwissWeekReference,
  swissWeekDays,
  swissWeekReferenceIso,
} from "@/lib/date/swiss-week";
import { useWeekTasks } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";

const DAY_NAMES_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const TZ = "Europe/Zurich";

function toSwissDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

export function TechCalendar({
  initialTasks,
  userId,
}: {
  initialTasks: WeekTaskItem[];
  userId: string;
}) {
  const qc = useQueryClient();
  // UTC-noon of the Swiss Monday — stable across remounts (shared cache
  // with /tag) and TZ-independent.
  const [refDateIso, setRefDateIso] = useState(() => swissWeekReferenceIso());

  // Seed the initial week's cache from SSR so the first render has data without a fetch.
  useMemo(() => {
    qc.setQueryData(queryKeys.weekTasks.byDate(refDateIso), initialTasks);
    // Run once on mount for the initial date — subsequent dates fetch via the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: tasks = [], isFetching: pending } = useWeekTasks(refDateIso);

  const todayKey = useMemo(() => toSwissDateKey(new Date()), []);
  const weekDays = useMemo(() => swissWeekDays(refDateIso), [refDateIso]);
  const headerRange = useMemo(() => {
    if (weekDays.length < 2) return "";
    const first = weekDays[0];
    const last = weekDays[weekDays.length - 1];
    return `${first.day}. ${first.monthShort} – ${last.day}. ${last.monthShort}`;
  }, [weekDays]);

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
      setRefDateIso((current) => shiftSwissWeekReference(current, dir));
    },
    [],
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
          aria-label="Vorherige Woche"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex min-h-9 flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-semibold text-foreground">{headerRange}</p>
          {pending ? <BauflipLoadingInline label="Wird geladen …" /> : null}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          onClick={() => navigate(1)}
          disabled={pending}
          aria-label="Nächste Woche"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {weekDays.map((dayInfo, i) => {
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
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-foreground",
                  )}
                >
                  {dayInfo.day}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", isToday ? "text-primary" : "text-foreground")}>
                    {DAY_NAMES_SHORT[i]}
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
                        href={`/auftrag/${task.projectId}`}
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
                                className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
                              >
                                <Clock className="size-3 shrink-0" />
                                {formatTime(s.startsAt)}–{formatTime(s.endsAt)}
                              </p>
                            ))}
                          </div>
                          <p className={cn("mt-0.5 line-clamp-1 text-sm font-semibold", isDone ? "text-muted-foreground line-through" : "text-foreground")}>
                            {task.projectTitle}
                          </p>
                          {task.serviceAddressShort ? (
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              <span className="line-clamp-1">{task.serviceAddressShort}</span>
                            </p>
                          ) : null}
                        </div>
                        {isDone ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-800 dark:text-emerald-200"
                          >
                            <CheckCircle2 className="size-3" />
                            Erledigt
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 text-[10px]",
                              isBesichtigung
                                ? "border-orange-500/30 bg-orange-500/10 text-orange-900 dark:text-orange-200"
                                : "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
                            )}
                          >
                            {isBesichtigung ? "Besichtigung" : "Ausführung"}
                          </Badge>
                        )}
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
