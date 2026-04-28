"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import type { WeekTaskItem } from "@/lib/domain/types";
import { groupWeekTasksByProjectDay } from "@/lib/tech/group-week-tasks-by-project-day";
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
      </div>

      <div className="space-y-2">
        {groupedTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Keine Termine in diesem Monat.
          </div>
        ) : (
          groupedTasks.map((group) => {
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
    </div>
  );
}
