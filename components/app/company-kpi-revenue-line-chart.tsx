"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { getRevenueSeriesAction } from "@/app/(app)/dashboard-actions";
import type { ApprovedRevenueSeries, RevenueSeriesPoint } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { cn } from "@/lib/utils";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function rangeAfterMonths(months: number): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function chfShort(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `CHF ${(n / 1_000_000).toLocaleString("de-CH", { maximumFractionDigits: 1 })} Mio.`;
  }
  if (abs >= 10_000) {
    return `CHF ${(n / 1000).toLocaleString("de-CH", { maximumFractionDigits: 0 })}k`;
  }
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(n);
}

type Preset = "1m" | "3m" | "6m" | "12m" | "custom";

/** Erstes Raster ~ceil(n/6); letzter Datenpunkt ergänzen, wenn noch nicht enthalten. */
function xLabelIndices(n: number, desiredTicks = 6): number[] {
  if (n <= 0) {
    return [];
  }
  if (n === 1) {
    return [0];
  }
  const step = Math.max(1, Math.ceil(n / desiredTicks));
  const out: number[] = [];
  for (let i = 0; i < n; i += step) {
    out.push(i);
  }
  const last = n - 1;
  if (out[out.length - 1] === last) {
    return out;
  }
  const prev = out[out.length - 1];
  if (last - prev <= 1) {
    out[out.length - 1] = last;
    return out;
  }
  out.push(last);
  return out;
}

/**
 * Verhindert überlappende Datums-Labels: Mindestabstand in ViewBox-Px.
 * Liegt der letzte Punkt zu nah am vorherigen Tick, wird der vordere Tick durch das Enddatum ersetzt.
 */
function pruneLabelIndicesByGap(
  indices: number[],
  coords: { x: number }[],
  n: number,
  minGapPx: number,
): number[] {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const out: number[] = [];
  for (const idx of sorted) {
    if (out.length === 0) {
      out.push(idx);
      continue;
    }
    const prev = out[out.length - 1]!;
    const gap = coords[idx]!.x - coords[prev]!.x;
    if (gap >= minGapPx) {
      out.push(idx);
      continue;
    }
    if (idx === n - 1) {
      out[out.length - 1] = idx;
    }
  }
  return out;
}

