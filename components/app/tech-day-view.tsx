"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarOff,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react";
import type { WeekTaskItem } from "@/lib/domain/types";
import { projectStatusBadgeClassName, projectStatusLabels } from "@/lib/domain/types";
import { useWeekTasks } from "@/lib/query/hooks";
import { BauflipLoadingInline } from "@/components/ui/bauflip-loading";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { todayKeySwiss } from "@/lib/date/swiss";
import { Badge } from "@/components/ui/badge";
import { MapsNavButton } from "@/components/app/maps-nav-button";

function formatTimeRange(isoStart: string, isoEnd: string): string {
  const s = new Date(isoStart);
  const e = new Date(isoEnd);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
  return `${fmt(s)}–${fmt(e)}`;
}

function ProjectStatusBadge({ status }: { status: string }) {
  const label = projectStatusLabels[status as keyof typeof projectStatusLabels] ?? status;
  return (
    <Badge variant="outline" className={cn("px-1.5 py-0.5 text-[10px] font-medium", projectStatusBadgeClassName(status))}>
      {label}
    </Badge>
  );
}

export function TechDayView({
  initialTasks,
  referenceIso,
  greeting,
  displayName,
  isTechnicianView,
  currentUserId,
}: {
  initialTasks: WeekTaskItem[];
  referenceIso: string;
  greeting: string;
  displayName: string;
  isTechnicianView: boolean;
  currentUserId: string;
}) {
  const qc = useQueryClient();

  // Seed the cache once with SSR data. Subsequent refetches (e.g., after an
  // SSE invalidation) come through the hook.
  useMemo(() => {
    qc.setQueryData(queryKeys.weekTasks.byDate(referenceIso), initialTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: tasks = initialTasks, isFetching } = useWeekTasks(referenceIso);

  const { todaysTasks, upcomingTasks, openRapportProjects } = useMemo(() => {
    const now = new Date();
    const todayKey = todayKeySwiss(now);
    const taskDateKey = (iso: string) => todayKeySwiss(new Date(iso));
    const visibleTask = (t: WeekTaskItem) =>
      isTechnicianView ? t.assignedTechnicianId === currentUserId : true;

    const todays = tasks
      .filter((t) => visibleTask(t) && taskDateKey(t.startsAt) === todayKey)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    const upcoming = tasks
      .filter((t) => visibleTask(t) && taskDateKey(t.startsAt) > todayKey)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 3);

    const openByProject = new Map<
      string,
      { projectId: string; projectTitle: string; isOverdue: boolean }
    >();
    for (const task of tasks) {
      if (!visibleTask(task)) continue;
      if (task.projectStatus !== "einsatz_offen") continue;
      const isOverdue = new Date(task.endsAt) < now;
      if (!openByProject.has(task.projectId)) {
        openByProject.set(task.projectId, {
          projectId: task.projectId,
          projectTitle: task.projectTitle,
          isOverdue,
        });
      } else if (isOverdue) {
        const existing = openByProject.get(task.projectId)!;
        openByProject.set(task.projectId, { ...existing, isOverdue: true });
      }
    }
    const openList = Array.from(openByProject.values()).sort((a, b) =>
      a.projectTitle.localeCompare(b.projectTitle, "de-CH"),
    );

    return { todaysTasks: todays, upcomingTasks: upcoming, openRapportProjects: openList };
  }, [tasks, isTechnicianView, currentUserId]);

  return (
    <section className="flex flex-col gap-5 pb-4">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {greeting}, {displayName}
        </p>
        <h1 className="text-2xl font-semibold text-foreground">Mein Tag</h1>
        <p className="text-xs text-muted-foreground">
          Heutige Einsätze. Für den Auftrag antippen.
        </p>
        {isFetching ? (
          <div className="pt-1">
            <BauflipLoadingInline label="Termine werden aktualisiert …" />
          </div>
        ) : null}
      </header>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Heutige Einsätze
        </h2>
        {todaysTasks.length === 0 ? (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center">
              <CalendarOff className="size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Keine Einsätze heute</p>
              <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                {isTechnicianView
                  ? "Heute sind dir keine Einsätze zugewiesen. Geniesse den Tag!"
                  : "Heute sind keine Termine in der Übersicht. Geniesse den Tag!"}
              </p>
            </div>
            {upcomingTasks.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Nächste Termine
                </p>
                <div className="space-y-2">
                  {upcomingTasks.map((task) => (
                    <Link
                      key={task.appointmentId}
                      href={`/auftrag/${task.projectId}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-transform active:scale-[0.98]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                          <Clock className="size-3" />
                          {new Date(task.startsAt).toLocaleDateString("de-CH", {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                            timeZone: "Europe/Zurich",
                          })}{" "}
                          ·{" "}
                          {new Date(task.startsAt).toLocaleTimeString("de-CH", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Europe/Zurich",
                          })}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs font-medium text-foreground">
                          {task.projectTitle}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {todaysTasks.map((task) => {
              const isBesichtigung = task.kind === "besichtigung";
              const isDone = task.projectStatus === "abgeschlossen";
              return (
                <Link
                  key={task.appointmentId}
                  href={`/auftrag/${task.projectId}`}
                  className={`flex items-center gap-3 rounded-2xl border border-border border-l-4 bg-card px-4 py-4 shadow-sm transition-transform active:scale-[0.98] ${
                    isDone
                      ? "border-l-muted-foreground/30 opacity-60"
                      : isBesichtigung
                        ? "border-l-orange-500"
                        : "border-l-emerald-400"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <Clock className="size-3" />
                        {formatTimeRange(task.startsAt, task.endsAt)}
                      </p>
                      <div className="flex flex-col items-end gap-1">
                        {isDone ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                          >
                            <CheckCircle2 className="size-3" />
                            Erledigt
                          </Badge>
                        ) : (
                          <>
                            <Badge
                              variant="outline"
                              className={
                                isBesichtigung
                                  ? "border-orange-500/30 bg-orange-500/10 text-orange-900 dark:text-orange-200"
                                  : "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                              }
                            >
                              {isBesichtigung ? "Besichtigung" : "Ausführung"}
                            </Badge>
                            <ProjectStatusBadge status={task.projectStatus} />
                          </>
                        )}
                      </div>
                    </div>
                    <p className={`mt-1.5 line-clamp-2 text-sm font-semibold ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {task.projectTitle}
                    </p>
                    {task.tenantDisplay || task.serviceAddressShort ? (
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        <span className="line-clamp-1 flex-1">
                          {[task.tenantDisplay, task.serviceAddressShort]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {task.serviceAddressShort ? (
                          <MapsNavButton address={task.serviceAddressShort} />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground/40" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {openRapportProjects.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Offene Einsätze
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Diese Aufträge sind noch in Arbeit.
          </p>
          <div className="space-y-2">
            {openRapportProjects.map((item) => (
              <Link
                key={item.projectId}
                href={`/auftrag/${item.projectId}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition-transform active:scale-[0.98]"
              >
                <span className="line-clamp-1 text-sm text-foreground">{item.projectTitle}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {item.isOverdue ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="size-3" />
                      Überfällig
                    </Badge>
                  ) : (
                    <Badge variant="outline">Offen</Badge>
                  )}
                  <ChevronRight className="size-4 text-muted-foreground/40" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
