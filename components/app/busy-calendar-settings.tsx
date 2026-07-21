"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { useBusyCalendarStatus, useSaveBusyCalendar, useSyncBusyCalendar } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatDateTime(iso: string | null): string {
  if (!iso) return "noch nie";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unbekannt";
  return d.toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" });
}

/**
 * Privaten Kalender (iCal-Abo-URL) als Busy-Blocker verknüpfen. Wird in Einstellungen
 * (Büro/Admin) und im Monteur-Profil eingebunden. Zeigt belegte Zeiten bei der
 * Terminbuchung als Warnung — die URL bleibt geheim (nur die Person selbst sieht sie).
 */
export function BusyCalendarSettings() {
  const status = useBusyCalendarStatus();
  const save = useSaveBusyCalendar();
  const sync = useSyncBusyCalendar();

  const data = status.data;
  // Draft überlagert die Server-Werte, sobald der Nutzer etwas ändert — kein Seeding-Effekt.
  const [draft, setDraft] = useState<{ url: string; enabled: boolean } | null>(null);
  const url = draft?.url ?? data?.icsUrl ?? "";
  const enabled = draft?.enabled ?? data?.enabled ?? false;
  const setUrl = (v: string) => setDraft({ url: v, enabled });
  const setEnabled = (v: boolean) => setDraft({ url, enabled: v });

  const busy = save.isPending || sync.isPending;

  const handleSave = async () => {
    try {
      const result = await save.mutateAsync({ icsUrl: url.trim() || null, enabled });
      if (result.enabled && result.syncError) {
        toast.warning(`Gespeichert, aber Kalender nicht ladbar: ${result.syncError}`);
      } else {
        toast.success(result.enabled ? "Kalender verknüpft" : "Gespeichert");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const handleSync = async () => {
    try {
      const result = await sync.mutateAsync();
      if (result.syncError) toast.warning(`Aktualisieren fehlgeschlagen: ${result.syncError}`);
      else toast.success("Kalender aktualisiert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aktualisieren fehlgeschlagen.");
    }
  };

  return (
    <section className="rounded-xl border border-border p-4">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <CalendarClock className="size-4" aria-hidden />
        Privater Kalender (Busy-Blocker)
      </p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">iCal-Abo-URL (geheim)</Label>
          <Input
            type="url"
            inputMode="url"
            value={url}
            placeholder="https://…/basic.ics"
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Die «Abonnieren»-/«iCal»-Adresse deines privaten Kalenders (Google, Outlook, Apple).
            Bauflip liest daraus nur die <strong>belegten Zeiten</strong> — kein Titel, kein Inhalt.
            Bei einer Überschneidung erscheint beim Buchen eine Warnung (blockiert nicht).
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4"
          />
          Belegte Zeiten aus diesem Kalender berücksichtigen
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={handleSave}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Speichern
          </Button>
          {data?.enabled && data?.icsUrl ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={handleSync}>
              {sync.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              Jetzt aktualisieren
            </Button>
          ) : null}
        </div>

        {data?.enabled ? (
          <p className="text-[11px] text-muted-foreground">
            Zuletzt aktualisiert: {formatDateTime(data.syncedAt)}
            {data.syncError ? (
              <span className="ml-1 text-destructive">· Fehler: {data.syncError}</span>
            ) : null}
          </p>
        ) : null}
      </div>
    </section>
  );
}
