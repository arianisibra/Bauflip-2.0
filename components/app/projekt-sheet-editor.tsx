"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Appointment, TechnicianReport, ProjectStatus } from "@/lib/domain/types";
import { projectStatusBadgeClassName, projectStatusLabels, projectStatuses } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import {
  useAddAppointment,
  useAssignableProfiles,
  useDeleteAppointment,
  useDeleteAttachment,
  useDeleteReport,
  useProjectCore,
  useUpdateProjectStatus,
  useUpdateStammdaten,
  useUploadAttachment,
} from "@/lib/query/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  Loader2,
  Trash2,
} from "lucide-react";
import { BauflipLoading, BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
function getFilledOrderFormFields(of_: TechnicianReport["orderForms"][number]) {
  return of_.fields.filter((f) => Boolean(of_.values[f.key]?.trim()));
}

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
  r.orderForms.forEach((of_, ofIdx) => {
    const filledFields = getFilledOrderFormFields(of_);
    if (filledFields.length === 0) return;
    const sameTplCount = r.orderForms.filter((x) => x.templateId === of_.templateId).length;
    const positionInTpl =
      r.orderForms.slice(0, ofIdx).filter((x) => x.templateId === of_.templateId).length + 1;
    const head =
      sameTplCount > 1
        ? `--- ${of_.templateName} (Position ${positionInTpl}) ---`
        : `--- ${of_.templateName} ---`;
    lines.push(head);
    for (const f of filledFields) {
      const val = of_.values[f.key]?.trim();
      lines.push(`  ${f.label}: ${val}`);
    }
    lines.push("");
  });
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
  const [deleting, setDeleting] = useState(false);
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
              {r.orderForms.map((of_, ofIdx) => {
                const filledFields = getFilledOrderFormFields(of_);
                if (filledFields.length === 0) return null;
                const sameTplCount = r.orderForms.filter((x) => x.templateId === of_.templateId).length;
                const positionInTpl =
                  r.orderForms.slice(0, ofIdx).filter((x) => x.templateId === of_.templateId).length + 1;
                const positionLabel =
                  sameTplCount > 1 ? ` · Position ${positionInTpl}` : "";
                return (
                <div
                  key={`${r.id}-${of_.templateId}-${ofIdx}`}
                  className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2"
                >
                  <p className="text-xs font-semibold text-foreground">
                    {of_.templateName}
                    <span className="font-normal text-muted-foreground">{positionLabel}</span>
                  </p>
                  <dl className="mt-1.5 space-y-1">
                    {filledFields.map((f) => (
                      <div key={f.key} className="flex items-baseline gap-2 text-xs">
                        <dt className="shrink-0 text-muted-foreground">{f.label}:</dt>
                        <dd className="font-medium text-foreground">
                          {of_.values[f.key]?.trim()}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                );
              })}
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
                      disabled={deleting}
                      onClick={async () => {
                        setDeleting(true);
                        try {
                          await onDelete();
                        } finally {
                          setDeleting(false);
                          setConfirming(false);
                        }
                      }}
                    >
                      {deleting ? (
                        <BauflipLoadingButtonLabel variant="onPrimary">Wird gelöscht …</BauflipLoadingButtonLabel>
                      ) : (
                        "Ja, löschen"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      disabled={deleting}
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

type PipelineAction = { label: string; nextStatus: ProjectStatus };

const STATUS_PIPELINE: Partial<Record<ProjectStatus, PipelineAction[]>> = {
  offerte_senden:    [{ label: "Offerte gesendet", nextStatus: "offerte_gesendet" }],
  offerte_gesendet:  [{ label: "Offerte genehmigt", nextStatus: "offerte_genehmigt" }],
  offerte_genehmigt: [{ label: "Material bestellen", nextStatus: "bestellen" }, { label: "Direkt abrechnen", nextStatus: "abrechnen" }],
  bestellen:         [{ label: "Bestellt", nextStatus: "bestellt" }],
  bestellt:          [{ label: "Material eingetroffen", nextStatus: "montagebereit" }],
  abholbereit:       [{ label: "In Werkstatt", nextStatus: "werkstatt" }],
  werkstatt:         [{ label: "Werkstatt fertig", nextStatus: "montagebereit" }],
  abklaeren:         [{ label: "Offerte senden", nextStatus: "offerte_senden" }, { label: "Material bestellen", nextStatus: "bestellen" }],
  subunternehmer:    [{ label: "Abrechnen", nextStatus: "abrechnen" }],
  abrechnen:         [{ label: "Abgeschlossen", nextStatus: "abgeschlossen" }],
};

function StatusPipeline({
  projectId,
  currentStatus,
  canEdit,
}: {
  projectId: string;
  currentStatus: ProjectStatus;
  canEdit: boolean;
}) {
  const updateStatus = useUpdateProjectStatus();
  const actions = STATUS_PIPELINE[currentStatus] ?? [];
  const label = projectStatusLabels[currentStatus] ?? currentStatus;

  const advance = (nextStatus: ProjectStatus) => {
    updateStatus.mutate({ projectId, status: nextStatus }, {
      onError: (e) => {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Status konnte nicht geändert werden.");
      },
    });
  };
  const pending = updateStatus.isPending;

  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status:</span>
        <Badge variant="outline" className={cn("text-xs font-medium", projectStatusBadgeClassName(currentStatus))}>
          {label}
        </Badge>
        {canEdit && actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {actions.map((action) => (
              <button
                key={action.nextStatus}
                type="button"
                disabled={pending}
                onClick={() => advance(action.nextStatus)}
                className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <ArrowRight className="size-3" aria-hidden />
                )}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {canEdit ? (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const nextStatus = String(fd.get("manualStatus") ?? "") as ProjectStatus;
            if (!nextStatus || nextStatus === currentStatus) {
              return;
            }
            advance(nextStatus);
          }}
        >
          <div className="min-w-[13rem] flex-1">
            <Label htmlFor={`manual-status-${projectId}`} className="text-[11px] text-muted-foreground">
              Status manuell ändern (inkl. rückgängig)
            </Label>
            <select
              id={`manual-status-${projectId}`}
              name="manualStatus"
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
              defaultValue={currentStatus}
              disabled={pending}
            >
              {projectStatuses.map((status) => (
                <option key={status} value={status}>
                  {projectStatusLabels[status]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? <BauflipLoadingButtonLabel variant="onSurface">Ändert …</BauflipLoadingButtonLabel> : "Setzen"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function ProjektSheetEditor({
  projectId,
  open,
  canEdit,
}: {
  projectId: string;
  open: boolean;
  canEdit: boolean;
}) {
  const coreQuery = useProjectCore(projectId, open);
  const { data: technicians = [] } = useAssignableProfiles();
  const updateStammdaten = useUpdateStammdaten();
  const addAppointment = useAddAppointment();
  const deleteAppointment = useDeleteAppointment();
  const deleteAttachment = useDeleteAttachment();
  const deleteReport = useDeleteReport();
  const uploadAttachment = useUploadAttachment();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }
  if (coreQuery.isError && !coreQuery.data) {
    return (
      <p className="text-sm text-destructive">
        {coreQuery.error instanceof Error ? coreQuery.error.message : "Laden fehlgeschlagen."}
      </p>
    );
  }
  if (!coreQuery.data) {
    return (
      <div className="flex justify-center py-10" role="status" aria-live="polite">
        <BauflipLoading size="sm" label="Projekt wird geladen …" />
      </div>
    );
  }

  const core = coreQuery.data;
  const p = core.project;
  const pending =
    updateStammdaten.isPending ||
    addAppointment.isPending ||
    deleteAppointment.isPending ||
    deleteAttachment.isPending ||
    deleteReport.isPending ||
    uploadAttachment.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto pr-1">
      <StatusPipeline
        projectId={projectId}
        currentStatus={p.status}
        canEdit={canEdit}
      />
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canEdit) return;
          const fd = new FormData(e.currentTarget);
          setError(null);
          updateStammdaten.mutate(
            {
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
            },
            {
              onSuccess: () => toast.success("Projekt gespeichert"),
              onError: (err) => toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen."),
            },
          );
        }}
      >
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="title">Titel</Label>
          <Input id="title" name="title" defaultValue={p.title} disabled={!canEdit} required />
        </div>
        <div className="text-xs text-muted-foreground sm:col-span-2">
          {p.referenceCode ? `Auftrag ${p.referenceCode}` : "Ohne Nummer"}
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
          <Label>Zuständige Person (Vorschlag)</Label>
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
            <Button type="submit" disabled={updateStammdaten.isPending}>
              {updateStammdaten.isPending ? (
                <BauflipLoadingButtonLabel variant="onPrimary">Speichern …</BauflipLoadingButtonLabel>
              ) : (
                "Speichern"
              )}
            </Button>
          </div>
        ) : null}
      </form>

      {canEdit ? (
        <section className="border-t pt-4">
          <h3 className="mb-2 text-sm font-semibold">Termin planen</h3>
          <form
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const starts = String(fd.get("startsAt") ?? "");
              const ends = String(fd.get("endsAt") ?? "");
              addAppointment.mutate(
                {
                  projectId,
                  kind: "ausfuehrung",
                  startsAt: new Date(starts).toISOString(),
                  endsAt: new Date(ends).toISOString(),
                  assignedTechnicianId: String(fd.get("assignedTechnicianId") ?? "") || null,
                },
                {
                  onError: (err) =>
                    setError(err instanceof Error ? err.message : "Termin fehlgeschlagen."),
                },
              );
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
              <Label>Zuständige Person</Label>
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
            <Button type="submit" size="sm" disabled={addAppointment.isPending}>
              {addAppointment.isPending ? (
                <BauflipLoadingButtonLabel variant="onPrimary">Speichern …</BauflipLoadingButtonLabel>
              ) : (
                "Termin speichern"
              )}
            </Button>
          </form>

          <ul className="mt-3 space-y-2 text-sm">
            {core.appointments.map((a: Appointment, appointmentIndex: number) => {
              const assignedPerson = a.assignedTechnicianId
                ? technicians.find((t) => t.id === a.assignedTechnicianId)
                : null;
              return (
                <li key={a.id} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-foreground">
                        {new Date(a.startsAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich" })} – {new Date(a.endsAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" })}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>
                          {a.kind === "besichtigung" ? "Besichtigung" : "Ausführung"}
                          {assignedPerson ? ` · ${assignedPerson.displayName}` : " · Keine Person zugewiesen"}
                        </span>
                        {appointmentIndex > 0 ? (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary">
                            Folgetermin
                          </span>
                        ) : null}
                        {appointmentIndex === 0 && p.status === "montagebereit" ? (
                          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0 text-[10px] font-medium text-emerald-800 dark:text-emerald-200">
                            Montage
                          </span>
                        ) : null}
                      </p>
                      {a.planningNotes?.trim() ? (
                        <p className="text-[11px] text-muted-foreground italic">{a.planningNotes}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-destructive hover:text-destructive"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm("Termin löschen?")) return;
                        deleteAppointment.mutate(
                          { appointmentId: a.id, projectId },
                          {
                            onSuccess: () => toast.success("Termin gelöscht"),
                            onError: (err) =>
                              toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen."),
                          },
                        );
                      }}
                    >
                      {deleteAppointment.isPending &&
                      deleteAppointment.variables?.appointmentId === a.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-label="Wird gelöscht" />
                      ) : (
                        "×"
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
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
            try {
              const result = await uploadAttachment.mutateAsync({ formData: fd, projectId });
              if (result.success) {
                if (input) input.value = "";
              } else {
                setError(result.error);
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
            }
          }}
        >
          <Input name="file" type="file" accept="image/*,application/pdf" />
          <Button type="submit" size="sm" variant="outline" disabled={uploadAttachment.isPending}>
            {uploadAttachment.isPending ? (
              <BauflipLoadingButtonLabel variant="onSurface">Wird hochgeladen …</BauflipLoadingButtonLabel>
            ) : (
              "Hochladen"
            )}
          </Button>
        </form>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {core.attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5">
              <span className="min-w-0 truncate">{a.fileName}</span>
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={async () => {
                    if (!window.confirm(`Datei "${a.fileName}" wirklich löschen?`)) return;
                    try {
                      const result = await deleteAttachment.mutateAsync({
                        attachmentId: a.id,
                        filePath: a.filePath,
                        projectId,
                      });
                      if (result.success) {
                        toast.success("Datei gelöscht");
                      } else {
                        toast.error(result.error);
                      }
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </li>
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
                  try {
                    await deleteReport.mutateAsync({ reportId: r.id, projectId });
                    toast.success("Rapport gelöscht");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
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
