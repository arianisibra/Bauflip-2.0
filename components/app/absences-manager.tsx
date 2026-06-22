"use client";

import { useEffect, useMemo, useState } from "react";
import { useAbsences, useAssignableProfiles, useCreateAbsence, useDeleteAbsence } from "@/lib/query/hooks";
import {
  technicianAbsenceKindLabels,
  technicianAbsenceKinds,
  type TechnicianAbsence,
  type TechnicianAbsenceKind,
  type UserProfile,
} from "@/lib/domain/types";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";

const TZ = "Europe/Zurich";

function isoToLocalDateTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayLocalDateTimeStart(): string {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
  return isoToLocalDateTimeInput(d.toISOString());
}

function todayLocalDateTimeEnd(): string {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  return isoToLocalDateTimeInput(d.toISOString());
}

function formatRange(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const sameDay =
    s.toLocaleDateString("de-CH", { timeZone: TZ }) === e.toLocaleDateString("de-CH", { timeZone: TZ });
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  if (sameDay) return `${fmtDate(s)} · ${fmtTime(s)}–${fmtTime(e)}`;
  return `${fmtDate(s)} ${fmtTime(s)} – ${fmtDate(e)} ${fmtTime(e)}`;
}

function kindBadgeClass(kind: TechnicianAbsenceKind): string {
  if (kind === "ferien") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100";
  }
  if (kind === "krank") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-100";
  }
  return "border-zinc-500/30 bg-zinc-500/10 text-zinc-800 dark:text-zinc-100";
}

