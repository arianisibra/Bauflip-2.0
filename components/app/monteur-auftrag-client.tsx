"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectCore } from "@/lib/db/repository";
import { formatServiceAddress, managementLabel, tenantLabel } from "@/lib/tech/bundle-display";
import { submitTechnicianReportAction } from "@/app/(tech)/actions";
import { uploadProjectReportFileAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MonteurAuftragClient({ core }: { core: ProjectCore }) {
  const router = useRouter();
  const p = core.project;
  const [mode, setMode] = useState<"schaden_behoben" | "schaden_aufgenommen" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const nextAppt = useMemo(
    () => [...core.appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
    [core.appointments],
  );

  return (
    <section className="flex flex-col gap-5 pb-8">
      <header className="space-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auftrag</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {p.referenceCode ? `${p.referenceCode} · ` : ""}
          {p.title}
        </h1>
        <p className="text-sm text-slate-700">{formatServiceAddress(p)}</p>
        <p className="text-xs text-slate-600">
          <span className="font-medium">Termin:</span>{" "}
          {nextAppt
            ? `${new Date(nextAppt.startsAt).toLocaleString("de-CH")} – ${new Date(nextAppt.endsAt).toLocaleTimeString("de-CH")}`
            : "—"}
        </p>
        <p className="text-xs text-slate-600">
          <span className="font-medium">Mieter:</span> {tenantLabel(p)}
        </p>
        <p className="text-xs text-slate-600">
          <span className="font-medium">Verwaltung:</span> {managementLabel(p)}
        </p>
        <p className="text-xs text-slate-600">
          <span className="font-medium">Kostendach:</span> {p.costCeilingText?.trim() || "—"}
        </p>
        <p className="text-xs text-slate-600">
          <span className="font-medium">Kurz:</span> {p.title}
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Problem / Auftrag</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{p.intakeOriginalText}</p>
        {p.hintsAndNotes ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <span className="font-medium">Hinweis Büro:</span> {p.hintsAndNotes}
          </p>
        ) : null}
        {core.attachments.length > 0 ? (
          <ul className="mt-3 list-disc pl-5 text-xs text-slate-600">
            {core.attachments.map((a) => (
              <li key={a.id}>{a.fileName}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Einsatz</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            className="h-14 text-base"
            variant={mode === "schaden_behoben" ? "default" : "outline"}
            onClick={() => setMode("schaden_behoben")}
          >
            Schaden behoben
          </Button>
          <Button
            type="button"
            className="h-14 text-base"
            variant={mode === "schaden_aufgenommen" ? "default" : "outline"}
            onClick={() => setMode("schaden_aufgenommen")}
          >
            Schaden aufgenommen / ausgemessen
          </Button>
        </div>
      </section>

      {mode ? (
        <form
          className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setPending(true);
            setError(null);
            try {
              await submitTechnicianReportAction({
                projectId: p.id,
                outcome: mode,
                summary: String(fd.get("summary") ?? ""),
                measurementsJson: String(fd.get("measurementsJson") ?? "{}"),
                workDescription: String(fd.get("workDescription") ?? ""),
              });
              router.push("/tag");
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
            } finally {
              setPending(false);
            }
          }}
        >
          <input type="hidden" name="outcome" value={mode} />
          {mode === "schaden_behoben" ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="summary">Kurze Notiz</Label>
                <Textarea id="summary" name="summary" rows={3} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="workDescription">Material / Hinweise</Label>
                <Textarea id="workDescription" name="workDescription" rows={2} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="measurementsJson">Masse / Notizen (JSON oder Freitext)</Label>
                <Textarea id="measurementsJson" name="measurementsJson" rows={4} defaultValue="{}" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="workDescription">Hinweis für Bestellung / Offerte</Label>
                <Textarea id="workDescription" name="workDescription" rows={3} />
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>Fotos (optional)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.set("projectId", p.id);
                fd.set("file", file);
                setPending(true);
                try {
                  await uploadProjectReportFileAction(fd);
                  router.refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
                } finally {
                  setPending(false);
                }
              }}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="h-12 text-base" disabled={pending}>
            {pending ? "Speichern…" : "Abschliessen"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
