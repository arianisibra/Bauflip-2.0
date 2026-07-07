"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { useDashboardData } from "@/lib/query/hooks";
import { cn } from "@/lib/utils";
import {
  projectStatusLabels,
  projectStatuses,
  quoteStatusBadgeClassNames,
  quoteStatusLabels,
  quoteStatuses,
  type ProjectStatus,
} from "@/lib/domain/types";
import type { ProjectAgeBucket } from "@/lib/db/dashboard";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 });

const AGE_BUCKET_LABELS: Record<ProjectAgeBucket, string> = {
  "0-7": "0–7 Tage",
  "8-30": "8–30 Tage",
  "31-90": "31–90 Tage",
  "90+": "90+ Tage",
};

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("de-CH", { month: "short", timeZone: "UTC" });

/** Balkenfarbe je Projekt-Status — gleiche Farbfamilie wie `projectStatusBadgeClassNames`. */
const PROJECT_STATUS_BAR_COLORS: Record<ProjectStatus, string> = {
  offen: "bg-zinc-500",
  abgemacht: "bg-lime-500",
  einsatz_offen: "bg-blue-500",
  offerte_senden: "bg-indigo-500",
  offerte_gesendet: "bg-violet-500",
  offerte_genehmigt: "bg-purple-500",
  bestellen: "bg-fuchsia-500",
  bestellt: "bg-pink-500",
  montagebereit: "bg-emerald-500",
  abholbereit: "bg-teal-500",
  werkstatt: "bg-orange-500",
  abklaeren: "bg-amber-500",
  abrechnen: "bg-yellow-500",
  subunternehmer: "bg-stone-500",
  abgeschlossen: "bg-green-600",
  garantiefall: "bg-rose-600",
};

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return MONTH_LABEL_FORMATTER.format(new Date(Date.UTC(y, m - 1, 1)));
}

