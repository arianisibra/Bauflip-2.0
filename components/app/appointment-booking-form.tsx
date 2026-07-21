"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BauflipLoadingButtonLabel, BauflipLoadingInline } from "@/components/ui/bauflip-loading";
import { useAddAppointment, useAvailabilityRange } from "@/lib/query/hooks";
import {
  taskAssignedTechnicianIds,
  technicianAbsenceKindLabels,
  type UserProfile,
  type WeekTaskItem,
  type TechnicianAbsence,
} from "@/lib/domain/types";
import { getSwissDayBounds } from "@/lib/date/week-bounds";
import { todayKeySwiss } from "@/lib/date/swiss";
import { resolveCalendarColor } from "@/lib/calendar/team-colors";
import { computeConflicts, conflictStatus, hasFerienConflict, type Conflict } from "@/lib/calendar/availability-conflicts";
import { AlertTriangle, CalendarOff, CheckCircle2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const TZ = "Europe/Zurich";

function localInputToIso(local: string): string | null {
  if (!local) return null;
  const t = Date.parse(local);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function fmtRange(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const day = s.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", timeZone: TZ });
  const fmt = (d: Date) =>
    d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  const dayE = e.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", timeZone: TZ });
  if (day === dayE) return `${day} · ${fmt(s)}–${fmt(e)}`;
  return `${day} ${fmt(s)} – ${dayE} ${fmt(e)}`;
}

const STRIPE_BG =
  "repeating-linear-gradient(45deg, rgba(244, 63, 94, 0.18) 0, rgba(244, 63, 94, 0.18) 6px, rgba(244, 63, 94, 0.32) 6px, rgba(244, 63, 94, 0.32) 12px)";

const PREVIEW_HOUR_FROM = 6;
const PREVIEW_HOUR_TO = 20;

function ymdKeyToReferenceDate(ymd: string): Date | null {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Eine Zeile 06–20 Uhr: Belegung des Monteurs am gewählten Kalendertag — Lücken = frei (ohne Arbeitszeit-Modell). */
function TechnicianDayPreviewStrip({
  technicianId,
  technicians,
  appointments,
  absences,
  dayStartMs,
  dayEndMs,
  dayLabel,
  isTodaySwiss,
  nowMs,
}: {
  technicianId: string;
  technicians: UserProfile[];
  appointments: WeekTaskItem[];
  absences: TechnicianAbsence[];
  dayStartMs: number;
  dayEndMs: number;
  dayLabel: string;
  isTodaySwiss: boolean;
  nowMs: number;
}) {
  const tech = technicians.find((t) => t.id === technicianId);
  const accent = resolveCalendarColor(tech?.calendarColor ?? null, technicianId);
  const hourMs = 60 * 60 * 1000;
  const railStartMs = dayStartMs + PREVIEW_HOUR_FROM * hourMs;
  const railEndMs = dayStartMs + PREVIEW_HOUR_TO * hourMs;
  const span = railEndMs - railStartMs;

  type Block =
    | { kind: "appointment"; key: string; task: WeekTaskItem; s: number; e: number }
    | { kind: "absence"; key: string; absence: TechnicianAbsence; s: number; e: number };

  const blocks: Block[] = [];
  for (const t of appointments) {
    if (!taskAssignedTechnicianIds(t).includes(technicianId)) continue;
    const s = Date.parse(t.startsAt);
    const e = Date.parse(t.endsAt);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    if (e <= dayStartMs || s >= dayEndMs) continue;
    blocks.push({ kind: "appointment", key: `a-${t.appointmentId}`, task: t, s, e });
  }
  for (const a of absences) {
    if (a.technicianId !== technicianId) continue;
    const s = Date.parse(a.startsAt);
    const e = Date.parse(a.endsAt);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    if (e <= dayStartMs || s >= dayEndMs) continue;
    blocks.push({ kind: "absence", key: `b-${a.id}`, absence: a, s, e });
  }
  blocks.sort((x, y) => x.s - y.s);

  const nowPct =
    isTodaySwiss && nowMs >= railStartMs && nowMs <= railEndMs
      ? Math.max(0, Math.min(100, ((nowMs - railStartMs) / span) * 100))
      : null;

  const hourLabels = Array.from({ length: PREVIEW_HOUR_TO - PREVIEW_HOUR_FROM + 1 }, (_, i) => PREVIEW_HOUR_FROM + i);

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-2 py-2 sm:px-2">
      <div className="mb-1.5 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold leading-snug text-foreground sm:text-[11px]">
          <span
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          {tech?.displayName ?? "Unbekannt"} · {dayLabel}
        </p>
        <p className="text-[10px] leading-snug text-muted-foreground sm:text-[10px]">
          {PREVIEW_HOUR_FROM}:00–{PREVIEW_HOUR_TO}:00 · Leer = frei
        </p>
        <p className="text-[10px] text-muted-foreground sm:hidden">Zum Scrollen die Zeitleiste horizontal wischen.</p>
      </div>
      <div
        className="-mx-0.5 overflow-x-auto overscroll-x-contain px-0.5 pb-0.5 [-webkit-overflow-scrolling:touch]"
        tabIndex={0}
        aria-label="Tages-Zeitleiste, horizontal scrollbar"
      >
        <div className="min-w-[340px] sm:min-w-0">
          <div className="relative mb-1 h-4 text-[10px] text-muted-foreground sm:h-3 sm:text-[9px]">
            {hourLabels.map((h, idx) => {
              const pct = (idx / (PREVIEW_HOUR_TO - PREVIEW_HOUR_FROM)) * 100;
              return (
                <span key={h} className="absolute -translate-x-1/2 select-none tabular-nums" style={{ left: `${pct}%` }}>
                  {String(h).padStart(2, "0")}
                </span>
              );
            })}
          </div>
          <div className="relative h-11 rounded-md border border-border/50 bg-background/80 sm:h-8">
        {nowPct != null ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary"
            style={{ left: `${nowPct}%` }}
            aria-hidden
          />
        ) : null}
        {blocks.map((b) => {
          const startClamped = Math.max(b.s, railStartMs);
          const endClamped = Math.min(b.e, railEndMs);
          if (endClamped <= startClamped) return null;
          const leftPct = ((startClamped - railStartMs) / span) * 100;
          const widthPct = Math.max(0.8, ((endClamped - startClamped) / span) * 100);
          if (b.kind === "appointment") {
            const t = b.task;
            const col = t.calendarColor || accent;
            const timeOnly = `${fmtRange(t.startsAt, t.endsAt)}`;
            return (
              <Link
                key={b.key}
                href={`/projekte?sheet=${t.projectId}`}
                prefetch={false}
                className="absolute top-1 bottom-1 flex min-h-[36px] min-w-[2px] items-center justify-center overflow-hidden rounded shadow-sm active:opacity-90 sm:top-0.5 sm:bottom-0.5 sm:min-h-0"
                style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: col }}
                title={timeOnly}
                aria-label={`Termin ${timeOnly}, Auftrag öffnen`}
              >
                <span className="sr-only">Termin {timeOnly}</span>
              </Link>
            );
          }
          const a = b.absence;
          const absLabel = `${technicianAbsenceKindLabels[a.kind]}, ${fmtRange(a.startsAt, a.endsAt)}`;
          return (
            <div
              key={b.key}
              role="img"
              className="absolute top-1 bottom-1 min-h-[36px] min-w-[2px] overflow-hidden rounded border border-rose-500/35 sm:top-0.5 sm:bottom-0.5 sm:min-h-0"
              style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundImage: STRIPE_BG }}
              title={absLabel}
              aria-label={`Abwesend: ${absLabel}`}
            />
          );
        })}
          </div>
        </div>
      </div>
      {blocks.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground sm:text-[10px]">
          Keine Termine und keine Abwesenheit an diesem Tag im Raster {PREVIEW_HOUR_FROM}–{PREVIEW_HOUR_TO} Uhr.
        </p>
      ) : null}
    </div>
  );
}

