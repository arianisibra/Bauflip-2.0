import { getCurrentSession } from "@/lib/auth/session";
import { listWeekTasks } from "@/lib/db/repository";
import { canAccessTechFieldRoutes } from "@/lib/domain/types";
import { TechCalendar } from "@/components/app/tech-calendar";

export default async function TechKalenderPage() {
  const session = await getCurrentSession();
  if (!session || !canAccessTechFieldRoutes(session.role)) return null;

  const tasks = await listWeekTasks();
  const myTasks =
    session.role === "technician"
      ? tasks.filter((t) => t.assignedTechnicianId === session.user.id)
      : tasks;

  return (
    <section className="flex flex-col gap-5 pb-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Kalender</h1>
        <p className="text-xs text-muted-foreground">
          Deine Termine der Woche im Überblick.
        </p>
      </header>
      <TechCalendar initialTasks={myTasks} isTechnicianView={session.role === "technician"} />
    </section>
  );
}
