import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { CompanyKpiDashboardContent } from "@/components/app/company-kpi-dashboard";
import { WeekTasksStrip } from "@/components/app/week-tasks-strip";
import type { DashboardPageData } from "@/lib/dashboard/page-data";
import type { WidgetId } from "@/lib/dashboard/types";
import { MessageSquare } from "lucide-react";

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
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <Card size="sm" className="border-border/60 bg-muted/15 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
            <CardHeader className="gap-0.5 pb-2 pt-3">
              <CardDescription className="text-xs">Offene Projekte</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums tracking-tight">{snapshot.openCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm" className="border-border/60 bg-muted/15 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
            <CardHeader className="gap-0.5 pb-2 pt-3">
              <CardDescription className="text-xs">Termine diese Woche</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums tracking-tight">{kpis.appointmentsThisWeekCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm" className="col-span-2 border-border/60 bg-muted/15 shadow-sm ring-1 ring-black/[0.03] lg:col-span-1 dark:ring-white/[0.06]">
            <CardHeader className="gap-0.5 pb-2 pt-3">
              <CardDescription className="text-xs">Bereit für Rechnung</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums tracking-tight">{snapshot.invoiceReadyCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      );

    case "betrieb_erfolg":
      return <CompanyKpiDashboardContent kpis={kpis} />;

    case "week_tasks":
      return <WeekTasksStrip tasks={weekTasks} teamProfiles={teamCalendarProfiles} embedded />;

    case "offers_invoices":
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
            <p className="text-xs font-medium text-muted-foreground">Offerte → Abschluss</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
              {kpis.quoteWinRatePercent === null ? "—" : `${kpis.quoteWinRatePercent} %`}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
            <p className="text-xs font-medium text-muted-foreground">Offene Rechnungen</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">{kpis.openInvoicesCount}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
            <p className="text-xs font-medium text-muted-foreground">Kontakte (gesamt)</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">{kpis.contactsCount}</p>
          </div>
        </div>
      );

    case "team_compact":
      if (employeeStats.length === 0) {
        return <p className="text-sm text-muted-foreground">Noch keine Team-Metriken vorhanden.</p>;
      }
      return (
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Offen</th>
                <th className="px-3 py-2 text-right">Heute</th>
                <th className="px-3 py-2 text-right">Std.</th>
              </tr>
            </thead>
            <tbody>
              {employeeStats.map((row) => (
                <tr key={row.profileId} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-1.5 font-medium">{row.profileName}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{row.offeneProjekte}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{row.abgeschlosseneHeute}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{row.stundenDieseWoche}</td>
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
          {latestProject ? (
            <Button
              variant="outline"
              size="sm"
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

    case "recent_projects": {
      const recent = sortRecent(projects).slice(0, 6);
      return (
        <div className="flex flex-col gap-1.5">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Projekte.</p>
          ) : (
            recent.map((p) => (
              <Link
                key={p.id}
                href={`/projekte/${p.id}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/10 px-2.5 py-1.5 text-sm transition-colors hover:bg-muted/40"
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