export function AppointmentBookingForm({
  projectId,
  technicians,
}: {
  projectId: string;
  technicians: UserProfile[];
}) {
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [endsAtLocal, setEndsAtLocal] = useState("");
  const [assignedTechnicianId, setAssignedTechnicianId] = useState("");
  const [assignedTechnicianId2, setAssignedTechnicianId2] = useState("");
  const [showSecondTechnician, setShowSecondTechnician] = useState(false);
  const [previewDayKey, setPreviewDayKey] = useState(() => todayKeySwiss());
  const [previewNowMs, setPreviewNowMs] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const addAppointment = useAddAppointment();

  const debouncedStartsAtLocal = useDebouncedValue(startsAtLocal, 300);
  const debouncedEndsAtLocal = useDebouncedValue(endsAtLocal, 300);

  const previewDayBounds = useMemo(() => {
    const ref = ymdKeyToReferenceDate(previewDayKey);
    if (!ref) return null;
    const { start, end } = getSwissDayBounds(ref);
    const buf = 24 * 60 * 60 * 1000;
    return {
      fetchStartIso: new Date(start.getTime() - buf).toISOString(),
      fetchEndIso: new Date(end.getTime() + buf).toISOString(),
      dayStartMs: start.getTime(),
      dayEndMs: end.getTime(),
    };
  }, [previewDayKey]);

  // Verfügbarkeit für ±1 Tag um die geplante Spanne herum laden — kleines, gecachtes Fenster.
  const availabilityRange = useMemo(() => {
    const startIso = localInputToIso(debouncedStartsAtLocal);
    const endIso = localInputToIso(debouncedEndsAtLocal);
    if (!startIso || !endIso) return null;
    const sMs = Date.parse(startIso);
    const eMs = Date.parse(endIso);
    if (!Number.isFinite(sMs) || !Number.isFinite(eMs) || eMs <= sMs) return null;
    const dayMs = 24 * 60 * 60 * 1000;
    return {
      startIso: new Date(sMs - dayMs).toISOString(),
      endIso: new Date(eMs + dayMs).toISOString(),
      slotStart: sMs,
      slotEnd: eMs,
    };
  }, [debouncedStartsAtLocal, debouncedEndsAtLocal]);

  const availabilityFetchRange = useMemo(() => {
    let minStart = Infinity;
    let maxEnd = -Infinity;

    if (assignedTechnicianId && previewDayBounds) {
      minStart = Math.min(minStart, Date.parse(previewDayBounds.fetchStartIso));
      maxEnd = Math.max(maxEnd, Date.parse(previewDayBounds.fetchEndIso));
    }
    if (availabilityRange) {
      minStart = Math.min(minStart, Date.parse(availabilityRange.startIso));
      maxEnd = Math.max(maxEnd, Date.parse(availabilityRange.endIso));
    }

    if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) return null;
    return {
      startIso: new Date(minStart).toISOString(),
      endIso: new Date(maxEnd).toISOString(),
    };
  }, [previewDayBounds, availabilityRange, assignedTechnicianId]);

  const { data: availabilityBundle, isFetching: availabilityPending } = useAvailabilityRange(
    availabilityFetchRange?.startIso ?? null,
    availabilityFetchRange?.endIso ?? null,
    Boolean(availabilityFetchRange),
  );

  // „Jetzt“-Linie in der Vorschau einmal pro Minute aktualisieren (Startwert kommt aus useState-Initializer).
  useEffect(() => {
    const id = window.setInterval(() => setPreviewNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const previewRefDate = useMemo(() => ymdKeyToReferenceDate(previewDayKey), [previewDayKey]);
  const isPreviewDayTodaySwiss = previewDayKey === todayKeySwiss(new Date(previewNowMs));

  const conflicts: Conflict[] = useMemo(
    () => computeConflicts(assignedTechnicianId, availabilityBundle, availabilityRange),
    [availabilityBundle, availabilityRange, assignedTechnicianId],
  );
  const conflicts2: Conflict[] = useMemo(
    () =>
      assignedTechnicianId2
        ? computeConflicts(assignedTechnicianId2, availabilityBundle, availabilityRange)
        : [],
    [availabilityBundle, availabilityRange, assignedTechnicianId2],
  );

  const formReady = Boolean(availabilityRange);
  const status = conflictStatus(formReady, assignedTechnicianId, conflicts);
  const status2 = conflictStatus(formReady, assignedTechnicianId2, conflicts2);
  const ferienBlocked = hasFerienConflict(conflicts) || hasFerienConflict(conflicts2);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const startIso = localInputToIso(startsAtLocal);
    const endIso = localInputToIso(endsAtLocal);
    if (!startIso || !endIso) {
      setError("Bitte Beginn und Ende ausfüllen.");
      return;
    }
    if (Date.parse(endIso) <= Date.parse(startIso)) {
      setError("Endzeit muss nach Beginn liegen.");
      return;
    }
    if (!assignedTechnicianId.trim()) {
      setError("Bitte eine zuständige Person wählen.");
      return;
    }
    if (assignedTechnicianId2 && assignedTechnicianId2 === assignedTechnicianId) {
      setError("Monteur 2 muss sich von Monteur 1 unterscheiden.");
      return;
    }
    if (ferienBlocked) {
      setError("Diese Person ist in diesem Zeitraum in den Ferien — Termin kann nicht gebucht werden.");
      return;
    }
    addAppointment.mutate(
      {
        projectId,
        kind: "ausfuehrung",
        startsAt: startIso,
        endsAt: endIso,
        assignedTechnicianId,
        assignedTechnicianId2: assignedTechnicianId2 || null,
      },
      {
        onError: (err) =>
          setError(err instanceof Error ? err.message : "Termin fehlgeschlagen."),
        onSuccess: () => {
          setStartsAtLocal("");
          setEndsAtLocal("");
          setAssignedTechnicianId("");
          setAssignedTechnicianId2("");
          setShowSecondTechnician(false);
        },
      },
    );
  };

  return (
    <form className="grid min-w-0 gap-3 sm:gap-2 sm:grid-cols-2" onSubmit={onSubmit}>
      <div className="min-w-0 space-y-1">
        <Label htmlFor="bookingStart">Beginn</Label>
        <Input
          id="bookingStart"
          name="startsAt"
          type="datetime-local"
          step={60}
          required
          value={startsAtLocal}
          className="min-h-11 text-base sm:min-h-10 sm:text-sm"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setStartsAtLocal(e.target.value);
            setError(null);
          }}
        />
      </div>
      <div className="min-w-0 space-y-1">
        <Label htmlFor="bookingEnd">Ende</Label>
        <Input
          id="bookingEnd"
          name="endsAt"
          type="datetime-local"
          step={60}
          required
          value={endsAtLocal}
          className="min-h-11 text-base sm:min-h-10 sm:text-sm"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setEndsAtLocal(e.target.value);
            setError(null);
          }}
        />
      </div>
      <div className="min-w-0 space-y-1">
        <Label htmlFor="bookingTechnician">Monteur 1 *</Label>
        <select
          id="bookingTechnician"
          name="assignedTechnicianId"
          required
          className="flex min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base sm:min-h-10 sm:text-sm"
          value={assignedTechnicianId}
          onChange={(e) => {
            const nextId = e.target.value;
            setAssignedTechnicianId(nextId);
            if (nextId && nextId === assignedTechnicianId2) setAssignedTechnicianId2("");
            setError(null);
          }}
        >
          <option value="">Bitte wählen …</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName}
            </option>
          ))}
        </select>
      </div>
      {showSecondTechnician ? (
        <div className="min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="bookingTechnician2">Monteur 2</Label>
            <button
              type="button"
              className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
              onClick={() => {
                setShowSecondTechnician(false);
                setAssignedTechnicianId2("");
              }}
            >
              Entfernen
            </button>
          </div>
          <select
            id="bookingTechnician2"
            name="assignedTechnicianId2"
            className="flex min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base sm:min-h-10 sm:text-sm"
            value={assignedTechnicianId2}
            onChange={(e) => {
              setAssignedTechnicianId2(e.target.value);
              setError(null);
            }}
          >
            <option value="">Bitte wählen …</option>
            {technicians
              .filter((t) => t.id !== assignedTechnicianId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
          </select>
        </div>
      ) : (
        <div className="flex min-w-0 items-end pb-0.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline sm:text-xs"
            onClick={() => setShowSecondTechnician(true)}
          >
            <Plus className="size-3.5 shrink-0" aria-hidden />
            Zweiten Monteur hinzufügen
          </button>
        </div>
      )}

      {assignedTechnicianId && previewDayBounds ? (
        <div className="min-w-0 space-y-2 sm:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="bookingPreviewDay" className="text-xs text-muted-foreground">
                Belegung an diesem Tag
              </Label>
              <Input
                id="bookingPreviewDay"
                type="date"
                className="h-11 w-full min-h-11 text-base sm:h-9 sm:min-h-9 sm:max-w-[11rem] sm:text-sm"
                value={previewDayKey}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const v = e.target.value;
                  if (v) setPreviewDayKey(v);
                }}
              />
            </div>
            <Link
              href="/kalender"
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-2 hover:underline sm:min-h-0 sm:pb-2 sm:text-[11px]"
            >
              Alle Monteure: Kalender → Verfügbarkeit
            </Link>
          </div>
          {availabilityPending && !availabilityBundle ? (
            <BauflipLoadingInline label="Tagesübersicht wird geladen …" />
          ) : availabilityBundle ? (
            <TechnicianDayPreviewStrip
              technicianId={assignedTechnicianId}
              technicians={technicians}
              appointments={availabilityBundle.appointments}
              absences={availabilityBundle.absences}
              dayStartMs={previewDayBounds.dayStartMs}
              dayEndMs={previewDayBounds.dayEndMs}
              dayLabel={
                previewRefDate
                  ? new Intl.DateTimeFormat("de-CH", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: TZ,
                    }).format(previewRefDate)
                  : previewDayKey
              }
              isTodaySwiss={isPreviewDayTodaySwiss}
              nowMs={previewNowMs}
            />
          ) : null}
          {assignedTechnicianId2 && availabilityBundle ? (
            <TechnicianDayPreviewStrip
              technicianId={assignedTechnicianId2}
              technicians={technicians}
              appointments={availabilityBundle.appointments}
              absences={availabilityBundle.absences}
              dayStartMs={previewDayBounds.dayStartMs}
              dayEndMs={previewDayBounds.dayEndMs}
              dayLabel={
                previewRefDate
                  ? new Intl.DateTimeFormat("de-CH", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: TZ,
                    }).format(previewRefDate)
                  : previewDayKey
              }
              isTodaySwiss={isPreviewDayTodaySwiss}
              nowMs={previewNowMs}
            />
          ) : null}
        </div>
      ) : null}

      {assignedTechnicianId && formReady ? (
        <div className="space-y-2 sm:col-span-2">
          <AvailabilityHint
            technicianName={
              assignedTechnicianId2
                ? technicians.find((t) => t.id === assignedTechnicianId)?.displayName
                : undefined
            }
            status={status}
            conflicts={conflicts}
            pending={availabilityPending}
          />
          {assignedTechnicianId2 ? (
            <AvailabilityHint
              technicianName={technicians.find((t) => t.id === assignedTechnicianId2)?.displayName}
              status={status2}
              conflicts={conflicts2}
              pending={availabilityPending}
            />
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-xs font-medium text-destructive sm:col-span-2">{error}</p>
      ) : null}

      <Button
        type="submit"
        size="sm"
        disabled={addAppointment.isPending || !assignedTechnicianId || !formReady || ferienBlocked}
        className="min-h-11 w-full sm:col-span-2 sm:min-h-10 sm:w-auto sm:justify-self-start"
      >
        {addAppointment.isPending ? (
          <BauflipLoadingButtonLabel variant="onPrimary">Speichern …</BauflipLoadingButtonLabel>
        ) : (
          "Termin speichern"
        )}
      </Button>
    </form>
  );
}

