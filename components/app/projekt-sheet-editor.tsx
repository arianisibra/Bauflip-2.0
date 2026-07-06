"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Appointment, TechnicianReport, ProjectStatus, UserProfile } from "@/lib/domain/types";
import {
  PROJECT_STATUS_ABGESCHLOSSEN_REQUIRES_ABRECHNEN_MESSAGE,
  canSetProjectStatus,
  projectStatusBadgeClassName,
  projectStatusLabels,
  projectStatuses,
} from "@/lib/domain/types";
import { computeConflicts, conflictStatus, hasFerienConflict, type Conflict } from "@/lib/calendar/availability-conflicts";
import { cn } from "@/lib/utils";
import { telHref } from "@/lib/phone";
import {
  useAssignableProfiles,
  useAvailabilityRange,
  useDeleteAppointment,
  useDeleteAttachment,
  useDeleteReport,
  useOrderFormTemplates,
  useProjectCore,
  useQuoteMailConfig,
  useReassignAppointmentTechnician,
  useSendAppointmentConfirmation,
  useSetGarantiefall,
  useUpdateProjectStatus,
  useUpdateStammdaten,
  useUpdateTechnicianReport,
  useUploadAttachment,
} from "@/lib/query/hooks";
import { isLikelyProjectImage } from "@/lib/storage/mime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import { BauflipLoading, BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { TechnicianReportEditOverlay } from "@/components/app/technician-report-edit-overlay";
import { ProjektQuotesSection } from "@/components/app/projekt-quotes-section";
import { AppointmentBookingForm } from "@/components/app/appointment-booking-form";
import type { AvailabilityBundle } from "@/app/(app)/kalender/availability-actions";
import { getFilledOrderFormFields } from "@/lib/order-forms/filled-fields";
function formatAppointmentRange(startsAtIso: string, endsAtIso: string): string {
  const startsAt = new Date(startsAtIso);
  const endsAt = new Date(endsAtIso);
  const day = startsAt.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
  const startTime = startsAt.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  });
  const endTime = endsAt.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  });
  return `${day} ${startTime} – ${endTime}`;
}