function RevenueLineSvg({ points }: { points: RevenueSeriesPoint[] }) {
  const gradId = useId().replace(/:/g, "");
  /** Breites ViewBox — Skalierung über äußeren Aspect-Ratio-Wrapper, damit die volle Kartenbreite genutzt wird. */
  const w = 556;
  const h = 168;
  const padL = 44;
  /** Genug Platz für «März 26» am letzten Punkt (mittig würde nach rechts überstehen). */
  const padR = 52;
  const padT = 14;
  const padB = 34;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const amounts = points.map((p) => p.amountChf);
  const dataMax = Math.max(...amounts, 0);
  const maxY = dataMax <= 0 ? 1 : dataMax * 1.12;
  const n = points.length;

  const coords = points.map((p, i) => {
    const x = padL + (n <= 1 ? innerW / 2 : (i / Math.max(n - 1, 1)) * innerW);
    const y = padT + innerH - (p.amountChf / maxY) * innerH;
    return { x, y, p };
  });

  const lineD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];
  const areaD =
    first && last
      ? `${lineD} L ${last.x} ${padT + innerH} L ${first.x} ${padT + innerH} Z`
      : "";

  const gridYs = [0, 0.33, 0.66, 1].map((t) => padT + innerH * (1 - t));
  /** ~9 Zeichen «DD. Mon» + middle/end-Anker → großzügiger Mindestabstand in ViewBox-Einheiten */
  const labelIdx = new Set(pruneLabelIndicesByGap(xLabelIndices(n, 6), coords, n, 58));

  return (
    <svg
      className="block h-full w-full max-w-full overflow-visible"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
        </linearGradient>
      </defs>

      <text
        x={padL - 4}
        y={padT + 6}
        textAnchor="end"
        className="fill-muted-foreground text-xs font-normal tabular-nums"
      >
        {dataMax <= 0 ? "CHF 0" : chfShort(maxY)}
      </text>
      <text
        x={padL - 4}
        y={padT + innerH + 2}
        textAnchor="end"
        className="fill-muted-foreground/80 text-xs font-normal tabular-nums"
      >
        {chfShort(0)}
      </text>

      {gridYs.map((gy, i) => (
        <line
          key={i}
          x1={padL}
          y1={gy}
          x2={w - padR}
          y2={gy}
          className="stroke-border/40"
          strokeWidth={i === gridYs.length - 1 ? 1 : 0.75}
          strokeDasharray={i === gridYs.length - 1 ? undefined : "2 3"}
        />
      ))}

      {areaD ? <path d={areaD} fill={`url(#${gradId})`} /> : null}
      {lineD ? (
        <path
          d={lineD}
          fill="none"
          className="stroke-primary"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {coords.map((c) => (
        <circle key={c.p.key} cx={c.x} cy={c.y} r={2.25} className="fill-primary/90" />
      ))}

      {coords.map((c, i) =>
        labelIdx.has(i) ? (
          <text
            key={`lbl-${c.p.key}`}
            x={c.x}
            y={h - 6}
            textAnchor={n <= 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            className="fill-muted-foreground text-xs font-normal leading-none"
          >
            {c.p.labelShort.replace(/\.$/, "")}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function CompanyKpiRevenueLineChart() {
  const [preset, setPreset] = useState<Preset>("6m");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [series, setSeries] = useState<ApprovedRevenueSeries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (from: Date, to: Date) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRevenueSeriesAction(formatDateInput(from), formatDateInput(to));
      setSeries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Daten konnten nicht geladen werden.");
      setSeries(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { from, to } = rangeAfterMonths(6);
    setCustomFrom(formatDateInput(from));
    setCustomTo(formatDateInput(to));
    void load(from, to);
  }, [load]);

  const applyPreset = (months: number) => {
    setPreset(`${months}m` as Preset);
    const { from, to } = rangeAfterMonths(months);
    setCustomFrom(formatDateInput(from));
    setCustomTo(formatDateInput(to));
    void load(from, to);
  };

  const applyCustom = () => {
    setPreset("custom");
    const [y1, m1, d1] = customFrom.split("-").map(Number);
    const [y2, m2, d2] = customTo.split("-").map(Number);
    const from = new Date(y1!, m1! - 1, d1!);
    const to = new Date(y2!, m2! - 1, d2!);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      setError("Bitte gültige Daten wählen.");
      return;
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    if (from > to) {
      setError("Start muss vor Ende liegen.");
      return;
    }
    void load(from, to);
  };

  const points = series?.points ?? [];

  return (
    <div
      className="rounded-lg border border-border/60 bg-muted/10 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.08]"
      role="region"
      aria-label="Umsatz Liniendiagramm"
    >
      <div className="border-b border-border/50 bg-muted/25 px-2.5 py-2 sm:px-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Umsatz</h3>
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["1 M", 1],
                ["3 M", 3],
                ["6 M", 6],
                ["12 M", 12],
              ] as const
            ).map(([label, months]) => (
              <button
                key={label}
                type="button"
                onClick={() => applyPreset(months)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  preset === `${months}m`
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-background/80 text-muted-foreground ring-1 ring-border/80 hover:bg-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-1 flex-wrap items-end gap-2 sm:gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Label htmlFor="rev-from" className="text-xs font-medium text-muted-foreground">
                Von
              </Label>
              <Input
                id="rev-from"
                type="date"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  setPreset("custom");
                }}
                className="h-8 max-w-[11rem] text-sm"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <Label htmlFor="rev-to" className="text-xs font-medium text-muted-foreground">
                Bis
              </Label>
              <Input
                id="rev-to"
                type="date"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  setPreset("custom");
                }}
                className="h-8 max-w-[11rem] text-sm"
              />
            </div>
            <Button type="button" size="sm" variant="secondary" className="h-8 shrink-0 text-xs" onClick={applyCustom}>
              Anwenden
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-muted/15 to-transparent px-2 pb-2 pt-1.5 sm:px-2.5">
        {error ? <p className="px-1 py-2 text-center text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <div className="flex min-h-[168px] items-center justify-center py-5">
            <BauflipLoading label="Daten werden geladen …" size="sm" />
          </div>
        ) : points.length === 0 ? (
          <div className="flex min-h-[168px] items-center justify-center">
            <p className="text-sm text-muted-foreground">Keine Daten im Zeitraum</p>
          </div>
        ) : (
          <div className="rounded-lg bg-background/60 px-1.5 py-1 ring-1 ring-border/30">
            {/* Aspect-Ratio + overflow-visible, damit X-Achsen-Labels am Rand nicht abgeschnitten werden. */}
            <div
              className="w-full max-w-full overflow-visible"
              style={{ aspectRatio: `${556} / ${168}` }}
            >
              <RevenueLineSvg points={points} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
