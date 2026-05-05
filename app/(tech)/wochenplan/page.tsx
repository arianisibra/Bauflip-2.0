import { getCurrentSession } from "@/lib/auth/session";
import { listWeekTasks } from "@/lib/db/repository";
import { canAccessTechFieldRoutes } from "@/lib/domain/types";
import { todayKeySwiss } from "@/lib/date/swiss";
import { swissWeekReferenceIsoFromDayKey } from "@/lib/date/swiss-week";
import { TechCalendar } from "@/components/app/tech-calendar";

export default async function TechKalenderPage() {
  const session = await getCurrentSession();
  if (!session || !canAccessTechFieldRoutes(session.role)) return null;

  const weekRef = new Date(swissWeekReferenceIsoFromDayKey(todayKeySwiss()));
  const tasks = await listWeekTasks(
    weekRef,
    session.role === "technician" ? session.user.id : undefined,
  );

  return (
    <section className="flex flex-col gap-5 pb-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Kalender</h1>
        <p className="text-xs text-muted-foreground">
          Termine nach Tag, Woche oder Monat (Europe/Zurich).
        </p>
      </header>
      <TechCalendar initialTasks={tasks} isTechnicianView={session.role === "technician"} />
    </section>
  );
}
