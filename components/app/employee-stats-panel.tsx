"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { EmployeeStat } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FileWarning,
  FolderKanban,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Referenz für eine Vollzeit-Woche (Planung), nicht rechtsverbindlich. */
const WEEK_TARGET_HOURS = 42;

type EmployeeStatsPanelProps = {
  stats: EmployeeStat[];
};

type ViewMode = "detail" | "compare";

function teamAverages(rows: EmployeeStat[]) {
  if (rows.length === 0) {
    return {
      offeneProjekte: 0,
      abgeschlosseneHeute: 0,
      offeneRapporte: 0,
      stundenDieseWoche: 0,
    };
  }
  const n = rows.length;
  return {
    offeneProjekte: rows.reduce((s, r) => s + r.offeneProjekte, 0) / n,
    abgeschlosseneHeute: rows.reduce((s, r) => s + r.abgeschlosseneHeute, 0) / n,
    offeneRapporte: rows.reduce((s, r) => s + r.offeneRapporte, 0) / n,
    stundenDieseWoche: rows.reduce((s, r) => s + r.stundenDieseWoche, 0) / n,
  };
}

function fmtDelta(current: number, avg: number, lowerIsBetter = false) {
  if (avg === 0 && current === 0) {
    return null;
  }
  const diff = current - avg;
  if (Math.abs(diff) < 0.05) {
    return { label: "≈ Team-Ø", tone: "muted" as const };
  }
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  return {
    label: `${diff > 0 ? "+" : ""}${diff.toFixed(1).replace(/\.0$/, "")} vs. Ø`,
    tone: better ? ("positive" as const) : ("neutral" as const),
  };
}

function footnoteOffene(
  d: ReturnType<typeof fmtDelta>,
  avg: number,
) {
  if (!d) {
    return `Team-Ø ${avg.toFixed(1)}.`;
  }
  if (d.tone === "muted") {
    return `Nahe Team-Ø (${avg.toFixed(1)}).`;
  }
  return d.tone === "positive"
    ? `Unter Team-Ø (${avg.toFixed(1)}).`
    : `Über Team-Ø (${avg.toFixed(1)}).`;
}

type KpiCardProps = {
  title: string;
  value: number;
  subtitle?: string;
  icon: ReactNode;
  footnote?: string;
  highlight?: "warning" | "success";
};

function KpiCard({ title, value, subtitle, icon, footnote, highlight }: KpiCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm transition-colors",
        highlight === "warning" && "border-amber-300/80 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-950/20",
        highlight === "success" && "border-emerald-300/60 bg-emerald-50/40 dark:border-emerald-500/40 dark:bg-emerald-950/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <span className="rounded-md bg-muted/80 p-1.5 text-muted-foreground [&_svg]:size-4">{icon}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      {footnote ? <p className="text-[11px] leading-snug text-muted-foreground">{footnote}</p> : null}
    </div>
  );
}

