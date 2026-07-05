"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  taskAssignedTechnicianIds,
  technicianAbsenceKindLabels,
  type TechnicianAbsence,
  type UserProfile,
  type WeekTaskItem,
} from "@/lib/domain/types";
import { useAvailabilityRange } from "@/lib/query/hooks";
import { resolveCalendarColor } from "@/lib/calendar/team-colors";
import { BauflipLoadingInline } from "@/components/ui/bauflip-loading";

const TZ = "Europe/Zurich";

type RailBlock =
  | {
      kind: "appointment";
      key: string;
      task: WeekTaskItem;
      startMs: number;
      endMs: number;
    }
  | {
      kind: "absence";
      key: string;
      absence: TechnicianAbsence;
      startMs: number;
      endMs: number;
    };

function startOfSwissDayMs(year: number, month: number, day: number): number {
  // Build local "YYYY-MM-DDT00:00" then trust the runtime; for accuracy we want the
  // Swiss-local midnight. We approximate with a Date that has wall-clock 00:00 in
  // Europe/Zurich by formatting and parsing — but Date constructor uses runtime TZ.
  // Since the rail is purely visual, we use the runtime's local 00:00 of the same day.
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

function fmtDayLong(year: number, month: number, day: number): string {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(year, month - 1, day, 12, 0, 0));
}

/** Sortier­hilfe: zuerst nach calendar_position, dann Name. */
function sortTechnicians(list: UserProfile[]): UserProfile[] {
  return [...list].sort((a, b) => {
    const ap = a.calendarPosition ?? 0;
    const bp = b.calendarPosition ?? 0;
    if (ap !== bp) return ap - bp;
    return a.displayName.localeCompare(b.displayName, "de-CH");
  });
}

const STRIPE_BG =
  "repeating-linear-gradient(45deg, rgba(244, 63, 94, 0.18) 0, rgba(244, 63, 94, 0.18) 6px, rgba(244, 63, 94, 0.32) 6px, rgba(244, 63, 94, 0.32) 12px)";

