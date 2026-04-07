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
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Guten Tag, {session.profile.displayName}
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Mein Tag</h1>
        <p className="text-xs text-slate-500">
          Heutige Einsätze. Für den Auftrag antippen.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Heutige Einsätze
        </h2>
        {todaysTasks.length === 0 ? (
          <div className="space-y-3">
            <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-600">
              Heute sind dir keine Einsätze zugewiesen.
            </p>
            {upcomingTasks.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-xs shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Nächste Termine
                </p>
                <div className="space-y-2">
                  {upcomingTasks.map((task) => (
                    <Link
                      key={task.appointmentId}
                      href={`/auftrag/${task.projectId}`}
                      className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm active:scale-[0.99]"
                    >
                      <p className="text-[11px] font-medium text-slate-700">
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
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-900">
                        {task.projectTitle}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {todaysTasks.map((task) => (
              <Link
                key={task.appointmentId}
                href={`/auftrag/${task.projectId}`}
                className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm active:scale-[0.99]"
              >
                <p className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
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
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                  {task.projectTitle}
                </p>
                {task.tenantDisplay || task.serviceAddressShort ? (
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">
                    {[task.tenantDisplay, task.serviceAddressShort].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </section>

      {openRapportProjects.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Offene Einsätze
          </h2>
          <p className="text-[11px] text-slate-500">
            Diese Aufträge sind noch in Arbeit.
          </p>
          <div className="space-y-2">
            {openRapportProjects.map((item) => (
              <Link
                key={item.projectId}
                href={`/auftrag/${item.projectId}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm active:scale-[0.99]"
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
        </section>
      ) : null}
    </section>
  );
}
