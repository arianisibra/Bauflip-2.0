import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { listMonthTasks } from "@/lib/db/repository";
import { swissYmdParts } from "@/lib/date/swiss";
import { BauflipLoading } from "@/components/ui/bauflip-loading";

const AdminCalendar = dynamic(
  () => import("@/components/app/admin-calendar").then((m) => m.AdminCalendar),
  {
    loading: () => (
      <div className="flex min-h-[18rem] items-center justify-center py-12" role="status" aria-live="polite">
        <BauflipLoading size="sm" label="Kalender wird geladen …" />
      </div>
    ),
  },
);

export default async function KalenderPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/anmeldung");

  const { y, m } = swissYmdParts(new Date());
  const tasks = await listMonthTasks(y, m);

  return (
    <section className="flex flex-col gap-6">
      <div className="space-y-1 border-b border-border/60 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Kalender
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Termine nach Monat, Kalenderwoche oder einzelnem Tag (Europe/Zurich).
        </p>
      </div>
      <AdminCalendar
        initialTasks={tasks}
        initialYear={y}
        initialMonth={m}
      />
    </section>
  );
}
