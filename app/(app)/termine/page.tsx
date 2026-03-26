import { assignAppointmentWithCalendarAction } from "@/app/(app)/actions";
import { listProjects, listAppointmentsInRange } from "@/lib/db/repository";
import { TerminePlanFields } from "@/components/app/termine-plan-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TermineCalendarClient } from "@/components/app/termine-calendar-client";

type Props = {
  searchParams: Promise<{ y?: string; m?: string; d?: string; v?: string }>;
};

export default async function TerminePage(props: Props) {
  const sp = await props.searchParams;
  const now = new Date();
  const view = sp.v === "week" || sp.v === "day" ? sp.v : "month";
  const y = Number.isFinite(Number(sp.y)) ? Number(sp.y) : now.getFullYear();
  const mRaw = Number.isFinite(Number(sp.m)) ? Number(sp.m) : now.getMonth() + 1;
  const m = Math.min(12, Math.max(1, mRaw));
  const maxDay = new Date(y, m, 0).getDate();
  const dRaw = Number.isFinite(Number(sp.d)) ? Number(sp.d) : now.getDate();
  const d = Math.min(maxDay, Math.max(1, dRaw));
  const selected = new Date(y, m - 1, d);

  let start: Date;
  let end: Date;
  if (view === "day") {
    start = new Date(y, m - 1, d, 0, 0, 0, 0);
    end = new Date(y, m - 1, d, 23, 59, 59, 999);
  } else if (view === "week") {
    const mondayOffset = (selected.getDay() + 6) % 7;
    start = new Date(y, m - 1, d - mondayOffset, 0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else {
    start = new Date(y, m - 1, 1);
    end = new Date(y, m, 0, 23, 59, 59, 999);
  }

  const [projects, appointments] = await Promise.all([listProjects(), listAppointmentsInRange(start, end)]);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Termine</h1>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <TermineCalendarClient year={y} month={m} day={d} view={view} appointments={appointments} />
      </div>

      <form action={assignAppointmentWithCalendarAction} className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-medium">Neuen Termin planen</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Termin wird gespeichert; Monteur erhält Kalendereintrag (ICS-Mail). Mit verbundenem Google- oder Outlook-Kalender
          zusätzlich in den externen Kalender übernommen (siehe Integrationen).
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <TerminePlanFields projects={projects.map((p) => ({ id: p.id, title: p.title }))} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="startsAt">Start</Label>
            <Input id="startsAt" name="startsAt" type="datetime-local" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="endsAt">Ende</Label>
            <Input id="endsAt" name="endsAt" type="datetime-local" required />
          </div>
          <Input type="hidden" name="planningNotes" value="Automatisch aus Terminplanung." />
        </div>
        <Button className="mt-4" type="submit">
          Termin planen & Kalender senden
        </Button>
      </form>
    </section>
  );
}
