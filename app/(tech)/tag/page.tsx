import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { listWeekTasks } from "@/lib/db/repository";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CalendarOff,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
} from "lucide-react";

function formatTimeRange(isoStart: string, isoEnd: string): string {
  const s = new Date(isoStart);
  const e = new Date(isoEnd);
  const fmt = (d: Date) =>
    `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  return `${fmt(s)}–${fmt(e)}`;
}

function buildMapsUrl(address: string | null): string | null {
  if (!address) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  return "Guten Abend";
}

export default async function TodayPage() {
  const session = await getCurrentSession();
  if (!session) {
    return null;
  }

  const tasks = await listWeekTasks();
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  const todaysTasks = tasks
    .filter((t) => t.assignedTechnicianId === session.user.id && t.startsAt.slice(0, 10) === todayKey)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const upcomingTasks = tasks
    .filter(
      (t) =>
        t.assignedTechnicianId === session.user.id &&
        t.startsAt.slice(0, 10) > todayKey,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 3);

  const openRapportByProject = new Map<
    string,
    { projectId: string; projectTitle: string; isOverdue: boolean }
  >();
  for (const task of tasks) {
    if (task.assignedTechnicianId !== session.user.id) continue;
    if (task.projectStatus !== "einsatz_offen") continue;
    const isOverdue = new Date(task.endsAt) < now;
    if (!openRapportByProject.has(task.projectId)) {
      openRapportByProject.set(task.projectId, {
        projectId: task.projectId,
        projectTitle: task.projectTitle,
        isOverdue,
      });
    } else if (isOverdue) {
      const existing = openRapportByProject.get(task.projectId)!;
      openRapportByProject.set(task.projectId, { ...existing, isOverdue: true });
    }
  }
  const openRapportProjects = Array.from(openRapportByProject.values()).sort((a, b) =>
    a.projectTitle.localeCompare(b.projectTitle, "de-CH"),
  );

  return (
    <section className="flex flex-col gap-5 pb-4">
      {/* Header */}
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {timeOfDayGreeting()}, {session.profile.displayName}
        </p>
        <h1 className="text-2xl font-semibold text-foreground">Mein Tag</h1>
        <p className="text-xs text-muted-foreground">
          Heutige Einsätze. Für den Auftrag antippen.
        </p>
      </header>

      {/* Today's tasks */}
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
                Heute sind dir keine Einsätze zugewiesen. Geniesse den Tag!
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
                          })}{" "}
                          ·{" "}
                          {new Date(task.startsAt).toLocaleTimeString("de-CH", {
                            hour: "2-digit",
                            minute: "2-digit",
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
              return (
                <Link
                  key={task.appointmentId}
                  href={`/auftrag/${task.projectId}`}
                  className={`flex items-center gap-3 rounded-2xl border border-border border-l-4 bg-card px-4 py-4 shadow-sm transition-transform active:scale-[0.98] ${
                    isBesichtigung ? "border-l-amber-400" : "border-l-emerald-400"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <Clock className="size-3" />
                        {formatTimeRange(task.startsAt, task.endsAt)}
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          isBesichtigung
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                            : "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                        }
                      >
                        {isBesichtigung ? "Besichtigung" : "Ausführung"}
                      </Badge>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-foreground">
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
                        {buildMapsUrl(task.serviceAddressShort) ? (
                          <a
                            href={buildMapsUrl(task.serviceAddressShort)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary active:scale-95"
                          >
                            <Navigation className="size-3.5" />
                          </a>
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

      {/* Open reports */}
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