export function CalendarAvailabilityRail({
  year,
  month,
  day,
  hourFrom = 6,
  hourTo = 20,
  onOpenProject,
  onProjectHover,
}: {
  year: number;
  month: number;
  day: number;
  hourFrom?: number;
  hourTo?: number;
  onOpenProject?: (projectId: string) => void;
  onProjectHover?: (projectId: string) => void;
}) {
  // Lade ±1 Tag um den gewählten Tag, damit lange Abwesenheiten an Rändern korrekt angeschnitten werden.
  const range = useMemo(() => {
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);
    const dayMs = 24 * 60 * 60 * 1000;
    return {
      fetchStartIso: new Date(start.getTime() - dayMs).toISOString(),
      fetchEndIso: new Date(end.getTime() + dayMs).toISOString(),
      dayStartMs: start.getTime(),
      dayEndMs: end.getTime(),
    };
  }, [year, month, day]);

  const { data, isFetching } = useAvailabilityRange(range.fetchStartIso, range.fetchEndIso);
  const technicians = useMemo(() => sortTechnicians(data?.technicians ?? []), [data?.technicians]);

  const hourSpan = Math.max(1, hourTo - hourFrom);
  const dayHourMs = 60 * 60 * 1000;
  const railStartMs = startOfSwissDayMs(year, month, day) + hourFrom * dayHourMs;
  const railEndMs = startOfSwissDayMs(year, month, day) + hourTo * dayHourMs;
  const railSpanMs = railEndMs - railStartMs;

  const blocksByTech = useMemo(() => {
    const appointments = data?.appointments ?? [];
    const absences = data?.absences ?? [];
    const map = new Map<string, RailBlock[]>();
    for (const t of appointments) {
      const technicianIds = taskAssignedTechnicianIds(t);
      if (technicianIds.length === 0) continue;
      const startMs = Date.parse(t.startsAt);
      const endMs = Date.parse(t.endsAt);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
      if (endMs <= range.dayStartMs || startMs >= range.dayEndMs) continue;
      for (const technicianId of technicianIds) {
        const list = map.get(technicianId) ?? [];
        list.push({
          kind: "appointment",
          key: `a-${t.appointmentId}`,
          task: t,
          startMs,
          endMs,
        });
        map.set(technicianId, list);
      }
    }
    for (const a of absences) {
      const startMs = Date.parse(a.startsAt);
      const endMs = Date.parse(a.endsAt);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
      if (endMs <= range.dayStartMs || startMs >= range.dayEndMs) continue;
      const list = map.get(a.technicianId) ?? [];
      list.push({
        kind: "absence",
        key: `b-${a.id}`,
        absence: a,
        startMs,
        endMs,
      });
      map.set(a.technicianId, list);
    }
    for (const list of map.values()) {
      list.sort((x, y) => x.startMs - y.startMs);
    }
    return map;
  }, [data?.appointments, data?.absences, range.dayStartMs, range.dayEndMs]);

  // Tick für „Jetzt“-Linie nur am aktuellen Tag.
  const [now, setNow] = useState<number>(0);
  useEffect(() => {
    setNow(Date.now());
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  const todayMidnight = useMemo(() => {
    if (!now) return 0;
    const t = new Date(now);
    return new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  }, [now]);
  const railIsToday = todayMidnight === startOfSwissDayMs(year, month, day);
  const nowPct = railIsToday ? Math.max(0, Math.min(100, ((now - railStartMs) / railSpanMs) * 100)) : null;

  const hourLabels = Array.from({ length: hourSpan + 1 }, (_, i) => hourFrom + i);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
      aria-label="Verfügbarkeit aller Monteure"
    >
      <div className="flex flex-col gap-2 border-b border-border/50 bg-muted/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Verfügbarkeit
          </p>
          <h3 className="text-base font-semibold leading-snug text-foreground sm:text-lg">
            {fmtDayLong(year, month, day)}
          </h3>
        </div>
        {isFetching ? <BauflipLoadingInline label="Wird geladen …" /> : null}
      </div>

      <p className="px-3 py-1.5 text-[10px] leading-snug text-muted-foreground sm:hidden">
        Tabelle horizontal wischen, um alle Stunden zu sehen.
      </p>

      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <div className="min-w-[36rem] sm:min-w-0">
          {/* Stunden-Header */}
          <div
            className="grid items-end border-b border-border/40 bg-muted/15 px-3 py-2 text-[10px] font-medium text-muted-foreground sm:px-4 sm:py-1.5"
            style={{ gridTemplateColumns: "minmax(8rem,11rem) 1fr" }}
          >
            <div />
            <div className="relative h-5 sm:h-4">
              {hourLabels.map((h, idx) => {
                const pct = (idx / hourSpan) * 100;
                return (
                  <span
                    key={h}
                    className="absolute -translate-x-1/2 select-none tabular-nums"
                    style={{ left: `${pct}%` }}
                  >
                    {String(h).padStart(2, "0")}
                  </span>
                );
              })}
            </div>
          </div>

          <ul className="divide-y divide-border/40">
            {technicians.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground sm:px-4">Keine Personen.</li>
            ) : null}
            {technicians.map((t) => {
              const blocks = blocksByTech.get(t.id) ?? [];
              const accent = resolveCalendarColor(t.calendarColor, t.id);
              const initials = t.displayName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? "")
                .join("");
              return (
                <li
                  key={t.id}
                  className="grid items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-2"
                  style={{ gridTemplateColumns: "minmax(8rem,11rem) 1fr" }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white sm:size-6"
                      style={{ backgroundColor: accent }}
                    >
                      {initials || "?"}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground" title={t.displayName}>
                      {t.displayName}
                    </span>
                  </div>

                  <RailRow
                    blocks={blocks}
                    railStartMs={railStartMs}
                    railEndMs={railEndMs}
                    accent={accent}
                    nowPct={nowPct}
                    onOpenProject={onOpenProject}
                    onProjectHover={onProjectHover}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function RailRow({
  blocks,
  railStartMs,
  railEndMs,
  accent,
  nowPct,
  onOpenProject,
  onProjectHover,
}: {
  blocks: RailBlock[];
  railStartMs: number;
  railEndMs: number;
  accent: string;
  nowPct: number | null;
  onOpenProject?: (projectId: string) => void;
  onProjectHover?: (projectId: string) => void;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const span = railEndMs - railStartMs;

  return (
    <div
      ref={railRef}
      className="relative h-11 rounded-lg border border-border/40 bg-muted/30 sm:h-9"
    >
      {/* Stunden-Trennlinien */}
      {Array.from({ length: Math.max(0, Math.round((railEndMs - railStartMs) / (60 * 60 * 1000)) - 1) }, (_, i) => {
        const pct = ((i + 1) * 100) / ((railEndMs - railStartMs) / (60 * 60 * 1000));
        return (
          <div
            key={i}
            className="pointer-events-none absolute inset-y-1 w-px bg-border/30"
            style={{ left: `${pct}%` }}
            aria-hidden
          />
        );
      })}

      {nowPct != null ? (
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary/80"
          style={{ left: `${nowPct}%` }}
          aria-label="Jetzt"
        />
      ) : null}

      {blocks.map((b) => {
        const startClamped = Math.max(b.startMs, railStartMs);
        const endClamped = Math.min(b.endMs, railEndMs);
        if (endClamped <= startClamped) return null;
        const leftPct = ((startClamped - railStartMs) / span) * 100;
        const widthPct = Math.max(1.2, ((endClamped - startClamped) / span) * 100);
        if (b.kind === "appointment") {
          const t = b.task;
          // Immer die Farbe DIESER Zeile (Row-Monteur) verwenden — bei zwei Monteuren pro
          // Termin trägt `t.calendarColor` nur die Farbe von Monteur 1.
          const colour = accent;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => onOpenProject?.(t.projectId)}
              onMouseEnter={() => onProjectHover?.(t.projectId)}
              onFocus={() => onProjectHover?.(t.projectId)}
              className="absolute top-1 bottom-1 flex min-h-[36px] items-center justify-center overflow-hidden rounded-md border border-foreground/10 shadow-sm transition-shadow hover:shadow-md active:opacity-90 sm:min-h-0"
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                backgroundColor: colour,
              }}
              title={`${fmtTime(t.startsAt)}–${fmtTime(t.endsAt)}`}
              aria-label={`Termin ${fmtTime(t.startsAt)} bis ${fmtTime(t.endsAt)}, Auftrag öffnen`}
            >
              <span className="sr-only">
                Termin {fmtTime(t.startsAt)}–{fmtTime(t.endsAt)}
              </span>
            </button>
          );
        }
        const a = b.absence;
        const label = `${technicianAbsenceKindLabels[a.kind]} · ${fmtTime(a.startsAt)}–${fmtTime(a.endsAt)}${a.note ? ` (${a.note})` : ""}`;
        return (
          <div
            key={b.key}
            role="img"
            className="absolute top-1 bottom-1 overflow-hidden rounded-md border border-rose-500/40 shadow-sm"
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              backgroundImage: STRIPE_BG,
            }}
            title={label}
            aria-label={label}
          />
        );
      })}
    </div>
  );
}