export function AbsencesManager() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: absences = [] } = useAbsences(open);
  const { data: technicians = [] } = useAssignableProfiles(open);
  const [techId, setTechId] = useState<string>("");
  const [kind, setKind] = useState<TechnicianAbsenceKind>("ferien");
  const [startsAt, setStartsAt] = useState<string>(() => todayLocalDateTimeStart());
  const [endsAt, setEndsAt] = useState<string>(() => todayLocalDateTimeEnd());
  const [note, setNote] = useState<string>("");

  const create = useCreateAbsence();
  const remove = useDeleteAbsence();

  useEffect(() => {
    if (open && technicians.length > 0 && !techId) {
      setTechId(technicians[0]!.id);
    }
  }, [open, technicians, techId]);

  const techMap = useMemo(() => {
    const m = new Map<string, UserProfile>();
    for (const t of technicians) m.set(t.id, t);
    return m;
  }, [technicians]);

  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { upcoming, past } = useMemo(() => {
    const sorted = [...absences].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const up: TechnicianAbsence[] = [];
    const ps: TechnicianAbsence[] = [];
    for (const a of sorted) {
      if (nowMs === 0 || new Date(a.endsAt).getTime() >= nowMs) up.push(a);
      else ps.push(a);
    }
    ps.reverse();
    return { upcoming: up, past: ps };
  }, [absences, nowMs]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!techId) {
      setError("Bitte Person wählen.");
      return;
    }
    const startIso = new Date(startsAt).toISOString();
    const endIso = new Date(endsAt).toISOString();
    if (!Number.isFinite(Date.parse(startIso)) || !Number.isFinite(Date.parse(endIso))) {
      setError("Ungültiges Datum.");
      return;
    }
    if (Date.parse(endIso) <= Date.parse(startIso)) {
      setError("Endzeit muss nach Beginn liegen.");
      return;
    }
    create.mutate(
      {
        technicianId: techId,
        startsAt: startIso,
        endsAt: endIso,
        kind,
        note: note.trim() ? note.trim() : null,
      },
      {
        onSuccess: () => {
          setStartsAt(todayLocalDateTimeStart());
          setEndsAt(todayLocalDateTimeEnd());
          setKind("ferien");
          setNote("");
        },
        onError: (err) => setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen."),
      },
    );
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">Abwesenheiten</p>
          <p className="text-xs text-muted-foreground">
            Ferien, krank oder Blocker — werden in der Verfügbarkeit berücksichtigt.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setOpen(true)} className="shrink-0">
          <CalendarOff className="size-4" aria-hidden />
          Verwalten
        </Button>
      </div>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Abwesenheiten"
        description="Pflegen Sie Ferien, Krank-Tage oder Blocker. Sie sperren die Verfügbarkeit für die gewählte Person."
      >
        <div className="flex flex-col gap-6">
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="absenceTech" className="text-xs font-medium">
                Person
              </Label>
              <select
                id="absenceTech"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={techId}
                onChange={(e) => setTechId(e.target.value)}
              >
                {technicians.length === 0 ? <option value="">—</option> : null}
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="absenceStart" className="text-xs font-medium">
                Beginn
              </Label>
              <Input
                id="absenceStart"
                type="datetime-local"
                step={60}
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="absenceEnd" className="text-xs font-medium">
                Ende
              </Label>
              <Input
                id="absenceEnd"
                type="datetime-local"
                step={60}
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="absenceKind" className="text-xs font-medium">
                Art
              </Label>
              <select
                id="absenceKind"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as TechnicianAbsenceKind)}
              >
                {technicianAbsenceKinds.map((k) => (
                  <option key={k} value={k}>
                    {technicianAbsenceKindLabels[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="absenceNote" className="text-xs font-medium">
                Notiz (optional)
              </Label>
              <Textarea
                id="absenceNote"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="z. B. Skiwoche Davos"
              />
            </div>
            {error ? (
              <p className="text-xs font-medium text-destructive sm:col-span-2">{error}</p>
            ) : null}
            <div className="sm:col-span-2">
              <Button type="submit" size="sm" disabled={create.isPending}>
                {create.isPending ? (
                  <BauflipLoadingButtonLabel variant="onPrimary">Speichern …</BauflipLoadingButtonLabel>
                ) : (
                  <>
                    <Plus className="size-4" aria-hidden />
                    Abwesenheit hinzufügen
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="space-y-3">
            <AbsenceList
              title="Bevorstehend / aktuell"
              absences={upcoming}
              techMap={techMap}
              onDelete={(id) => remove.mutate({ absenceId: id })}
              deletingId={remove.isPending ? remove.variables?.absenceId : undefined}
            />
            <AbsenceList
              title="Vergangen"
              absences={past}
              techMap={techMap}
              onDelete={(id) => remove.mutate({ absenceId: id })}
              deletingId={remove.isPending ? remove.variables?.absenceId : undefined}
              dimmed
            />
          </div>
        </div>
      </Sheet>
    </>
  );
}

function AbsenceList({
  title,
  absences,
  techMap,
  onDelete,
  deletingId,
  dimmed,
}: {
  title: string;
  absences: TechnicianAbsence[];
  techMap: Map<string, UserProfile>;
  onDelete: (id: string) => void;
  deletingId?: string;
  dimmed?: boolean;
}) {
  if (absences.length === 0) {
    return (
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="rounded-md border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground">
          Keine Einträge.
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className={cn("space-y-1.5", dimmed && "opacity-70")}>
        {absences.map((a) => {
          const t = techMap.get(a.technicianId);
          const name = a.technicianName ?? t?.displayName ?? "Unbekannt";
          const isDeleting = deletingId === a.id;
          return (
            <li
              key={a.id}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-card px-3 py-2 shadow-sm"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                  <span>{name}</span>
                  <Badge variant="outline" className={cn("text-[10px]", kindBadgeClass(a.kind))}>
                    {technicianAbsenceKindLabels[a.kind]}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">{formatRange(a.startsAt, a.endsAt)}</p>
                {a.note ? (
                  <p className="text-[11px] italic text-muted-foreground/90">{a.note}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Abwesenheit löschen — ${name}, ${formatRange(a.startsAt, a.endsAt)}`}
                disabled={isDeleting}
                onClick={() => {
                  if (window.confirm("Diese Abwesenheit wirklich löschen?")) {
                    onDelete(a.id);
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
