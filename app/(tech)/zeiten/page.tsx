import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { listWeekTasks } from "@/lib/db/repository";

export default async function TechTimesPage() {
  const session = await getCurrentSession();
  if (!session) {
    return null;
  }

  const tasks = await listWeekTasks();
  const todayKey = new Date().toISOString().slice(0, 10);

  const todaysTasks = tasks
    .filter((t) => t.assignedTechnicianId === session.user.id && t.startsAt.slice(0, 10) === todayKey)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <section className="flex flex-col gap-5 pb-4">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Zeiterfassung
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Heute</h1>
        <p className="text-xs text-slate-500">
          Wähle einen Einsatz, um Zeiten zu erfassen. Start/Stop folgt im nächsten Schritt.
        </p>
      </header>

      {todaysTasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-600">
          Heute sind dir keine Einsätze zugewiesen.
        </p>
      ) : (
        <div className="space-y-3">
          {todaysTasks.map((task) => (
            <Link
              key={task.appointmentId}
              href={`/termine/${task.projectId}`}
              className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm shadow-sm active:scale-[0.99]"
            >
              <p className="line-clamp-2 font-semibold text-slate-900">{task.projectTitle}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(task.startsAt).toLocaleTimeString("de-CH", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                –{" "}
                {new Date(task.endsAt).toLocaleTimeString("de-CH", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