function HoursBar({ hours }: { hours: number }) {
  const pct = Math.min(100, Math.round((hours / WEEK_TARGET_HOURS) * 100));
  const over = hours > WEEK_TARGET_HOURS;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>Auslastung (gegen {WEEK_TARGET_HOURS} h Plan)</span>
        <span className={cn("tabular-nums", over && "font-medium text-amber-700 dark:text-amber-400")}>
          {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width]", over ? "bg-amber-500" : "bg-primary/80")}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

export function EmployeeStatsPanel({ stats }: EmployeeStatsPanelProps) {
  const [selectedId, setSelectedId] = useState(stats[0]?.profileId ?? "");
  const [mode, setMode] = useState<ViewMode>("detail");

  const selected = useMemo(
    () => stats.find((item) => item.profileId === selectedId) ?? stats[0],
    [selectedId, stats],
  );

  const avg = useMemo(() => teamAverages(stats), [stats]);

  if (!selected || stats.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Mitarbeiterdaten vorhanden.</p>;
  }

  const dOffen = fmtDelta(selected.offeneProjekte, avg.offeneProjekte, true);
  const dHeute = fmtDelta(selected.abgeschlosseneHeute, avg.abgeschlosseneHeute);
  const dRap = fmtDelta(selected.offeneRapporte, avg.offeneRapporte, true);
  const dStd = fmtDelta(selected.stundenDieseWoche, avg.stundenDieseWoche);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Mitarbeiter</span>
            <Select
              value={selected.profileId}
              onValueChange={(value) => {
                const id = String(value ?? "");
                if (id) {
                  setSelectedId(id);
                }
              }}
            >
              <SelectTrigger className="w-full min-w-[260px] sm:w-[min(100%,320px)]">
                <SelectValue
                  placeholder="Auswählen"
                  resolvedLabel={selected.profileId ? (stats.find((s) => s.profileId === selected.profileId)?.profileName ?? "") : ""}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Team</SelectLabel>
                  {stats.map((item) => (
                    <SelectItem key={item.profileId} value={item.profileId}>
                      {item.profileName}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Ansicht</span>
            <div className="flex rounded-lg border border-input bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setMode("detail")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === "detail"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Users className="size-3.5" />
                Detail
              </button>
              <button
                type="button"
                onClick={() => setMode("compare")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === "compare"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <BarChart3 className="size-3.5" />
                Team-Vergleich
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/projekte" />}>
            Projekte
            <ArrowRight className="size-3.5" />
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/rapporte" />}>
            Rapporte
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {mode === "detail" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Kontext</span>
            {selected.offeneRapporte > 0 ? (
              <Badge variant="destructive">Rapporte offen: {selected.offeneRapporte}</Badge>
            ) : (
              <Badge variant="secondary">Keine offenen Rapporte</Badge>
            )}
            {selected.stundenDieseWoche > WEEK_TARGET_HOURS ? (
              <Badge variant="outline" className="border-amber-400/80 text-amber-900 dark:text-amber-200">
                Woche über Plan ({WEEK_TARGET_HOURS} h)
              </Badge>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Offene Projekte"
              value={selected.offeneProjekte}
              icon={<FolderKanban />}
              footnote={footnoteOffene(dOffen, avg.offeneProjekte)}
              highlight={selected.offeneProjekte > avg.offeneProjekte * 1.2 ? "warning" : undefined}
            />
            <KpiCard
              title="Heute erledigt"
              value={selected.abgeschlosseneHeute}
              icon={<CheckCircle2 />}
              footnote={
                dHeute
                  ? `Team-Ø ${avg.abgeschlosseneHeute.toFixed(1)} · ${dHeute.label}`
                  : `Team-Ø ${avg.abgeschlosseneHeute.toFixed(1)}.`
              }
              highlight={selected.abgeschlosseneHeute > 0 ? "success" : undefined}
            />
            <KpiCard
              title="Rapporte offen"
              value={selected.offeneRapporte}
              icon={<FileWarning />}
              footnote={
                dRap
                  ? `Team-Ø ${avg.offeneRapporte.toFixed(1)} · ${dRap.label}`
                  : `Team-Ø ${avg.offeneRapporte.toFixed(1)}.`
              }
              highlight={selected.offeneRapporte > 0 ? "warning" : undefined}
            />
            <KpiCard
              title="Stunden Woche"
              value={selected.stundenDieseWoche}
              icon={<Clock />}
              footnote={
                dStd
                  ? `Team-Ø ${avg.stundenDieseWoche.toFixed(1)} h · ${dStd.label}`
                  : `Team-Ø ${avg.stundenDieseWoche.toFixed(1)} h.`
              }
            />
          </div>

          <div className="rounded-xl border bg-muted/20 px-4 py-3">
            <HoursBar hours={selected.stundenDieseWoche} />
          </div>
        </>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Mitarbeiter</th>
                  <th className="px-4 py-3 text-right tabular-nums">Offene Projekte</th>
                  <th className="px-4 py-3 text-right tabular-nums">Heute</th>
                  <th className="px-4 py-3 text-right tabular-nums">Rapporte</th>
                  <th className="px-4 py-3 text-right tabular-nums">Std. (Woche)</th>
                  <th className="min-w-[140px] px-4 py-3">Auslastung</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => {
                  const pct = Math.min(100, Math.round((row.stundenDieseWoche / WEEK_TARGET_HOURS) * 100));
                  const over = row.stundenDieseWoche > WEEK_TARGET_HOURS;
                  return (
                    <tr
                      key={row.profileId}
                      className={cn(
                        "border-b border-border/60 last:border-0",
                        row.profileId === selected.profileId && "bg-primary/5",
                      )}
                    >
                      <td className="px-4 py-3 font-medium">{row.profileName}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.offeneProjekte}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.abgeschlosseneHeute}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.offeneRapporte}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.stundenDieseWoche}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn("h-full rounded-full", over ? "bg-amber-500" : "bg-primary/75")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/30 font-medium">
                  <td className="px-4 py-3">Ø Team</td>
                  <td className="px-4 py-3 text-right tabular-nums">{avg.offeneProjekte.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{avg.abgeschlosseneHeute.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{avg.offeneRapporte.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{avg.stundenDieseWoche.toFixed(1)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Auslastung bezieht sich auf {WEEK_TARGET_HOURS} h als Wochenreferenz für die Planung (Montage &amp; Büro).
          </p>
        </>
      )}

      <Separator />

      <p className="text-xs text-muted-foreground">
        Die Daten stammen aus den periodischen Snapshots in{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">employee_metrics_snapshots</code>. Für
        Echtzeit-Zahlen Projekt- und Rapportlisten prüfen.
      </p>
    </div>
  );
}
