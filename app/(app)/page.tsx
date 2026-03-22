import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { listAuditEvents, listEmployeeStats, listModuleLabels, listProjects } from "@/lib/db/repository";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, MessageSquare, TriangleAlert } from "lucide-react";
import { getCurrentRole } from "@/lib/auth/session";
import { ModuleLabelEditor } from "@/components/app/module-label-editor";
import { EmployeeStatsPanel } from "@/components/app/employee-stats-panel";
import { hasSupabaseConfig } from "@/lib/supabase/server";

export default async function ArbeitspoolPage() {
  const role = await getCurrentRole();
  const supabaseConfigured = hasSupabaseConfig();
  const labels = await listModuleLabels();
  const title = labels.find((item) => item.key === "overview_page_title")?.label ?? "Admin Übersicht";
  const subtitle =
    labels.find((item) => item.key === "overview_page_subtitle")?.label ??
    "Was braucht heute deine Aufmerksamkeit?";

  const projects = await listProjects();
  const employeeStats = await listEmployeeStats();
  const auditEvents = await listAuditEvents(5);
  const urgentCount = projects.filter((project) => project.urgency === "kritisch").length;
  const openCount = projects.filter((project) => project.status !== "abgeschlossen").length;

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-2xl bg-gradient-to-r from-cyan-600 to-sky-700 p-5 text-white">
        <p className="text-sm font-medium text-cyan-100">Übersicht</p>
        <ModuleLabelEditor moduleKey="overview_page_title" label={title} canEdit={role === "admin"} />
        <p className="mt-1 text-sm text-cyan-50">{subtitle}</p>
      </div>

      {!supabaseConfigured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4" />
            Supabase ist nicht konfiguriert. Es werden Mock-Daten verwendet.
          </div>
        </div>
      ) : null}

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
            <CardDescription>Termine geplant</CardDescription>
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
        <Button nativeButton={false} render={<Link href="/projekte" />}>
          Zu Projekten
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

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Priorisierte Admin-Aufgaben</CardTitle>
              <CardDescription>Nächste Bewegungen aus Projekten und Team.</CardDescription>
            </div>
            <Button variant="ghost" nativeButton={false} render={<Link href="/projekte" />}>
              Alle Projekte
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {auditEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Bewegungen vorhanden.</p>
            ) : (
              auditEvents.map((event) => (
                <div key={event.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{event.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.actorName} · {new Date(event.createdAt).toLocaleString("de-CH")}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Team-Chat</CardTitle>
              <CardDescription>Direkter Austausch mit Monteuren.</CardDescription>
            </div>
            <MessageSquare className="size-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <Button className="w-full" nativeButton={false} render={<Link href="/team-chat" />}>
              Öffnen
            </Button>
          </CardContent>
        </Card>
      </div>

      {role === "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>Mitarbeiter-Statistik</CardTitle>
            <CardDescription>
              Auswahl und Vergleich von erledigten Aufgaben, offenen Rapporten und Zeitaufwand.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmployeeStatsPanel stats={employeeStats} />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
