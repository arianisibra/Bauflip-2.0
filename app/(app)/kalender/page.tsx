import { getCurrentSession } from "@/lib/auth/session";
import { listMonthTasks } from "@/lib/db/repository";
import { AdminCalendar } from "@/components/app/admin-calendar";

export default async function KalenderPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const now = new Date();
  const tasks = await listMonthTasks(now.getFullYear(), now.getMonth() + 1);

  return (
    <section className="flex flex-col gap-6">
      <div className="space-y-1 border-b border-border/60 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Kalender
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Monatsübersicht aller Termine.
        </p>
      </div>
      <AdminCalendar
        initialTasks={tasks}
        initialYear={now.getFullYear()}
        initialMonth={now.getMonth() + 1}
      />
    </section>
  );
}
