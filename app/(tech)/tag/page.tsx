import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { listWeekTasks } from "@/lib/db/repository";

function formatTimeRange(isoStart: string, isoEnd: string): string {
  const s = new Date(isoStart);
  const e = new Date(isoEnd);
  const fmt = (d: Date) =>
    `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  return `${fmt(s)}–${fmt(e)}`;
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

  // Projekte mit offenen Rapporten (vereinfachte Heuristik über Projektstatus).
  const openRapportByProject = new Map<
    string,
    { projectId: string; projectTitle: string; isOverdue: boolean }
  >();
  for (const task of tasks) {
    if (task.assignedTechnicianId !== session.user.id) continue;
    if (task.projectStatus !== "bericht_ausstehend") continue;
    const isOverdue = new Date(task.endsAt) < now;
    if (!openRapportByProject.has(task.projectId)) {
      openRapportByProject.set(task.projectId, {
        projectId: task.projectId,
        projectTitle: task.projectTitle,
        isOverdue,
      });
    } else if (isOverdue) {
      // Wenn irgendein zugehöriger Termin überfällig ist, markieren.
      const existing = openRapportByProject.get(task.projectId)!;
      openRapportByProject.set(task.projectId, { ...existing, isOverdue: true });
    }
  }
  const openRapportProjects = Array.from(openRapportByProject.values()).sort((a, b) =>
    a.projectTitle.localeCompare(b.projectTitle, "de-CH"),
  );

  return (
    <section className="flex flex-col gap-4">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Guten Tag, {session.profile.displayName}
        </p>
        <h1 className="text-xl font-semibold text-slate-900">Deine Einsätze heute</h1>
      </header>

      {todaysTasks.length === 0 ? (
        <p className="text-sm text-slate-600">Heute sind dir keine Einsätze zugewiesen.</p>
      ) : (
        <div className="space-y-3">
          {todaysTasks.map((task) => (
            <Link
              key={task.appointmentId}
              href={`/termine/${task.projectId}`}
              className="block rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
            >
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <span>{formatTimeRange(task.startsAt, task.endsAt)}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                    task.kind === "besichtigung"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {task.kind === "besichtigung" ? "Besichtigung" : "Ausführung"}
                </span>
              </p>
              <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-slate-900">
                {task.projectTitle}
              </p>
            </Link>
          ))}
        </div>
      )}

      {openRapportProjects.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Offene Rapporte
          </h2>
          <div className="space-y-2">
            {openRapportProjects.map((item) => (
              <Link
                key={item.projectId}
                href={`/rapport/${item.projectId}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <span className="line-clamp-1 text-slate-900">{item.projectTitle}</span>
                <span
                  className={`ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                    item.isOverdue ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {item.isOverdue ? "Überfällig" : "Offen"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <footer className="mt-2 text-xs text-slate-500">
        Für Details zu einem Einsatz einfach antippen. Rapporte werden direkt beim Termin erfasst.
      </footer>
    </section>
  );
}

