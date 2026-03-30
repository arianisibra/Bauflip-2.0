import { assignAppointmentWithCalendarAction } from "@/app/(app)/actions";
import { listProjects, listAppointmentsInRange } from "@/lib/db/repository";
import { TerminePlanFields } from "@/components/app/termine-plan-fields";
import { TermineCalendarClient } from "@/components/app/termine-calendar-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, CalendarPlus } from "lucide-react";

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
      <div className="flex flex-col gap-2 border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Termine</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Kalenderübersicht, Termin auf einen Blick — Klick auf einen Eintrag öffnet Details und Verantwortliche.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground shadow-sm">
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
            <span>Montage &amp; Besichtigung</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(100%,22rem)] lg:items-start xl:grid-cols-[minmax(0,1fr)_min(100%,24rem)]">
        <Card
          size="sm"
          className="overflow-hidden border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]"
        >
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight">Kalender</CardTitle>
                <CardDescription className="text-xs leading-relaxed">Monat, Woche oder Tag — Termine antippen für Details.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 py-4 sm:px-5 sm:py-5">
            <TermineCalendarClient year={y} month={m} day={d} view={view} appointments={appointments} />
          </CardContent>
        </Card>

        <Card
          size="sm"
          className="lg:sticky lg:top-20 overflow-hidden border-border/60 shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.08]"
        >
          <CardHeader className="border-b border-border/50 bg-muted/25 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarPlus className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight">Neuen Termin planen</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Speichern; Monteur erhält ICS. Mit Google/Outlook zusätzlich extern (siehe Integrationen).
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <form action={assignAppointmentWithCalendarAction} className="flex flex-col">
            <CardContent className="space-y-4 pt-4">
              <TerminePlanFields projects={projects.map((p) => ({ id: p.id, title: p.title }))} />
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="startsAt" className="text-xs font-medium">
                    Start
                  </Label>
                  <Input id="startsAt" name="startsAt" type="datetime-local" required className="h-9" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="endsAt" className="text-xs font-medium">
                    Ende
                  </Label>
                  <Input id="endsAt" name="endsAt" type="datetime-local" required className="h-9" />
                </div>
              </div>
              <Input type="hidden" name="planningNotes" value="Automatisch aus Terminplanung." />
            </CardContent>
            <CardFooter className="flex flex-col gap-2 border-t border-border/50 bg-muted/10 px-4 py-4">
              <Button type="submit" className="w-full" size="sm">
                Termin planen &amp; Kalender senden
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </section>
  );
}
