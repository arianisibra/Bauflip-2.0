import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { listProjects } from "@/lib/db/repository";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3 } from "lucide-react";

export default async function ArbeitspoolPage() {
  const projects = await listProjects();
  const urgentCount = projects.filter((project) => project.urgency === "kritisch").length;
  const openCount = projects.filter((project) => project.status !== "abgeschlossen").length;

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-2xl bg-gradient-to-r from-cyan-600 to-sky-700 p-5 text-white">
        <p className="text-sm font-medium text-cyan-100">Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold">Arbeitspool</h1>
        <p className="mt-1 text-sm text-cyan-50">
          Alle Projekte mit nächstem Schritt, klarer Zuständigkeit und Priorität.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Offene Projekte</CardDescription>
            <CardTitle className="text-2xl">{openCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <Clock3 className="mb-1 size-4" />
            Alles ausser abgeschlossene Projekte.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Kritisch</CardDescription>
            <CardTitle className="text-2xl">{urgentCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <AlertTriangle className="mb-1 size-4" />
            Sofortige Bearbeitung nötig.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Heute geplant</CardDescription>
            <CardTitle className="text-2xl">3</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <CalendarClock className="mb-1 size-4" />
            Besichtigungen und Ausführungen.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bereit für Rechnung</CardDescription>
            <CardTitle className="text-2xl">
              {projects.filter((project) => project.status === "rechnung").length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <CheckCircle2 className="mb-1 size-4" />
            Ausführung erledigt, fakturierbar.
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Nächste Aktionen</h2>
          <p className="text-sm text-muted-foreground">
            Fokus auf nächste Aufgabe pro Projekt statt Informationsflut.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/anfrage/neu" />}>
          Neue Anfrage
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Keine offenen Aufgaben</CardTitle>
              <CardDescription>Aktuell ist kein Projekt im Arbeitspool.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          projects.map((project) => (
            <Card key={project.id} className="border-sky-200/70 bg-white">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{project.title}</CardTitle>
                  <StatusBadge status={project.status} />
                </div>
                <CardDescription>
                  Nächster Schritt bei: <span className="font-medium">{project.nextOwnerRole}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Dringlichkeit: {project.urgency}</div>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/projekte/${project.id}`} />}
                >
                  Projekt öffnen
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