function AvailabilityHint({
  technicianName,
  status,
  conflicts,
  pending,
}: {
  /** Nur gesetzt, wenn zwei Monteure geprüft werden — sonst eindeutig ohne Label. */
  technicianName?: string;
  status: "idle" | "free" | "conflict" | "absence";
  conflicts: Conflict[];
  pending: boolean;
}) {
  if (status === "idle") return null;
  if (status === "free") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-900 sm:py-2 sm:text-xs dark:text-emerald-100">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 sm:size-4" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold">{technicianName ? `${technicianName}: Frei` : "Frei"}</p>
          <p className="break-words opacity-90">Keine Überschneidung im gewählten Zeitraum.</p>
          {pending ? <BauflipLoadingInline label="Prüfung läuft …" /> : null}
        </div>
      </div>
    );
  }
  const isAbsence = status === "absence";
  const blocksBooking = hasFerienConflict(conflicts);
  return (
    <div
      className={cn(
        "space-y-1.5 rounded-md border px-3 py-2.5 text-sm sm:py-2 sm:text-xs",
        isAbsence
          ? "border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-100"
          : "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100",
      )}
    >
      <div className="flex items-center gap-2 font-semibold">
        {isAbsence ? (
          <CalendarOff className="size-5 shrink-0 sm:size-4" aria-hidden />
        ) : (
          <AlertTriangle className="size-5 shrink-0 sm:size-4" aria-hidden />
        )}
        <span>
          {technicianName ? `${technicianName}: ` : ""}
          {blocksBooking
            ? "In den Ferien — Buchung nicht möglich"
            : isAbsence
              ? "Achtung: Abwesend"
              : "Überschneidung mit anderem Termin"}
        </span>
      </div>
      <ul className="space-y-1.5 pl-0 sm:pl-1">
        {conflicts.map((c, i) => {
          if (c.type === "appointment") {
            return (
              <li
                key={`a-${c.task.appointmentId}-${i}`}
                className="flex flex-col gap-0.5 break-words sm:flex-row sm:flex-wrap sm:items-center sm:gap-1"
              >
                <span className="font-medium">{fmtRange(c.task.startsAt, c.task.endsAt)}</span>
                <span className="hidden opacity-80 sm:inline">·</span>
                <Link
                  href={`/projekte?sheet=${c.task.projectId}`}
                  prefetch={false}
                  className="min-h-11 inline-flex items-center underline underline-offset-2 hover:no-underline sm:min-h-0"
                >
                  {c.task.projectTitle}
                </Link>
              </li>
            );
          }
          if (c.type === "external_busy") {
            return (
              <li key={`e-${i}`} className="flex flex-wrap items-center gap-1 break-words">
                <span className="font-semibold">Privater Kalender</span>
                <span>·</span>
                <span>{fmtRange(c.busy.startsAt, c.busy.endsAt)}</span>
                <span className="italic opacity-80">— belegt</span>
              </li>
            );
          }
          const a = c.absence;
          return (
            <li key={`b-${a.id}-${i}`} className="flex flex-wrap items-center gap-1 break-words">
              <span className="font-semibold">{technicianAbsenceKindLabels[a.kind]}</span>
              <span>·</span>
              <span>{fmtRange(a.startsAt, a.endsAt)}</span>
              {a.note ? <span className="italic opacity-80">— {a.note}</span> : null}
            </li>
          );
        })}
      </ul>
      <p className="pt-0.5 text-[11px] opacity-80">
        {blocksBooking
          ? "Termin kann in diesem Zeitraum nicht gespeichert werden."
          : "Speichern bleibt aktiv. Bei Bedarf kann der Termin trotzdem angelegt werden."}
      </p>
    </div>
  );
}
