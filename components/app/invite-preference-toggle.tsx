"use client";

import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";
import { useInvitePreference, useSetInvitePreference } from "@/lib/query/hooks";

/**
 * Termin-Einladungen (iCal-Mail) an/aus — Switch im Stil des Dunkelmodus-Toggles.
 * Wird in Einstellungen (Büro/Admin) und im Monteur-Profil eingebunden.
 */
export function InvitePreferenceToggle() {
  const preference = useInvitePreference();
  const setPreference = useSetInvitePreference();
  const enabled = preference.data?.enabled ?? true;

  return (
    <section className="rounded-xl border border-border p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Benachrichtigungen
      </p>
      <button
        type="button"
        disabled={preference.isLoading || setPreference.isPending}
        onClick={async () => {
          try {
            const result = await setPreference.mutateAsync(!enabled);
            toast.success(
              result.enabled ? "Termin-Einladungen aktiviert" : "Termin-Einladungen deaktiviert",
            );
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
          }
        }}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm font-medium text-foreground transition-colors active:scale-[0.99] hover:bg-muted/40 disabled:opacity-60"
      >
        <span className="flex items-center gap-2">
          <CalendarCheck className={`size-4 ${enabled ? "text-primary" : "text-muted-foreground"}`} />
          Termin-Einladungen per E-Mail
        </span>
        <span
          className={`inline-flex h-6 w-10 items-center rounded-full p-0.5 transition-colors ${
            enabled ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`size-5 rounded-full bg-card shadow-sm transition-transform ${
              enabled ? "translate-x-4" : ""
            }`}
          />
        </span>
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Bei zugewiesenen Einsätzen erhältst du eine Kalender-Einladung (Outlook, Google, Apple) —
        Änderungen und Absagen aktualisieren den Termin automatisch.
      </p>
    </section>
  );
}
