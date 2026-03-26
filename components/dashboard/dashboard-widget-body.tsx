import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { CompanyKpiDashboardContent } from "@/components/app/company-kpi-dashboard";
import { WeekTasksStrip } from "@/components/app/week-tasks-strip";
import type { DashboardPageData } from "@/lib/dashboard/page-data";
import type { WidgetId } from "@/lib/dashboard/types";
import { statusLabels } from "@/lib/workflow/project-workflow";
import type { ProjectStatus } from "@/lib/domain/types";
import { projectStatuses } from "@/lib/domain/types";
import { MessageSquare, Phone } from "lucide-react";

function projectTime(p: { updatedAt?: string; updated_at?: string; createdAt?: string; created_at?: string }) {
  const u = p.updatedAt ?? p.updated_at ?? p.createdAt ?? p.created_at ?? "";
  return new Date(u).getTime();
}

function sortRecent(projects: DashboardPageData["projects"]) {
  return [...projects].sort((a, b) => projectTime(b) - projectTime(a));
}

export function DashboardWidgetBody({
  widgetId,
  data,
}: {
  widgetId: WidgetId;
  data: DashboardPageData;
}) {
  const { projects, weekTasks, teamCalendarProfiles, kpis, employeeStats, snapshot } = data;

  switch (widgetId) {
    case "snapshot_kpis":
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Offene Projekte</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{snapshot.openCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Kritisch</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{snapshot.urgentCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Termine diese Woche</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{kpis.appointmentsThisWeekCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Bereit für Rechnung</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{snapshot.invoiceReadyCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      );

    case "betrieb_erfolg":
      return <CompanyKpiDashboardContent kpis={kpis} />;

    case "week_tasks":
      return <WeekTasksStrip tasks={weekTasks} teamProfiles={teamCalendarProfiles} embedded />;

    case "pipeline_status": {
      const counts = new Map<ProjectStatus, number>();
      for (const s of projectStatuses) {
        counts.set(s, 0);
      }
      for (const p of projects) {
        const st = p.status as ProjectStatus;
        counts.set(st, (counts.get(st) ?? 0) + 1);
      }
      const entries = [...counts.entries()]
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      const max = Math.max(1, ...entries.map(([, n]) => n));
      return (
        <div className="flex flex-col gap-2">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Projekte erfasst.</p>
          ) : (
            entries.map(([status, n]) => (
              <div key={status} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate text-muted-foreground sm:w-48">{statusLabels[status]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${(n / max) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right tabular-nums font-medium">{n}</span>
              </div>
            ))
          )}
        </div>
      );
    }

    case "urgent_projects": {
      const urgent = projects.filter((p) => p.urgency === "kritisch" && p.status !== "abgeschlossen");
      return (
        <div className="flex flex-col gap-2">
          {urgent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine kritischen Aufträge im offenen Bestand.</p>
          ) : (
            urgent.slice(0, 8).map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/60 bg-amber-50/40 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-950/20"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.title}</p>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/projekte/${p.id}`} />}>
                  Öffnen
                </Button>
              </div>
            ))
          )}
        </div>
      );
    }

    case "offers_invoices":
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Offerte → Abschluss</p>
            <p className="text-lg font-semibold">
              {kpis.quoteWinRatePercent === null ? "—" : `${kpis.quoteWinRatePercent} %`}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Offene Rechnungen</p>
            <p className="text-lg font-semibold tabular-nums">{kpis.openInvoicesCount}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Kontakte (gesamt)</p>
            <p className="text-lg font-semibold tabular-nums">{kpis.contactsCount}</p>
          </div>
        </div>
      );

    case "logistics_pulse":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Bestellungen unterwegs</p>
            <p className="text-lg font-semibold tabular-nums">{kpis.purchaseOrdersInTransit}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Termine diese Woche</p>
            <p className="text-lg font-semibold tabular-nums">{kpis.appointmentsThisWeekCount}</p>
          </div>
        </div>
      );

    case "team_compact":
      if (employeeStats.length === 0) {
        return <p className="text-sm text-muted-foreground">Noch keine Team-Metriken vorhanden.</p>;
      }
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Name</th>
                <th className="pb-2 pr-3 text-right font-medium">Offen</th>
                <th className="pb-2 pr-3 text-right font-medium">Heute</th>
                <th className="pb-2 text-right font-medium">Std.</th>
              </tr>
            </thead>
            <tbody>
              {employeeStats.map((row) => (
                <tr key={row.profileId} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-3 font-medium">{row.profileName}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.offeneProjekte}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.abgeschlosseneHeute}</td>
                  <td className="py-2 text-right tabular-nums">{row.stundenDieseWoche}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "chat_module":
      const latestProject = sortRecent(projects)[0];
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Direkter Einstieg in den Projektchat ohne Umweg über die Chat-Übersicht.</p>
          {latestProject ? (
            <Button
              variant="outline"
              className="w-fit justify-start gap-2"
              nativeButton={false}
              render={<Link href={`/projekte/${latestProject.id}#team-chat`} />}
            >
              <MessageSquare className="size-4 text-cyan-600" />
              Direkt zum Chatfenster
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Noch kein Projekt vorhanden.</p>
          )}
        </div>
      );

    case "shortcuts":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" className="justify-start gap-2" nativeButton={false} render={<Link href="/projekte" />}>
            Projekte
          </Button>
          <Button variant="outline" className="justify-start gap-2" nativeButton={false} render={<Link href="/rapporte" />}>
            Rapporte
          </Button>
          <Button variant="outline" className="justify-start gap-2" nativeButton={false} render={<Link href="/termine" />}>
            Termine
          </Button>
          <Button variant="outline" className="justify-start gap-2" nativeButton={false} render={<Link href="/projekte" />}>
            <Phone className="size-4" />
            Neue Anfrage
          </Button>
        </div>
      );

    case "recent_projects": {
      const recent = sortRecent(projects).slice(0, 6);
      return (
        <div className="flex flex-col gap-2">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Projekte.</p>
          ) : (
            recent.map((p) => (
              <Link
                key={p.id}
                href={`/projekte/${p.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
              >
                <span className="truncate font-medium">{p.title}</span>
                <StatusBadge status={p.status} />
              </Link>
            ))
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