function buildReportText(r: TechnicianReport): string {
  const lines: string[] = [];
  lines.push(`Rapport – ${r.outcome === "schaden_behoben" ? "Schaden behoben" : "Schaden aufgenommen"}`);
  lines.push(`Datum: ${new Date(r.createdAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}`);
  if (r.createdByDisplayName?.trim()) {
    lines.push(`Erfasst von: ${r.createdByDisplayName.trim()}`);
  }
  lines.push("");
  if (r.workDescription?.trim()) {
    lines.push("Arbeit / Material:");
    lines.push(r.workDescription.trim());
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
  onEdit,
}: {
  report: TechnicianReport;
  canEdit: boolean;
  onDelete: () => Promise<void>;
  onEdit?: () => void;
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
            {r.workDescription?.trim() ? (
              <span className="ml-1.5 line-clamp-2 min-w-0 break-words font-normal text-muted-foreground">
                — {r.workDescription.trim()}
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(r.createdAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}
          </p>
          {r.createdByDisplayName?.trim() ? (
            <p className="text-[11px] text-muted-foreground">Erfasst von {r.createdByDisplayName.trim()}</p>
          ) : null}
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

          {r.signatureDataUrl ? (
            <div className="mb-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Kundensignatur{r.signedByName ? ` — ${r.signedByName}` : ""}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={r.signatureDataUrl}
                alt={`Signatur${r.signedByName ? ` von ${r.signedByName}` : ""}`}
                className="max-h-24 rounded-md border border-border/60 bg-white p-1"
              />
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
            {canEdit && onEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => onEdit()}
              >
                <Pencil className="size-3.5" />
                Bearbeiten
              </Button>
            ) : null}
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
  offerte_senden:    [{ label: "OFFERTE GESENDET", nextStatus: "offerte_gesendet" }],
  offerte_gesendet:  [{ label: "OFFERTE GENEHMIGT", nextStatus: "offerte_genehmigt" }],
  offerte_genehmigt: [{ label: "MATERIAL BESTELLEN", nextStatus: "bestellen" }, { label: "DIREKT ABRECHNEN", nextStatus: "abrechnen" }],
  bestellen:         [{ label: "BESTELLT", nextStatus: "bestellt" }],
  bestellt:          [{ label: "MATERIAL EINGETROFFEN", nextStatus: "montagebereit" }],
  abholbereit:       [{ label: "IN WERKSTATT", nextStatus: "werkstatt" }],
  werkstatt:         [{ label: "WERKSTATT FERTIG", nextStatus: "montagebereit" }],
  abklaeren:         [{ label: "OFFERTE SENDEN", nextStatus: "offerte_senden" }, { label: "MATERIAL BESTELLEN", nextStatus: "bestellen" }],
  subunternehmer:    [{ label: "ABRECHNEN", nextStatus: "abrechnen" }],
  abrechnen:         [{ label: "ABGESCHLOSSEN", nextStatus: "abgeschlossen" }],
  abgeschlossen:     [{ label: "GARANTIEFALL MELDEN", nextStatus: "garantiefall" }],
  garantiefall:      [{ label: "ABGESCHLOSSEN", nextStatus: "abgeschlossen" }],
};

const STATUS_ACTION_TONE: Partial<Record<ProjectStatus, string>> = {
  offerte_gesendet: "border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-200",
  offerte_genehmigt: "border-purple-500/35 bg-purple-500/10 text-purple-700 dark:text-purple-200",
  bestellen: "border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-200",
  bestellt: "border-pink-500/35 bg-pink-500/10 text-pink-700 dark:text-pink-200",
  montagebereit: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  werkstatt: "border-orange-500/35 bg-orange-500/10 text-orange-700 dark:text-orange-200",
  abrechnen: "border-yellow-500/40 bg-yellow-500/15 text-yellow-800 dark:text-yellow-200",
  abgeschlossen: "border-green-600/40 bg-green-600/15 text-green-800 dark:text-green-200",
  garantiefall: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200",
};

function StatusPipeline({
  projectId,
  currentStatus,
  canEdit,
  statusCounts,
}: {
  projectId: string;
  currentStatus: ProjectStatus;
  canEdit: boolean;
  /** Optional: gleiche Logik wie Listenfilter (z. B. Suche) — Anzeige „Status (n)“ im manuellen Dropdown. */
  statusCounts?: ReadonlyMap<ProjectStatus, number>;
}) {
  const updateStatus = useUpdateProjectStatus();
  const setGarantiefall = useSetGarantiefall();
  const actions = STATUS_PIPELINE[currentStatus] ?? [];
  const label = projectStatusLabels[currentStatus] ?? currentStatus;
  const [garantiefallOpen, setGarantiefallOpen] = useState(false);
  const [garantiefallNote, setGarantiefallNote] = useState("");

  const advance = (nextStatus: ProjectStatus) => {
    if (!canSetProjectStatus(currentStatus, nextStatus)) {
      toast.error(PROJECT_STATUS_ABGESCHLOSSEN_REQUIRES_ABRECHNEN_MESSAGE);
      return;
    }
    updateStatus.mutate({ projectId, status: nextStatus }, {
      onError: (e) => {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Status konnte nicht geändert werden.");
      },
    });
  };

  const requestStatusChange = (nextStatus: ProjectStatus) => {
    if (nextStatus === "garantiefall") {
      setGarantiefallNote("");
      setGarantiefallOpen(true);
      return;
    }
    advance(nextStatus);
  };

  const submitGarantiefall = () => {
    const note = garantiefallNote.trim();
    if (!note) {
      toast.error("Bitte Grund für den Garantiefall angeben.");
      return;
    }
    setGarantiefall.mutate({ projectId, note }, {
      onSuccess: () => {
        setGarantiefallOpen(false);
        setGarantiefallNote("");
      },
      onError: (e) => {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Garantiefall konnte nicht gespeichert werden.");
      },
    });
  };

  const pending = updateStatus.isPending || setGarantiefall.isPending;

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
                onClick={() => requestStatusChange(action.nextStatus)}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50",
                  STATUS_ACTION_TONE[action.nextStatus] ?? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
                )}
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
      {canEdit && garantiefallOpen ? (
        <div className="mt-2 space-y-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5">
          <Label htmlFor={`garantiefall-note-${projectId}`} className="text-[11px] font-medium text-rose-800 dark:text-rose-200">
            Grund für den Garantiefall
          </Label>
          <Textarea
            id={`garantiefall-note-${projectId}`}
            value={garantiefallNote}
            onChange={(e) => setGarantiefallNote(e.target.value)}
            placeholder="Was ist das Problem?"
            className="min-h-16 text-xs"
            disabled={pending}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={submitGarantiefall}
              className="gap-1.5 text-xs"
            >
              {pending ? (
                <BauflipLoadingButtonLabel variant="onSurface">Speichert …</BauflipLoadingButtonLabel>
              ) : (
                "Garantiefall speichern"
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setGarantiefallOpen(false);
                setGarantiefallNote("");
              }}
              className="text-xs"
            >
              Abbrechen
            </Button>
          </div>
        </div>
      ) : null}
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
            if (!canSetProjectStatus(currentStatus, nextStatus)) {
              toast.error(PROJECT_STATUS_ABGESCHLOSSEN_REQUIRES_ABRECHNEN_MESSAGE);
              return;
            }
            requestStatusChange(nextStatus);
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
              {projectStatuses.map((status) => {
                const label = projectStatusLabels[status];
                const n = statusCounts?.get(status);
                const allowed = canSetProjectStatus(currentStatus, status);
                return (
                  <option key={status} value={status} disabled={!allowed}>
                    {n !== undefined ? `${label} (${n})` : label}
                    {!allowed && status === "abgeschlossen" ? " — zuerst Abrechnen" : ""}
                  </option>
                );
              })}
            </select>
            {currentStatus !== "abrechnen" && currentStatus !== "garantiefall" ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                «Abgeschlossen» erst nach manuellem Wechsel auf «Abrechnen» (externe Buchhaltung) — ausser bei «Garantiefall», dort direkt möglich.
              </p>
            ) : null}
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? <BauflipLoadingButtonLabel variant="onSurface">Ändert …</BauflipLoadingButtonLabel> : "Setzen"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function TechnicianAvailabilityBadge({
  status,
}: {
  status: "idle" | "free" | "conflict" | "absence";
}) {
  if (status === "idle") return null;
  const tone =
    status === "free"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
      : status === "absence"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200"
        : "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200";
  const label = status === "free" ? "Frei" : status === "absence" ? "Abwesend" : "Konflikt";
  return (
    <span className={cn("shrink-0 rounded-md border px-1.5 py-0 text-[10px] font-medium leading-tight", tone)}>
      {label}
    </span>
  );
}

function AppointmentRow({
  appointment: a,
  appointmentIndex,
  projectId,
  technicians,
  showMontageBadge,
  pending,
  availabilityBundle,
  reassignAppointment,
  deleteAppointment,
  confirmationRecipientEmail,
}: {
  appointment: Appointment;
  appointmentIndex: number;
  projectId: string;
  technicians: UserProfile[];
  showMontageBadge: boolean;
  pending: boolean;
  availabilityBundle: AvailabilityBundle | undefined;
  reassignAppointment: ReturnType<typeof useReassignAppointmentTechnician>;
  deleteAppointment: ReturnType<typeof useDeleteAppointment>;
  /** Mieter-/Verwaltungs-Mail; null = kein Bestätigungs-Button (keine Adresse oder kein SMTP). */
  confirmationRecipientEmail: string | null;
}) {
  const sendConfirmation = useSendAppointmentConfirmation();
  const assignedName =
    a.assignedTechnicianDisplayName?.trim() ||
    (a.assignedTechnicianId
      ? technicians.find((t) => t.id === a.assignedTechnicianId)?.displayName?.trim()
      : null) ||
    null;
  const assignedName2 =
    a.assignedTechnicianDisplayName2?.trim() ||
    (a.assignedTechnicianId2
      ? technicians.find((t) => t.id === a.assignedTechnicianId2)?.displayName?.trim()
      : null) ||
    null;
  const reassigningThis =
    reassignAppointment.isPending &&
    reassignAppointment.variables?.appointmentId === a.id &&
    reassignAppointment.variables?.slot !== 2;
  const reassigningThis2 =
    reassignAppointment.isPending &&
    reassignAppointment.variables?.appointmentId === a.id &&
    reassignAppointment.variables?.slot === 2;

  // Lokale "gerade gewählte Person" pro Slot — für sofortiges Feedback ohne auf den
  // Server-Roundtrip zu warten. Sobald der Server eine andere Zuweisung bestätigt
  // (`a.assignedTechnicianId*` ändert sich), während des Renders nachziehen (kein
  // useEffect nötig — das wäre ein Render zu spät).
  const [lastServerId1, setLastServerId1] = useState(a.assignedTechnicianId ?? "");
  const [previewId1, setPreviewId1] = useState(a.assignedTechnicianId ?? "");
  if ((a.assignedTechnicianId ?? "") !== lastServerId1) {
    setLastServerId1(a.assignedTechnicianId ?? "");
    setPreviewId1(a.assignedTechnicianId ?? "");
  }
  const [lastServerId2, setLastServerId2] = useState(a.assignedTechnicianId2 ?? "");
  const [previewId2, setPreviewId2] = useState(a.assignedTechnicianId2 ?? "");
  if ((a.assignedTechnicianId2 ?? "") !== lastServerId2) {
    setLastServerId2(a.assignedTechnicianId2 ?? "");
    setPreviewId2(a.assignedTechnicianId2 ?? "");
  }

  const slotStart = Date.parse(a.startsAt);
  const slotEnd = Date.parse(a.endsAt);
  const range = useMemo(
    () => (Number.isFinite(slotStart) && Number.isFinite(slotEnd) ? { slotStart, slotEnd } : null),
    [slotStart, slotEnd],
  );
  const ready = Boolean(availabilityBundle) && Boolean(range);

  const conflicts1: Conflict[] = useMemo(
    () => computeConflicts(previewId1, availabilityBundle, range, a.id),
    [previewId1, availabilityBundle, range, a.id],
  );
  const conflicts2: Conflict[] = useMemo(
    () => computeConflicts(previewId2, availabilityBundle, range, a.id),
    [previewId2, availabilityBundle, range, a.id],
  );
  const status1 = conflictStatus(ready, previewId1, conflicts1);
  const status2 = conflictStatus(ready, previewId2, conflicts2);

  return (
    <li className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold text-foreground">{formatAppointmentRange(a.startsAt, a.endsAt)}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{a.kind === "besichtigung" ? "Besichtigung" : "Ausführung"}</span>
            <span className="rounded-md bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary">
              {appointmentIndex + 1}. Termin
            </span>
            {showMontageBadge ? (
              <span className="rounded-md bg-emerald-500/10 px-1.5 py-0 text-[10px] font-medium text-emerald-800 dark:text-emerald-200">
                Montage
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Label htmlFor={`appt-tech-${a.id}`} className="sr-only">
              Zuständige Person für Termin {appointmentIndex + 1}
            </Label>
            <select
              id={`appt-tech-${a.id}`}
              className="h-8 max-w-full min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs sm:max-w-[14rem]"
              value={a.assignedTechnicianId ?? ""}
              disabled={pending}
              onChange={(e) => {
                const nextId = e.target.value;
                if (!nextId || nextId === (a.assignedTechnicianId ?? "")) return;
                if (hasFerienConflict(computeConflicts(nextId, availabilityBundle, range, a.id))) {
                  toast.error("Diese Person ist in diesem Zeitraum in den Ferien.");
                  return;
                }
                setPreviewId1(nextId);
                reassignAppointment.mutate(
                  {
                    appointmentId: a.id,
                    projectId,
                    slot: 1,
                    assignedTechnicianId: nextId,
                  },
                  {
                    onSuccess: () => toast.success("Zuständige Person geändert"),
                    onError: (err) => {
                      setPreviewId1(a.assignedTechnicianId ?? "");
                      toast.error(err instanceof Error ? err.message : "Zuweisung fehlgeschlagen.");
                    },
                  },
                );
              }}
            >
              {!a.assignedTechnicianId ? (
                <option value="" disabled>
                  Person wählen …
                </option>
              ) : null}
              {a.assignedTechnicianId &&
              assignedName &&
              !technicians.some((t) => t.id === a.assignedTechnicianId) ? (
                <option value={a.assignedTechnicianId}>{assignedName}</option>
              ) : null}
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
            </select>
            {reassigningThis ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-label="Wird gespeichert" />
            ) : (
              <TechnicianAvailabilityBadge status={status1} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Label htmlFor={`appt-tech2-${a.id}`} className="sr-only">
              Zweite zuständige Person für Termin {appointmentIndex + 1}
            </Label>
            <select
              id={`appt-tech2-${a.id}`}
              className="h-8 max-w-full min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs sm:max-w-[14rem]"
              value={a.assignedTechnicianId2 ?? ""}
              disabled={pending}
              onChange={(e) => {
                const nextId = e.target.value;
                if (nextId === (a.assignedTechnicianId2 ?? "")) return;
                if (nextId && hasFerienConflict(computeConflicts(nextId, availabilityBundle, range, a.id))) {
                  toast.error("Diese Person ist in diesem Zeitraum in den Ferien.");
                  return;
                }
                setPreviewId2(nextId);
                reassignAppointment.mutate(
                  {
                    appointmentId: a.id,
                    projectId,
                    slot: 2,
                    assignedTechnicianId: nextId || null,
                  },
                  {
                    onSuccess: () =>
                      toast.success(nextId ? "Monteur 2 geändert" : "Monteur 2 entfernt"),
                    onError: (err) => {
                      setPreviewId2(a.assignedTechnicianId2 ?? "");
                      toast.error(err instanceof Error ? err.message : "Zuweisung fehlgeschlagen.");
                    },
                  },
                );
              }}
            >
              <option value="">Monteur 2 (optional)</option>
              {a.assignedTechnicianId2 &&
              assignedName2 &&
              !technicians.some((t) => t.id === a.assignedTechnicianId2) ? (
                <option value={a.assignedTechnicianId2}>{assignedName2}</option>
              ) : null}
              {technicians
                .filter((t) => t.id !== a.assignedTechnicianId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName}
                  </option>
                ))}
            </select>
            {reassigningThis2 ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-label="Wird gespeichert" />
            ) : (
              <TechnicianAvailabilityBadge status={status2} />
            )}
          </div>
          {a.planningNotes?.trim() ? (
            <p className="text-[11px] text-muted-foreground italic">{a.planningNotes}</p>
          ) : null}
          {confirmationRecipientEmail ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              disabled={sendConfirmation.isPending}
              onClick={async () => {
                if (!window.confirm(`Terminbestätigung an ${confirmationRecipientEmail} senden?`)) return;
                try {
                  await sendConfirmation.mutateAsync({
                    appointmentId: a.id,
                    projectId,
                    recipientEmail: confirmationRecipientEmail,
                  });
                  toast.success("Terminbestätigung versendet");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Versand fehlgeschlagen.");
                }
              }}
            >
              {sendConfirmation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Mail className="size-3.5" aria-hidden />
              )}
              Bestätigung senden
            </Button>
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
          {deleteAppointment.isPending && deleteAppointment.variables?.appointmentId === a.id ? (
            <Loader2 className="size-3.5 animate-spin" aria-label="Wird gelöscht" />
          ) : (
            "×"
          )}
        </Button>
      </div>
    </li>
  );
}

export function ProjektSheetEditor({
  projectId,
  open,
  canEdit,
  statusCounts,
}: {
  projectId: string;
  open: boolean;
  canEdit: boolean;
  statusCounts?: ReadonlyMap<ProjectStatus, number>;
}) {
  const coreQuery = useProjectCore(projectId, open);
  const [loadTechnicians, setLoadTechnicians] = useState(false);
  const { data: technicians = [] } = useAssignableProfiles(open && loadTechnicians);
  const updateStammdaten = useUpdateStammdaten();
  const deleteAppointment = useDeleteAppointment();
  const reassignAppointment = useReassignAppointmentTechnician();
  const deleteAttachment = useDeleteAttachment();
  const deleteReport = useDeleteReport();
  const updateReport = useUpdateTechnicianReport();
  const uploadAttachment = useUploadAttachment();
  const mailConfigQuery = useQuoteMailConfig(open && canEdit);
  const mailConfigured = mailConfigQuery.data?.mailConfigured ?? false;
  const [editReport, setEditReport] = useState<TechnicianReport | null>(null);
  const { data: orderFormTemplates = [] } = useOrderFormTemplates(undefined, editReport != null);
  const [error, setError] = useState<string | null>(null);
  const [fieldOverlay, setFieldOverlay] = useState<{
    label: string;
    value: string;
    multiline: boolean;
    target: HTMLInputElement | HTMLTextAreaElement;
  } | null>(null);

  useEffect(() => {
    if (open && canEdit && (coreQuery.data?.appointments.length ?? 0) > 0) {
      setLoadTechnicians(true);
    }
  }, [open, canEdit, coreQuery.data?.appointments.length]);

  const imageAttachments = useMemo(() => {
    const c = coreQuery.data;
    if (!c) return [];
    return c.attachments.filter((a) => isLikelyProjectImage(a.fileType, a.fileName));
  }, [coreQuery.data]);

  const documentAttachments = useMemo(() => {
    const c = coreQuery.data;
    if (!c) return [];
    return c.attachments.filter((a) => !isLikelyProjectImage(a.fileType, a.fileName));
  }, [coreQuery.data]);

  // Verfügbarkeitsfenster über alle Termine des Projekts (±1 Tag) — vorab geladen, sobald
  // "Termin planen" fokussiert wird, damit der Konfliktcheck beim Umbuchen sofort da ist.
  const reassignAvailabilityRange = useMemo(() => {
    const appointments = coreQuery.data?.appointments ?? [];
    if (appointments.length === 0) return null;
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const appt of appointments) {
      const s = Date.parse(appt.startsAt);
      const e = Date.parse(appt.endsAt);
      if (Number.isFinite(s)) minStart = Math.min(minStart, s);
      if (Number.isFinite(e)) maxEnd = Math.max(maxEnd, e);
    }
    if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) return null;
    const dayMs = 24 * 60 * 60 * 1000;
    return {
      startIso: new Date(minStart - dayMs).toISOString(),
      endIso: new Date(maxEnd + dayMs).toISOString(),
    };
  }, [coreQuery.data?.appointments]);

  const { data: reassignAvailabilityBundle } = useAvailabilityRange(
    reassignAvailabilityRange?.startIso ?? null,
    reassignAvailabilityRange?.endIso ?? null,
    open && loadTechnicians && Boolean(reassignAvailabilityRange),
  );

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
    deleteAppointment.isPending ||
    reassignAppointment.isPending ||
    deleteAttachment.isPending ||
    deleteReport.isPending ||
    updateReport.isPending ||
    uploadAttachment.isPending;
  const tenantTelHref = telHref(p.tenantPhone);

  const openFieldOverlay = (
    target: HTMLInputElement | HTMLTextAreaElement,
    label: string,
    multiline = false,
  ) => {
    setFieldOverlay({
      label,
      value: target.value,
      multiline,
      target,
    });
  };

  return (
    <div className="flex flex-col gap-6 pr-1">
      <StatusPipeline
        projectId={projectId}
        currentStatus={p.status}
        canEdit={canEdit}
        statusCounts={statusCounts}
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
              intakeOriginalText: String(fd.get("intakeOriginalText") ?? ""),
              tenantName: String(fd.get("tenantName") ?? ""),
              tenantPhone: String(fd.get("tenantPhone") ?? ""),
              tenantEmail: String(fd.get("tenantEmail") ?? ""),
              managementName: String(fd.get("managementName") ?? ""),
              managementEmail: String(fd.get("managementEmail") ?? ""),
              costCeilingText: String(fd.get("costCeilingText") ?? ""),
              serviceStreet: String(fd.get("serviceStreet") ?? ""),
              servicePostalCode: String(fd.get("servicePostalCode") ?? ""),
              serviceCity: String(fd.get("serviceCity") ?? ""),
            },
            {
              onSuccess: () => toast.success("Projekt gespeichert"),
              onError: (err) => toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen."),
            },
          );
        }}
      >
        <div className="text-xs text-muted-foreground sm:col-span-2">
          {p.referenceCode ? `Auftrag ${p.referenceCode}` : "Ohne Nummer"}
        </div>

        <div className="space-y-1">
          <Label>Mieter / Kontakt</Label>
          <Input
            name="tenantName"
            defaultValue={p.tenantName ?? ""}
            disabled={!canEdit}
            onDoubleClick={(e) => openFieldOverlay(e.currentTarget, "Mieter / Kontakt")}
          />
        </div>
        <div className="space-y-1">
          <Label>Telefon Mieter</Label>
          <div className="flex gap-2">
            <Input
              className="min-w-0 flex-1"
              name="tenantPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={p.tenantPhone ?? ""}
              disabled={!canEdit}
              onDoubleClick={(e) => openFieldOverlay(e.currentTarget, "Telefon Mieter")}
            />
            {tenantTelHref ? (
              <a
                href={tenantTelHref}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10 active:scale-[0.98]"
                aria-label="Mieter anrufen"
              >
                <Phone className="size-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Anrufen</span>
              </a>
            ) : null}
          </div>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>E-Mail Mieter</Label>
          <Input
            name="tenantEmail"
            type="email"
            defaultValue={p.tenantEmail ?? ""}
            disabled={!canEdit}
            onDoubleClick={(e) => openFieldOverlay(e.currentTarget, "E-Mail Mieter")}
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Verwaltung</Label>
          <Input
            name="managementName"
            defaultValue={p.managementName ?? ""}
            disabled={!canEdit}
            onDoubleClick={(e) => openFieldOverlay(e.currentTarget, "Verwaltung")}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Zuständige Person</Label>
          <Input
            name="managementEmail"
            type="email"
            defaultValue={p.managementEmail ?? ""}
            disabled={!canEdit}
            onDoubleClick={(e) => openFieldOverlay(e.currentTarget, "Zuständige Person")}
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Kostendach</Label>
          <Input
            name="costCeilingText"
            defaultValue={p.costCeilingText ?? ""}
            disabled={!canEdit}
            onDoubleClick={(e) => openFieldOverlay(e.currentTarget, "Kostendach")}
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Adresse Einsatz</Label>
          <Input
            name="serviceStreet"
            placeholder="Strasse"
            defaultValue={p.serviceStreet ?? ""}
            disabled={!canEdit}
            onDoubleClick={(e) => openFieldOverlay(e.currentTarget, "Adresse Einsatz")}
          />
        </div>
        <div className="space-y-1">
          <Label>PLZ</Label>
          <Input
            name="servicePostalCode"
            defaultValue={p.servicePostalCode ?? ""}
            disabled={!canEdit}
            onDoubleClick={(e) => openFieldOverlay(e.currentTarget, "PLZ")}
          />
        </div>
        <div className="space-y-1">
          <Label>Ort</Label>
          <Input
            name="serviceCity"
            defaultValue={p.serviceCity ?? ""}
            disabled={!canEdit}
            onDoubleClick={(e) => openFieldOverlay(e.currentTarget, "Ort")}
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Wichtige Informationen</Label>
          <Textarea
            name="intakeOriginalText"
            rows={4}
            defaultValue={p.intakeOriginalText}
            disabled={!canEdit}
            onDoubleClick={(e) => openFieldOverlay(e.currentTarget, "Wichtige Informationen", true)}
          />
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
        <section
          className="border-t pt-4"
          onFocusCapture={() => setLoadTechnicians(true)}
        >
          <h3 className="mb-2 text-sm font-semibold">Termin planen</h3>
          <AppointmentBookingForm projectId={projectId} technicians={technicians} />

          <ul className="mt-3 space-y-2 text-sm">
            {core.appointments.map((a: Appointment, appointmentIndex: number) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                appointmentIndex={appointmentIndex}
                projectId={projectId}
                technicians={technicians}
                showMontageBadge={appointmentIndex === 0 && p.status === "montagebereit"}
                pending={pending}
                availabilityBundle={reassignAvailabilityBundle}
                reassignAppointment={reassignAppointment}
                deleteAppointment={deleteAppointment}
                confirmationRecipientEmail={
                  canEdit && mailConfigured
                    ? (p.tenantEmail ?? p.managementEmail)
                    : null
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-t pt-4">
        <h3 className="mb-2 text-sm font-semibold">Anhänge</h3>
        {coreQuery.isDetailsLoading ? (
          <div className="flex justify-center py-6" role="status" aria-live="polite">
            <BauflipLoading size="sm" label="Anhänge & Rapporte werden geladen …" />
          </div>
        ) : (
          <>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
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
          <Input
            name="file"
            type="file"
            accept="image/*,application/pdf"
            className="min-h-11 w-full cursor-pointer text-sm sm:max-w-xs"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={uploadAttachment.isPending}
            className="h-11 w-full shrink-0 touch-manipulation sm:h-9 sm:w-auto"
          >
            {uploadAttachment.isPending ? (
              <BauflipLoadingButtonLabel variant="onSurface">Wird hochgeladen …</BauflipLoadingButtonLabel>
            ) : (
              "Hochladen"
            )}
          </Button>
        </form>

        {imageAttachments.length > 0 ? (
          <div
            className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"
            role="list"
            aria-label="Bild-Anhänge"
          >
            {imageAttachments.map((a) => (
              <div
                key={a.id}
                role="listitem"
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted shadow-sm"
              >
                {a.signedUrl ? (
                  <a
                    href={a.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 z-0 block outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                    title={a.fileName}
                    aria-label={`${a.fileName} in neuem Tab öffnen`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.signedUrl} alt={a.fileName} className="size-full object-cover" />
                  </a>
                ) : (
                  <div className="flex size-full items-center justify-center bg-muted/80 p-2 text-center text-[10px] text-muted-foreground">
                    Vorschau nicht verfügbar
                  </div>
                )}
                {canEdit ? (
                  <button
                    type="button"
                    className="absolute right-1 top-1 z-10 flex size-10 touch-manipulation items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-sm transition-opacity hover:bg-black/70 active:scale-95"
                    aria-label={`${a.fileName} löschen`}
                    disabled={pending}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!window.confirm(`„${a.fileName}“ wirklich löschen?`)) return;
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
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {documentAttachments.length > 0 ? (
          <ul className="mt-3 space-y-2" aria-label="Dokument-Anhänge">
            {documentAttachments.map((a) => (
              <li
                key={a.id}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {a.signedUrl ? (
                    <a
                      href={a.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
                      title={a.fileName}
                    >
                      {a.fileName}
                    </a>
                  ) : (
                    <span className="min-w-0 truncate text-sm text-muted-foreground">{a.fileName}</span>
                  )}
                </div>
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-10 shrink-0 touch-manipulation px-3 text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={async () => {
                      if (!window.confirm(`„${a.fileName}“ wirklich löschen?`)) return;
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
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
          </>
        )}
      </section>

      {core.project.warrantyOpenedAt ? (
        <section className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-200">
            <AlertTriangle className="size-4" aria-hidden />
            Garantiefall
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Eröffnet am{" "}
            {new Date(core.project.warrantyOpenedAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}
            {core.project.warrantyOpenedByDisplayName ? ` von ${core.project.warrantyOpenedByDisplayName}` : ""}
          </p>
          {core.project.warrantyNote ? (
            <p className="mt-2 whitespace-pre-wrap text-sm">{core.project.warrantyNote}</p>
          ) : null}
        </section>
      ) : null}

      {!coreQuery.isDetailsLoading && core.reports.length > 0 && (
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
                onEdit={canEdit ? () => setEditReport(r) : undefined}
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

      <ProjektQuotesSection
        projectId={projectId}
        canEdit={canEdit}
        defaultRecipientEmail={core.project.tenantEmail ?? core.project.managementEmail}
        latestReport={
          core.reports.length > 0
            ? core.reports.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b))
            : null
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {editReport ? (
        <TechnicianReportEditOverlay
          key={editReport.id}
          report={editReport}
          projectId={projectId}
          templates={orderFormTemplates}
          onClose={() => setEditReport(null)}
          pending={updateReport.isPending}
          onSubmit={async (payload) => {
            try {
              await updateReport.mutateAsync(payload);
              toast.success("Rapport aktualisiert");
              setEditReport(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
            }
          }}
        />
      ) : null}
      {fieldOverlay ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden overscroll-contain bg-black/40">
          <div className="flex min-h-dvh items-center justify-center px-4 py-8">
            <div className="my-auto w-full max-w-2xl rounded-xl border border-border bg-background p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold">{fieldOverlay.label}</h4>
              <Button type="button" variant="ghost" size="sm" onClick={() => setFieldOverlay(null)}>
                Schliessen
              </Button>
            </div>
            {fieldOverlay.multiline ? (
              <Textarea
                rows={12}
                value={fieldOverlay.value}
                disabled={!canEdit}
                onChange={(e) => setFieldOverlay((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
              />
            ) : (
              <Input
                value={fieldOverlay.value}
                disabled={!canEdit}
                onChange={(e) => setFieldOverlay((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
              />
            )}
            {canEdit ? (
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setFieldOverlay(null)}>
                  Abbrechen
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const target = fieldOverlay.target;
                    target.value = fieldOverlay.value;
                    target.dispatchEvent(new Event("input", { bubbles: true }));
                    setFieldOverlay(null);
                  }}
                >
                  Übernehmen
                </Button>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
