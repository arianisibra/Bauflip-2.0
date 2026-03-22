import { assignAppointmentWithCalendarAction } from "@/app/(app)/actions";
import { listProjects } from "@/lib/db/repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function TerminePage() {
  const projects = await listProjects();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Termine</h1>
      <form action={assignAppointmentWithCalendarAction} className="rounded-lg border bg-white p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Zuweisung erzeugt automatisch Kalendereintrag für den Monteur (ICS-Mail).
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="projectId">Projekt</Label>
            <select id="projectId" name="projectId" className="h-10 rounded-lg border border-input px-3">
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kind">Terminart</Label>
            <select id="kind" name="kind" className="h-10 rounded-lg border border-input px-3">
              <option value="besichtigung">Besichtigung</option>
              <option value="ausfuehrung">Ausführung</option>
            </select>
          </div>
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
