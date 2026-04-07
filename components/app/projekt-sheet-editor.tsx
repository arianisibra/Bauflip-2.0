"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ProjectCore } from "@/lib/db/repository";
import type { TechnicianReport, UserProfile } from "@/lib/domain/types";
import { projectStatusLabels } from "@/lib/domain/types";
import {
  addAppointmentAction,
  deleteAppointmentAction,
  deleteReportAction,
  getProjectSheetDataAction,
  updateProjectStammdatenAction,
} from "@/app/(app)/projekte/actions";
import { uploadProjectReportFileAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  Trash2,
} from "lucide-react";
function buildReportText(r: TechnicianReport): string {
  const lines: string[] = [];
  lines.push(`Rapport – ${r.outcome === "schaden_behoben" ? "Schaden behoben" : "Schaden aufgenommen"}`);
  lines.push(`Datum: ${new Date(r.createdAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}`);
  lines.push("");
  if (r.summary?.trim()) {
    lines.push("Zusammenfassung:");
    lines.push(r.summary.trim());
    lines.push("");
  }
  if (r.workDescription?.trim()) {
    lines.push("Arbeit / Material:");
    lines.push(r.workDescription.trim());
    lines.push("");
  }
  if (r.measurementsJson && r.measurementsJson !== "{}" && r.measurementsJson !== "{}") {
    lines.push("Masse / Notizen:");
    lines.push(r.measurementsJson);
    lines.push("");
  }
  for (const of_ of r.orderForms) {
    lines.push(`--- ${of_.templateName} ---`);
    for (const f of of_.fields) {
      const val = of_.values[f.key]?.trim() || "—";
      lines.push(`  ${f.label}: ${val}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function downloadReport(r: TechnicianReport) {
  const text = buildReportText(r);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rapport-${new Date(r.createdAt).toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportCard({
  report: r,
  canEdit,
  onDelete,
}: {
  report: TechnicianReport;
  canEdit: boolean;
  onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isBehoben = r.outcome === "schaden_behoben";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Header row - always visible */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
      >
        <div
          className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
            isBehoben
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          {isBehoben ? <CheckCircle2 className="size-3.5" /> : <ClipboardList className="size-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {isBehoben ? "Behoben" : "Aufgenommen"}
            {r.summary?.trim() ? (
              <span className="ml-1.5 font-normal text-muted-foreground">— {r.summary}</span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(r.createdAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}
          </p>
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-border/60 px-3 py-3 text-sm">
          {r.workDescription?.trim() ? (
            <div className="mb-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Arbeit / Material
              </p>
              <p className="whitespace-pre-wrap text-xs text-foreground">
                {r.workDescription}
              </p>
            </div>
          ) : null}

          {r.measurementsJson && r.measurementsJson !== "{}" ? (
            <div className="mb-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Masse / Notizen
              </p>
              <p className="whitespace-pre-wrap text-xs text-foreground">
                {r.measurementsJson}
              </p>
            </div>
          ) : null}

          {r.orderForms.length > 0 && (
            <div className="mb-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bestellformulare
              </p>
              {r.orderForms.map((of_) => (
                <div
                  key={`${r.id}-${of_.templateId}`}
                  className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2"
                >
                  <p className="text-xs font-semibold text-foreground">{of_.templateName}</p>
                  <dl className="mt-1.5 space-y-1">
                    {of_.fields.map((f) => (
                      <div key={f.key} className="flex items-baseline gap-2 text-xs">
                        <dt className="shrink-0 text-muted-foreground">{f.label}:</dt>
                        <dd className="font-medium text-foreground">
                          {of_.values[f.key]?.trim() || "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 border-t border-border/60 pt-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => downloadReport(r)}
            >
              <Download className="size-3.5" />
              Herunterladen
            </Button>
            {canEdit && (
              <>
                {confirming ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                      onClick={async () => {
                        setConfirming(false);
                        await onDelete();
                      }}
                    >
                      Ja, löschen
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setConfirming(false)}
                    >
                      Abbrechen
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={() => setConfirming(true)}
                  >
                    <Trash2 className="size-3.5" />
                    Löschen
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjektSheetEditor({
  projectId,
  open,
  canEdit,
  technicians,
}: {
  projectId: string;
  open: boolean;
  canEdit: boolean;
  technicians: UserProfile[];
}) {
  const router = useRouter();
  const [core, setCore] = useState<ProjectCore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { bundle } = await getProjectSheetDataAction(projectId);
      setCore(bundle);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    }
  }, [projectId]);

  useEffect(() => {
    if (open && projectId) {
      void load();
    }
  }, [open, projectId, load]);

  if (!open) {
    return null;
  }
  if (error && !core) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!core) {
    return <p className="text-sm text-muted-foreground">Laden…</p>;
  }

  const p = core.project;

  return (
    <div className="flex max-h-[min(80vh,720px)] flex-col gap-6 overflow-y-auto pr-1">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!canEdit) return;
          const fd = new FormData(e.currentTarget);
          setPending(true);
          setError(null);
          try {
            await updateProjectStammdatenAction({
              projectId,
              title: String(fd.get("title") ?? ""),
              intakeOriginalText: String(fd.get("intakeOriginalText") ?? ""),
              tenantName: String(fd.get("tenantName") ?? ""),
              tenantPhone: String(fd.get("tenantPhone") ?? ""),
              tenantEmail: String(fd.get("tenantEmail") ?? ""),
              managementName: String(fd.get("managementName") ?? ""),
              managementPhone: String(fd.get("managementPhone") ?? ""),
              managementEmail: String(fd.get("managementEmail") ?? ""),
              costCeilingText: String(fd.get("costCeilingText") ?? ""),
              serviceStreet: String(fd.get("serviceStreet") ?? ""),
              servicePostalCode: String(fd.get("servicePostalCode") ?? ""),
              serviceCity: String(fd.get("serviceCity") ?? ""),
              hintsAndNotes: String(fd.get("hintsAndNotes") ?? ""),
              accessNotes: String(fd.get("accessNotes") ?? ""),
              nextOwnerUserId: String(fd.get("nextOwnerUserId") ?? ""),
            });
            toast.success("Projekt gespeichert");
            await load();
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="title">Titel</Label>
          <Input id="title" name="title" defaultValue={p.title} disabled={!canEdit} required />
        </div>
        <div className="text-xs text-muted-foreground sm:col-span-2">
          {p.referenceCode ? `Auftrag ${p.referenceCode}` : "Ohne Nummer"} · Status: {projectStatusLabels[p.status]}
        </div>

        <div className="space-y-1">
          <Label>Mieter / Kontakt</Label>
          <Input name="tenantName" defaultValue={p.tenantName ?? ""} disabled={!canEdit} />
        </div>
        <div className="space-y-1">
          <Label>Telefon Mieter</Label>
          <Input name="tenantPhone" defaultValue={p.tenantPhone ?? ""} disabled={!canEdit} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>E-Mail Mieter</Label>
          <Input name="tenantEmail" type="email" defaultValue={p.tenantEmail ?? ""} disabled={!canEdit} />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Verwaltung</Label>
          <Input name="managementName" defaultValue={p.managementName ?? ""} disabled={!canEdit} />
        </div>
        <div className="space-y-1">
          <Label>Tel. Verwaltung</Label>
          <Input name="managementPhone" defaultValue={p.managementPhone ?? ""} disabled={!canEdit} />
        </div>
        <div className="space-y-1">
          <Label>E-Mail Verwaltung</Label>
          <Input name="managementEmail" type="email" defaultValue={p.managementEmail ?? ""} disabled={!canEdit} />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Kostendach</Label>
          <Input name="costCeilingText" defaultValue={p.costCeilingText ?? ""} disabled={!canEdit} />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Adresse Einsatz</Label>
          <Input name="serviceStreet" placeholder="Strasse" defaultValue={p.serviceStreet ?? ""} disabled={!canEdit} />
        </div>
        <div className="space-y-1">
          <Label>PLZ</Label>
          <Input name="servicePostalCode" defaultValue={p.servicePostalCode ?? ""} disabled={!canEdit} />
        </div>
        <div className="space-y-1">
          <Label>Ort</Label>
          <Input name="serviceCity" defaultValue={p.serviceCity ?? ""} disabled={!canEdit} />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Problembeschreibung</Label>
          <Textarea name="intakeOriginalText" rows={4} defaultValue={p.intakeOriginalText} disabled={!canEdit} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Hinweise Team</Label>
          <Textarea name="hintsAndNotes" rows={2} defaultValue={p.hintsAndNotes ?? ""} disabled={!canEdit} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Zugang / Schlüssel</Label>
          <Textarea name="accessNotes" rows={2} defaultValue={p.accessNotes ?? ""} disabled={!canEdit} />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Monteur (Vorschlag)</Label>
          <select
            name="nextOwnerUserId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            defaultValue={p.nextOwnerUserId ?? ""}
            disabled={!canEdit}
          >
            <option value="">—</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayName}
              </option>
            ))}
          </select>
        </div>

        {canEdit ? (
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        ) : null}
      </form>

      {canEdit ? (
        <section className="border-t pt-4">
          <h3 className="mb-2 text-sm font-semibold">Termin planen</h3>
          <form
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setPending(true);
              try {
                const starts = String(fd.get("startsAt") ?? "");
                const ends = String(fd.get("endsAt") ?? "");
                await addAppointmentAction({
                  projectId,
                  kind: "ausfuehrung",
                  startsAt: new Date(starts).toISOString(),
                  endsAt: new Date(ends).toISOString(),
                  assignedTechnicianId: String(fd.get("assignedTechnicianId") ?? "") || null,
                });
                await load();
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Termin fehlgeschlagen.");
              } finally {
                setPending(false);
              }
            }}
          >
            <div className="space-y-1">
              <Label>Beginn</Label>
              <Input name="startsAt" type="datetime-local" required />
            </div>
            <div className="space-y-1">
              <Label>Ende</Label>
              <Input name="endsAt" type="datetime-local" required />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Monteur</Label>
              <select
                name="assignedTechnicianId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              Termin speichern
            </Button>
          </form>

          <ul className="mt-3 space-y-2 text-sm">
            {core.appointments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                <span>
                  {new Date(a.startsAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich" })} – {new Date(a.endsAt).toLocaleTimeString("de-CH", { timeZone: "Europe/Zurich" })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={async () => {
                    if (!window.confirm("Termin löschen?")) return;
                    await deleteAppointmentAction(a.id);
                    toast.success("Termin gelöscht");
                    await load();
                    router.refresh();
                  }}
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-t pt-4">
        <h3 className="mb-2 text-sm font-semibold">Anhänge</h3>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData();
            fd.set("projectId", projectId);
            const input = (e.currentTarget.elements.namedItem("file") as HTMLInputElement) ?? null;
            const file = input?.files?.[0];
            if (!file) return;
            fd.set("file", file);
            setPending(true);
            try {
              await uploadProjectReportFileAction(fd);
              await load();
              router.refresh();
              if (input) input.value = "";
            } catch (err) {
              setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
            } finally {
              setPending(false);
            }
          }}
        >
          <Input name="file" type="file" accept="image/*,application/pdf" />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Hochladen
          </Button>
        </form>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {core.attachments.map((a) => (
            <li key={a.id}>{a.fileName}</li>
          ))}
        </ul>
      </section>

      {core.reports.length > 0 && (
        <section className="border-t pt-4">
          <h3 className="mb-3 text-sm font-semibold">
            Rapporte ({core.reports.length})
          </h3>
          <div className="space-y-2">
            {core.reports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                canEdit={canEdit}
                onDelete={async () => {
                  setPending(true);
                  try {
                    await deleteReportAction(r.id);
                    toast.success("Rapport gelöscht");
                    await load();
                    router.refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
                  } finally {
                    setPending(false);
                  }
                }}
              />
            ))}
          </div>
        </section>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
