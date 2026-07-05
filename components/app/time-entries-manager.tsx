"use client";

import { useMemo, useState } from "react";
import {
  useCreateTimeEntry,
  useDeleteTimeEntry,
  useMyTimeEntries,
  useUpdateTimeEntry,
} from "@/lib/query/hooks";
import type { TimeEntry } from "@/lib/domain/types";
import { todayKeySwiss } from "@/lib/date/swiss";
import { swissWeekDays, swissWeekReferenceIsoFromDayKey } from "@/lib/date/swiss-week";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

function currentWeekRange(): { start: string; end: string } {
  const dayKey = todayKeySwiss();
  const monRef = swissWeekReferenceIsoFromDayKey(dayKey);
  const days = swissWeekDays(monRef);
  return { start: days[0]!.key, end: days[6]!.key };
}

function computeHoursFromTimes(startsAt: string, endsAt: string): number | null {
  if (!startsAt || !endsAt) return null;
  const [sh, sm] = startsAt.split(":").map(Number);
  const [eh, em] = endsAt.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => !Number.isFinite(n))) return null;
  const diffMinutes = eh * 60 + em - (sh * 60 + sm);
  if (diffMinutes <= 0) return null;
  return Math.round((diffMinutes / 60) * 100) / 100;
}

function formatDateDe(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function TimeEntriesManager() {
  const [{ start: rangeStart, end: rangeEnd }, setRange] = useState(() => currentWeekRange());
  const { data: entries = [], isFetching } = useMyTimeEntries(rangeStart, rangeEnd);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(() => todayKeySwiss());
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [endsAtLocal, setEndsAtLocal] = useState("");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useCreateTimeEntry();
  const update = useUpdateTimeEntry();
  const remove = useDeleteTimeEntry();
  const saving = create.isPending || update.isPending;

  const computedHours = computeHoursFromTimes(startsAtLocal, endsAtLocal);
  const effectiveHoursLabel = computedHours != null ? String(computedHours) : hours;

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.entryDate.localeCompare(a.entryDate)),
    [entries],
  );

  const resetForm = () => {
    setEditingId(null);
    setEntryDate(todayKeySwiss());
    setStartsAtLocal("");
    setEndsAtLocal("");
    setHours("");
    setNote("");
  };

  const startEdit = (entry: TimeEntry) => {
    setEditingId(entry.id);
    setEntryDate(entry.entryDate);
    setStartsAtLocal(entry.startsAt ?? "");
    setEndsAtLocal(entry.endsAt ?? "");
    setHours(String(entry.hours));
    setNote(entry.note ?? "");
    setError(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const finalHours = computedHours ?? Number(hours.replace(",", "."));
    if (!Number.isFinite(finalHours) || finalHours <= 0) {
      setError("Bitte Stunden angeben (oder Von/Bis ausfüllen).");
      return;
    }
    const payload = {
      entryDate,
      startsAt: startsAtLocal || null,
      endsAt: endsAtLocal || null,
      hours: finalHours,
      note: note.trim() ? note.trim() : null,
    };
    const onSuccess = () => resetForm();
    const onError = (err: unknown) =>
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");

    if (editingId) {
      update.mutate({ id: editingId, ...payload }, { onSuccess, onError });
    } else {
      create.mutate(payload, { onSuccess, onError });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2">
        <p className="text-sm font-semibold text-foreground sm:col-span-2">
          {editingId ? "Eintrag bearbeiten" : "Neuer Eintrag"}
        </p>
        <div className="space-y-1">
          <Label htmlFor="timeEntryDate" className="text-xs font-medium">
            Datum
          </Label>
          <Input
            id="timeEntryDate"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
            className="h-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="timeEntryStart" className="text-xs font-medium">
              Von
            </Label>
            <Input
              id="timeEntryStart"
              type="time"
              value={startsAtLocal}
              onChange={(e) => setStartsAtLocal(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="timeEntryEnd" className="text-xs font-medium">
              Bis
            </Label>
            <Input
              id="timeEntryEnd"
              type="time"
              value={endsAtLocal}
              onChange={(e) => setEndsAtLocal(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="timeEntryHours" className="text-xs font-medium">
            Stunden{computedHours != null ? " (automatisch berechnet)" : ""}
          </Label>
          <Input
            id="timeEntryHours"
            type="number"
            step={0.25}
            min={0}
            max={24}
            value={effectiveHoursLabel}
            onChange={(e) => setHours(e.target.value)}
            disabled={computedHours != null}
            required
            className="h-9"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="timeEntryNote" className="text-xs font-medium">
            Notiz (optional)
          </Label>
          <Textarea
            id="timeEntryNote"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="z. B. Montage Storen, Baustelle Musterstrasse"
          />
        </div>
        {error ? <p className="text-xs font-medium text-destructive sm:col-span-2">{error}</p> : null}
        <div className="flex items-center gap-2 sm:col-span-2">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? (
              <BauflipLoadingButtonLabel variant="onPrimary">Speichern …</BauflipLoadingButtonLabel>
            ) : (
              <>
                <Plus className="size-4" aria-hidden />
                {editingId ? "Eintrag aktualisieren" : "Eintrag speichern"}
              </>
            )}
          </Button>
          {editingId ? (
            <Button type="button" size="sm" variant="ghost" onClick={resetForm} disabled={saving}>
              Abbrechen
            </Button>
          ) : null}
        </div>
      </form>

      <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="timeEntryRangeStart" className="text-[11px] text-muted-foreground">
              Von
            </Label>
            <Input
              id="timeEntryRangeStart"
              type="date"
              value={rangeStart}
              onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="timeEntryRangeEnd" className="text-[11px] text-muted-foreground">
              Bis
            </Label>
            <Input
              id="timeEntryRangeEnd"
              type="date"
              value={rangeEnd}
              onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRange(currentWeekRange())}
            className="h-8 text-xs"
          >
            Diese Woche
          </Button>
          <p className="ml-auto text-xs text-muted-foreground">
            Summe: {sortedEntries.reduce((sum, e) => sum + e.hours, 0).toFixed(2)} Std.
          </p>
        </div>

        {isFetching && entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">Lädt …</p>
        ) : sortedEntries.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground">
            Keine Einträge in diesem Zeitraum.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sortedEntries.map((entry) => {
              const isDeleting = remove.isPending && remove.variables?.timeEntryId === entry.id;
              return (
                <li
                  key={entry.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border border-border/60 bg-card px-3 py-2 shadow-sm",
                    editingId === entry.id && "border-primary/50",
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                      <span>{formatDateDe(entry.entryDate)}</span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary">
                        <Clock className="size-3" aria-hidden />
                        {entry.hours} Std.
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.startsAt && entry.endsAt ? `${entry.startsAt}–${entry.endsAt}` : null}
                    </p>
                    {entry.note ? (
                      <p className="text-[11px] italic text-muted-foreground/90">{entry.note}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      aria-label="Eintrag bearbeiten"
                      onClick={() => startEdit(entry)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label="Eintrag löschen"
                      disabled={isDeleting}
                      onClick={() => {
                        if (window.confirm("Diesen Eintrag wirklich löschen?")) {
                          remove.mutate({ timeEntryId: entry.id });
                          if (editingId === entry.id) resetForm();
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
