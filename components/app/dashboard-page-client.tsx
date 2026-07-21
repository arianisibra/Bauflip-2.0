"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardList, RefreshCw } from "lucide-react";
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

/** Fixe Farbe je Alters-Bucket: aufsteigende Sättigung (ordinal) — 90+ ist ein Risikosignal, keine Ramp-Stufe. */
const AGE_BUCKET_BAR_COLORS: Record<ProjectAgeBucket, string> = {
  "0-7": "bg-primary/35",
  "8-30": "bg-primary/60",
  "31-90": "bg-primary/85",
  "90+": "bg-rose-500",
};

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("de-CH", { month: "short", timeZone: "UTC" });

/** Neutraler Mess-Balken (Menge/Betrag ohne Status-Bedeutung): Umsatz, Auslastung. */
const MEASURE_BAR_COLOR = "bg-indigo-500";

/**
 * Der Projekt-Status ist kein Kategorial-, sondern ein ORDINAL-Feld (fester
 * Workflow, "Reihenfolge = Kunden-Priorität" laut Domain-Kommentar) — eine
 * Ordinal-Rampe (ein Farbton, steigende Sättigung) statt 16 verschiedener Hues.
 * Die zwei Status mit echter Status-Bedeutung ("gut"/"kritisch", nicht nur
 * "weiter im Pfad") bekommen stattdessen feste Status-Farbe + Icon.
 */
const ORDINAL_RAMP = [
  "bg-primary/30",
  "bg-primary/45",
  "bg-primary/60",
  "bg-primary/75",
  "bg-primary/90",
  "bg-primary",
] as const;

function ordinalRampClass(index: number, total: number): string {
  if (total <= 1) return ORDINAL_RAMP[ORDINAL_RAMP.length - 1];
  const step = Math.round((index / (total - 1)) * (ORDINAL_RAMP.length - 1));
  return ORDINAL_RAMP[step];
}

const TERMINAL_PROJECT_STATUS_STYLE: Partial<
  Record<ProjectStatus, { icon: ComponentType<{ className?: string }>; iconClassName: string; barClassName: string }>
> = {
  abgeschlossen: {
    icon: CheckCircle2,
    iconClassName: "text-emerald-600 dark:text-emerald-400",
    barClassName: "bg-emerald-500",
  },
  garantiefall: {
    icon: AlertTriangle,
    iconClassName: "text-rose-600 dark:text-rose-400",
    barClassName: "bg-rose-500",
  },
};

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return MONTH_LABEL_FORMATTER.format(new Date(Date.UTC(y, m - 1, 1)));
}

/**
 * Horizontaler Balken mit Prozent-Breite relativ zu `max` — kein Chart-Package nötig.
 * Mark-Spec: Fläche rund am datentragenden Ende, eckig an der Baseline (nicht beidseitig
 * rund) — die Schiene bleibt als reine Chrome-Form ein volles Pill.
 */
