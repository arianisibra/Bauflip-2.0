import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { StatusBadge } from "@/components/app/status-badge";
import type { UserProfile, WeekTaskItem } from "@/lib/domain/types";
import { formatWeekRangeDe, getWeekBounds } from "@/lib/date/week-bounds";
import { resolveCalendarColor } from "@/lib/calendar/team-colors";
import { cn } from "@/lib/utils";

const kindLabel: Record<WeekTaskItem["kind"], string> = {
  besichtigung: "Besichtigung",
  ausfuehrung: "Ausführung",
};

function formatSlot(iso: string) {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type WeekTasksStripProps = {
  tasks: WeekTaskItem[];
  /** Team-Legende: Farbe + Positionsnummer (sortiert aus listAssignableProfiles) */
  teamProfiles?: UserProfile[];
  /** Ohne Seitentitel — für eingebettete Dashboard-Bausteine */
  embedded?: boolean;
};

export function WeekTasksStrip({ tasks, teamProfiles = [], embedded = false }: WeekTasksStripProps) {
  const { start, end } = getWeekBounds();
  const rangeLabel = formatWeekRangeDe(start, end);

  return (
    <div className={cn("flex flex-col", embedded ? "gap-2" : "gap-3")}>
      {!embedded ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Aufgaben dieser Woche</h2>
            <p className="text-sm text-muted-foreground">
              Kalenderwoche: {rangeLabel} · von links nach rechts nach Zeit sortiert
            </p>
          </div>
          <Link href="/termine" className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
            Alle Termine
          </Link>
        </div>
      ) : (
        <p className="text-xs leading-snug text-muted-foreground">
          {rangeLabel} · nach Zeit sortiert ·{" "}
          <Link href="/termine" className="font-medium text-foreground underline-offset-4 hover:underline">
            Alle Termine
          </Link>
        </p>
      )}

      {teamProfiles.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 rounded-md border border-dashed border-border/60 bg-muted/15 px-2.5 py-1.5 text-xs">
          <span className="font-medium text-muted-foreground">Team:</span>
          {teamProfiles.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5">
              <span
                className="size-3 shrink-0 rounded-sm border border-black/10"
                style={{ backgroundColor: resolveCalendarColor(p.calendarColor, p.id) }}
                title={p.displayName}
              />
              <span className="tabular-nums text-muted-foreground">{p.calendarPosition}</span>
              <span className="max-w-[140px] truncate">{p.displayName}</span>
            </div>
          ))}
        </div>
      ) : null}

      {tasks.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Keine Termine in dieser Woche</CardTitle>
            <CardDescription>
              Sobald Besichtigungen oder Ausführungen geplant sind, erscheinen sie hier in der Reihenfolge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/projekte" className={buttonVariants()}>
              Zu Projekten
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className={embedded ? "relative" : "relative -mx-6 px-6 md:mx-0 md:px-0"}>
          <div className="flex gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-gutter:stable] snap-x snap-mandatory">
            {tasks.map((task, index) => (
              <Card
                key={task.appointmentId}
                className="min-w-[min(100%,320px)] max-w-[320px] shrink-0 snap-start border bg-white shadow-sm"
                style={{ borderLeftWidth: 4, borderLeftColor: task.calendarColor }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {index + 1}. {formatSlot(task.startsAt)}
                    </span>
                    <StatusBadge status={task.projectStatus} />
                  </div>
                  <CardTitle className="text-base leading-snug">{task.projectTitle}</CardTitle>
                  <CardDescription>
                    {kindLabel[task.kind]}
                    {task.technicianName ? (
                      <span className="mt-1 block text-foreground">
                        <span
                          className="mr-1 inline-block size-2 rounded-full align-middle"
                          style={{ backgroundColor: task.calendarColor }}
                        />
                        {task.technicianName}
                      </span>
                    ) : (
                      <span className="mt-1 block text-muted-foreground">Noch kein Monteur zugewiesen</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href={`/projekte/${task.projectId}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
                    Projekt öffnen
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
