import type { ReactNode } from "react";

/**
 * Ruhige Zusammenfassungs-Zeile für einen Einstellungs-Bereich: Titel + Kurzstatus
 * links, Aktion (meist «Bearbeiten» → Fenster) rechts. Ersetzt dauerhaft offene
 * Formulare durch eine scannbare Liste.
 */
export function SettingsRow({
  title,
  summary,
  action,
}: {
  title: string;
  /** Kurzstatus des Bereichs (z. B. «IBAN CH… · Zürich» oder «Nicht verbunden»). */
  summary: ReactNode;
  action: ReactNode;
}) {
  return (
    <section className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{summary}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </section>
  );
}