function Bar({ label, value, max, colorClassName, valueLabel, icon: Icon, iconClassName }: {
  label: string;
  value: number;
  max: number;
  colorClassName: string;
  valueLabel: string;
  icon?: ComponentType<{ className?: string }>;
  iconClassName?: string;
}) {
  // 0 bleibt wirklich leer — der 2%-Mindestbalken gilt nur für echte Werte.
  const pct = max > 0 && value > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1 truncate text-muted-foreground">
          {Icon ? <Icon className={cn("size-3.5 shrink-0", iconClassName)} aria-hidden /> : null}
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 font-medium tabular-nums text-foreground">{valueLabel}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-r-full", colorClassName)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Grosse Stat-Tile-Zahl: proportionale Ziffern (kein tabular-nums — das ist für Tabellenspalten). */
function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card size="sm">
      <CardContent className="px-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
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
  const openQuoteValue =
    data.quotePipeline.valueByStatus.draft +
    data.quotePipeline.valueByStatus.pending_approval +
    data.quotePipeline.valueByStatus.sent;
  const openQuoteCount =
    data.quotePipeline.countByStatus.draft +
    data.quotePipeline.countByStatus.pending_approval +
    data.quotePipeline.countByStatus.sent;
  // Ordinal-Rampe nur über die tatsächlich sichtbaren Pipeline-Status spreizen
  // (Statuswerte mit fixer Status-Bedeutung ausgenommen — siehe TERMINAL_PROJECT_STATUS_STYLE).
  const visiblePipelineStatuses = projectStatuses.filter(
    (s) => !TERMINAL_PROJECT_STATUS_STYLE[s] && (data.statusCounts[s] ?? 0) > 0,
  );

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

      {/* Vorherigen Stand gedimmt halten statt beim Refetch zu blitzen (kein Skeleton-Flash). */}
      <div className={cn("flex flex-col gap-6 transition-opacity", isFetching && "opacity-60")}>
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

      <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projekte</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-semibold">Projekte nach Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 px-4">
            {projectStatuses.map((status: ProjectStatus) => {
              const count = data.statusCounts[status] ?? 0;
              if (count === 0) return null;
              const terminal = TERMINAL_PROJECT_STATUS_STYLE[status];
              if (terminal) {
                return (
                  <Bar
                    key={status}
                    label={projectStatusLabels[status]}
                    value={count}
                    max={maxStatusCount}
                    valueLabel={String(count)}
                    colorClassName={terminal.barClassName}
                    icon={terminal.icon}
                    iconClassName={terminal.iconClassName}
                  />
                );
              }
              const index = visiblePipelineStatuses.indexOf(status);
              return (
                <Bar
                  key={status}
                  label={projectStatusLabels[status]}
                  value={count}
                  max={maxStatusCount}
                  valueLabel={String(count)}
                  colorClassName={ordinalRampClass(index, visiblePipelineStatuses.length)}
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
                colorClassName={AGE_BUCKET_BAR_COLORS[bucket]}
                icon={bucket === "90+" && count > 0 ? AlertTriangle : undefined}
                iconClassName="text-rose-600 dark:text-rose-400"
              />
            ))}
            {data.projectAge.totalOpen === 0 ? (
              <p className="text-xs text-muted-foreground">Keine offenen Projekte.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
      </div>

      <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Offerten und Rechnungen</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-semibold">Umsatz angenommener Offerten (6 Monate)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 px-4">
            {data.monthlyRevenue.every((p) => p.quoteCount === 0) ? (
              <p className="text-xs text-muted-foreground">
                Noch keine angenommenen Offerten im Zeitraum.{" "}
                <Link href="/projekte" prefetch={false} className="font-medium text-primary underline-offset-2 hover:underline">
                  Offerte im Projekt erstellen
                </Link>
              </p>
            ) : (
              data.monthlyRevenue.map((point) => (
                <Bar
                  key={point.monthKey}
                  label={monthLabel(point.monthKey)}
                  value={point.totalGross}
                  max={maxMonthlyRevenue}
                  valueLabel={point.quoteCount > 0 ? chf.format(point.totalGross) : "—"}
                  colorClassName={MEASURE_BAR_COLOR}
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
              <p className="text-xs text-muted-foreground">
                Noch keine Offerten erfasst.{" "}
                <Link href="/projekte" prefetch={false} className="font-medium text-primary underline-offset-2 hover:underline">
                  Offerte im Projekt erstellen
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-semibold">Offene Rechnungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 px-4">
            {data.openInvoices.openCount === 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                Alle Rechnungen sind bezahlt.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Offen (versendet)</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {data.openInvoices.openCount} · {chf.format(data.openInvoices.openTotalGross)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={cn(
                      "flex items-center gap-1",
                      data.openInvoices.overdueCount > 0
                        ? "font-medium text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {data.openInvoices.overdueCount > 0 ? (
                      <AlertTriangle className="size-3.5" aria-hidden />
                    ) : null}
                    Überfällig
                  </span>
                  <span className={cn("font-medium tabular-nums", data.openInvoices.overdueCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
                    {data.openInvoices.overdueCount} · {chf.format(data.openInvoices.overdueTotalGross)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </div>

      <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team und Einsätze</h2>
      <div className="grid gap-4 lg:grid-cols-2">
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
                  icon={CheckCircle2}
                  iconClassName="text-emerald-600 dark:text-emerald-400"
                />
                <Bar
                  label="Aufgenommen (Folgetermin nötig)"
                  value={data.reportOutcome.aufgenommenCount}
                  max={Math.max(1, data.reportOutcome.behobenCount, data.reportOutcome.aufgenommenCount)}
                  valueLabel={String(data.reportOutcome.aufgenommenCount)}
                  colorClassName="bg-amber-500"
                  icon={ClipboardList}
                  iconClassName="text-amber-600 dark:text-amber-400"
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
                  colorClassName={MEASURE_BAR_COLOR}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
      </div>
      </div>
    </section>
  );
}