/** Horizontaler Balken mit Prozent-Breite relativ zu `max` — kein Chart-Package nötig. */
function Bar({ label, value, max, colorClassName, valueLabel }: {
  label: string;
  value: number;
  max: number;
  colorClassName: string;
  valueLabel: string;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums text-foreground">{valueLabel}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", colorClassName)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card size="sm">
      <CardContent className="px-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function DashboardPageClient() {
  const { data, isLoading, isFetching, refetch } = useDashboardData();

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <BauflipLoading size="sm" label="Auswertungen werden geladen …" />
      </div>
    );
  }

  const maxStatusCount = Math.max(1, ...projectStatuses.map((s) => data.statusCounts[s] ?? 0));
  const maxAgeBucket = Math.max(1, ...Object.values(data.projectAge.byBucket));
  const maxMonthlyRevenue = Math.max(1, ...data.monthlyRevenue.map((p) => p.totalGross));
  const maxWorkload = Math.max(1, ...data.technicianWorkload.map((t) => t.appointmentCount));
  const openQuoteValue = data.quotePipeline.valueByStatus.draft + data.quotePipeline.valueByStatus.sent;
  const openQuoteCount = data.quotePipeline.countByStatus.draft + data.quotePipeline.countByStatus.sent;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Auswertungen</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Kennzahlen zu Projekten, Offerten und Auslastung — Stand jetzt.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
          <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden />
          Aktualisieren
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Aktive Projekte" value={String(data.totalActiveProjects)} />
        <KpiCard
          label="Ø Durchlaufzeit"
          value={data.cycleTime.averageDays != null ? `${data.cycleTime.averageDays} Tage` : "—"}
          hint={data.cycleTime.sampleSize > 0 ? `${data.cycleTime.sampleSize} abgeschlossen (90 Tage)` : "Keine Abschlüsse (90 Tage)"}
        />
        <KpiCard
          label="Offene Offerten"
          value={String(openQuoteCount)}
          hint={openQuoteCount > 0 ? chf.format(openQuoteValue) : undefined}
        />
        <KpiCard
          label="Annahmequote"
          value={data.quotePipeline.conversionRate != null ? `${data.quotePipeline.conversionRate}%` : "—"}
          hint="Angenommen / entschieden"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-semibold">Projekte nach Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 px-4">
            {projectStatuses.map((status: ProjectStatus) => {
              const count = data.statusCounts[status] ?? 0;
              if (count === 0) return null;
              return (
                <Bar
                  key={status}
                  label={projectStatusLabels[status]}
                  value={count}
                  max={maxStatusCount}
                  valueLabel={String(count)}
                  colorClassName={PROJECT_STATUS_BAR_COLORS[status]}
                />
              );
            })}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-semibold">Alter offener Projekte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 px-4">
            {(Object.entries(data.projectAge.byBucket) as [ProjectAgeBucket, number][]).map(([bucket, count]) => (
              <Bar
                key={bucket}
                label={AGE_BUCKET_LABELS[bucket]}
                value={count}
                max={maxAgeBucket}
                valueLabel={String(count)}
                colorClassName={bucket === "90+" ? "bg-rose-500" : "bg-primary"}
              />
            ))}
            {data.projectAge.totalOpen === 0 ? (
              <p className="text-xs text-muted-foreground">Keine offenen Projekte.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-semibold">Umsatz angenommener Offerten (6 Monate)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 px-4">
            {data.monthlyRevenue.every((p) => p.quoteCount === 0) ? (
              <p className="text-xs text-muted-foreground">Noch keine angenommenen Offerten im Zeitraum.</p>
            ) : (
              data.monthlyRevenue.map((point) => (
                <Bar
                  key={point.monthKey}
                  label={monthLabel(point.monthKey)}
                  value={point.totalGross}
                  max={maxMonthlyRevenue}
                  valueLabel={point.quoteCount > 0 ? chf.format(point.totalGross) : "—"}
                  colorClassName="bg-emerald-500"
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-semibold">Offerten-Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 px-4">
            {quoteStatuses.map((status) => {
              const count = data.quotePipeline.countByStatus[status];
              if (count === 0) return null;
              return (
                <div key={status} className="flex items-center justify-between gap-2 text-xs">
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium", quoteStatusBadgeClassNames[status])}>
                    {quoteStatusLabels[status]}
                  </span>
                  <span className="text-muted-foreground">
                    {count} · {chf.format(data.quotePipeline.valueByStatus[status])}
                  </span>
                </div>
              );
            })}
            {Object.values(data.quotePipeline.countByStatus).every((c) => c === 0) ? (
              <p className="text-xs text-muted-foreground">Noch keine Offerten erfasst.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-semibold">Rapporte letzte 30 Tage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 px-4">
            {data.reportOutcome.behobenCount + data.reportOutcome.aufgenommenCount === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Rapporte in diesem Zeitraum.</p>
            ) : (
              <>
                <Bar
                  label="Behoben (Erstbesuch)"
                  value={data.reportOutcome.behobenCount}
                  max={Math.max(1, data.reportOutcome.behobenCount, data.reportOutcome.aufgenommenCount)}
                  valueLabel={String(data.reportOutcome.behobenCount)}
                  colorClassName="bg-emerald-500"
                />
                <Bar
                  label="Aufgenommen (Folgetermin nötig)"
                  value={data.reportOutcome.aufgenommenCount}
                  max={Math.max(1, data.reportOutcome.behobenCount, data.reportOutcome.aufgenommenCount)}
                  valueLabel={String(data.reportOutcome.aufgenommenCount)}
                  colorClassName="bg-amber-500"
                />
                {data.reportOutcome.fixedOnFirstVisitRate != null ? (
                  <p className="pt-1 text-[11px] text-muted-foreground">
                    {data.reportOutcome.fixedOnFirstVisitRate}% beim Erstbesuch erledigt
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-semibold">Auslastung nächste 7 Tage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 px-4">
            {data.technicianWorkload.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Monteure in der Organisation.</p>
            ) : (
              data.technicianWorkload.map((t) => (
                <Bar
                  key={t.technicianId}
                  label={t.displayName}
                  value={t.appointmentCount}
                  max={maxWorkload}
                  valueLabel={String(t.appointmentCount)}
                  colorClassName="bg-indigo-500"
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
