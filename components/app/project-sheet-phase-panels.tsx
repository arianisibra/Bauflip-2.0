"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import Link from "next/link";
import { CalendarClock, ChevronDown, Download, FileText, Plus, Trash2 } from "lucide-react";
import {
  addAppointmentAction,
  addInvoiceAction,
  addProjectNoteAction,
  finalizeProjectDocumentAction,
  deleteDraftQuoteAction,
  deleteDraftInvoiceAction,
  deleteAppointmentAction,
} from "@/app/(app)/actions";
import type { getProjectSheetDataAction } from "@/app/(app)/projekte/actions";
import { BAUFLIP_ZAPIER_EVENTS } from "@/lib/integrations/zapier-events";
import { PROJECT_WORKFLOW_STEPS } from "@/lib/workflow/project-workflow-rail";
import { VoiceTextarea } from "@/components/app/voice-textarea";
import { QuoteDraftForm } from "@/components/app/quote-draft-form";
import { GuidedPhaseSection } from "@/components/app/guided-phase-section";
import { TechnicianReportForm } from "@/components/app/technician-report-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";


type SheetPayload = Awaited<ReturnType<typeof getProjectSheetDataAction>>;

type ProjectSheetPhasePanelsProps = {
  phaseIndex: number;
  currentPhaseIndex: number;
  canEdit: boolean;
  actorRole: "admin" | "office" | "technician";
  bundle: SheetPayload["bundle"];
  reportAttachments: Array<
    SheetPayload["reportAttachments"][number]
  >;
  profiles: SheetPayload["profiles"];
  supplierTemplates: SheetPayload["supplierTemplates"];
  articles: SheetPayload["articles"];
  outcomeOptions: SheetPayload["outcomeOptions"];
  locationOptions: SheetPayload["locationOptions"];
  /** Aus organisations.zapier_enabled — Hinweis zu Webhooks / bexio in Offerten- und Rechnungsphase. */
  integrationZapierEnabled?: boolean;
  onAfterMutation: () => void | Promise<void>;
};

const REPORT_OUTCOME_LABEL: Record<string, string> = {
  direkt_geloest: "Direkt gelöst",
  ersatzteil_noetig: "Ersatzteil nötig",
  werkstatt_noetig: "Werkstatt nötig",
  vollersatz_noetig: "Komplettersatz nötig",
};

function ZapierBexioSyncHint({
  enabled,
  variant,
  bexioContactId,
}: {
  enabled: boolean;
  variant: "quote" | "invoice";
  bexioContactId?: string | null;
}) {
  if (!enabled) {
    return null;
  }
  const hasBexio = Boolean(bexioContactId?.trim());
  const mono = "font-mono text-[11px] text-sky-950";
  const code = (s: string) => (
    <code className="rounded bg-sky-100/90 px-1 py-0.5 font-mono text-[11px] text-sky-950">{s}</code>
  );

  const shell = (body: ReactNode) => (
    <details className="group rounded-md border border-sky-200 bg-sky-50/90 text-xs text-sky-950 open:border-sky-300/90">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 select-none outline-none marker:hidden [&::-webkit-details-marker]:hidden hover:bg-sky-100/50">
        <span className="font-medium text-sky-900">Zapier / bexio</span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-sky-200/80 bg-white/60 px-2 py-0.5 text-[10px] font-medium text-sky-800">
          Details
          <ChevronDown className="size-3.5 text-sky-600 transition-transform duration-200 group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="border-t border-sky-200/80 px-3 pb-3 pt-2">{body}</div>
    </details>
  );

  if (variant === "quote") {
    return shell(
      <>
        <p className="leading-relaxed text-sky-900/90">
          <span className="font-medium text-sky-950">Ablauf:</span> In BauFlip erfassen Sie Kontakt und Positionen. Der Zap
          legt in <span className="font-medium text-sky-950">bexio</span> ein <span className="font-medium text-sky-950">Angebot als Entwurf</span>{" "}
          an (oder gleichwertige bexio-Aktion). Briefanrede, Fließtexte und feine Konditionen tragen Sie anschliessend in{" "}
          <span className="font-medium text-sky-950">bexio</span> nach — nicht im BauFlip-Formular.
        </p>
        <p className="mt-2 leading-relaxed text-sky-900/90">
          Webhooks nur wenn Zapier unter{" "}
          <Link href="/integrationen" className="font-medium text-sky-950 underline underline-offset-2 hover:text-sky-800">
            Integrationen
          </Link>{" "}
          aktiv ist. Pro Aufruf: JSON mit <span className={mono}>eventType</span> (Header{" "}
          <span className={mono}>X-Bauflip-Event</span>) und <span className={mono}>payload</span> für Ihren Zap.
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 leading-relaxed text-sky-900/90">
          <li>
            <span className="font-medium text-sky-950">Offerte speichern und finalisieren:</span> jeweils{" "}
            {code(BAUFLIP_ZAPIER_EVENTS.QUOTE_CREATED)} — Zapier filtert nur dieses Event. Beim Speichern ohne PDF: kein{" "}
            <span className={mono}>pdfPath</span>; nach «Finalisieren (bexio)» enthält der Payload zusätzlich{" "}
            <span className={mono}>pdfPath</span>, <span className={mono}>deliveryChannel</span>, <span className={mono}>quoteId</span>
            , Positionen, Totale.
          </li>
        </ul>
        <p className="mt-2 leading-relaxed text-sky-900/90">
          Für bexio: <span className={mono}>bexioContactIdNumeric</span> wenn ID gepflegt; zusätzlich{" "}
          <span className={mono}>contactName</span>, <span className={mono}>contactEmail</span> für «Kontakt suchen»,
          falls die ID nicht zieht.
        </p>
        <p className="mt-1 leading-relaxed text-sky-900/90">
          BauFlip erzeugt ein PDF für die Akte; Kundenanschrift und Versand der Offerte steuern Sie in bexio über den Zap.
        </p>
        {hasBexio ? (
          <p className="mt-2 rounded border border-emerald-200/80 bg-emerald-50/80 px-2 py-1.5 text-emerald-950">
            Kontakt: bexio-ID hinterlegt — Webhook enthält <span className={mono}>bexioContactIdNumeric</span>.
          </p>
        ) : (
          <p className="mt-2 rounded border border-amber-200/80 bg-amber-50/80 px-2 py-1.5 text-amber-950">
            Kontakt: keine bexio-ID — im Kontakt «bexio Kontakt-ID» eintragen, damit Zapier den bexio-Kunden zuordnen kann.
          </p>
        )}
      </>,
    );
  }

  return shell(
    <>
      <p className="leading-relaxed text-sky-900/90">
        <span className="font-medium text-sky-950">Ablauf:</span> In BauFlip bereiten Sie die Rechnung vor (Positionen kommen aus
        der letzten Offerte). Der Zap legt in <span className="font-medium text-sky-950">bexio</span> eine{" "}
        <span className="font-medium text-sky-950">Rechnung als Entwurf</span> an (oder gleichwertige bexio-Aktion). Texte, Versand
        an den Kunden und Zahlungslauf steuern Sie in <span className="font-medium text-sky-950">bexio</span> — nicht per E-Mail aus
        BauFlip.
      </p>
      <p className="mt-2 leading-relaxed text-sky-900/90">
        Webhooks nur wenn Zapier unter{" "}
        <Link href="/integrationen" className="font-medium text-sky-950 underline underline-offset-2 hover:text-sky-800">
          Integrationen
        </Link>{" "}
        aktiv ist. Pro Aufruf: JSON mit <span className={mono}>eventType</span> (Header{" "}
        <span className={mono}>X-Bauflip-Event</span>) und <span className={mono}>payload</span> für Ihren Zap.
      </p>
      <ul className="mt-2 list-disc space-y-1.5 pl-4 leading-relaxed text-sky-900/90">
        <li>
          <span className="font-medium text-sky-950">Rechnung vorbereiten und finalisieren:</span> jeweils{" "}
          {code(BAUFLIP_ZAPIER_EVENTS.INVOICE_CREATED)} — Zapier filtert nur dieses Event. Beim Vorbereiten ohne PDF: kein{" "}
          <span className={mono}>pdfPath</span>; nach «Finalisieren (bexio)» enthält der Payload zusätzlich{" "}
          <span className={mono}>pdfPath</span>, <span className={mono}>deliveryChannel</span>, <span className={mono}>invoiceId</span>,{" "}
          <span className={mono}>invoiceNumber</span>, Positionen (letzte Offerte), Totale.
        </li>
      </ul>
      <p className="mt-2 leading-relaxed text-sky-900/90">
        Für bexio: <span className={mono}>bexioContactIdNumeric</span> wenn ID gepflegt; zusätzlich{" "}
        <span className={mono}>contactName</span>, <span className={mono}>contactEmail</span> für «Kontakt suchen», falls die ID nicht
        zieht.
      </p>
      <p className="mt-1 leading-relaxed text-sky-900/90">
        BauFlip erzeugt ein PDF für die Akte; den formalen Projektabschluss lösen Sie im geführten Prozess aus, wenn die Rechnung in
        bexio versandt ist (wie Freigabe nach der Offerte).
      </p>
      {hasBexio ? (
        <p className="mt-2 rounded border border-emerald-200/80 bg-emerald-50/80 px-2 py-1.5 text-emerald-950">
          Kontakt: bexio-ID hinterlegt — Webhook enthält <span className={mono}>bexioContactIdNumeric</span>.
        </p>
      ) : (
        <p className="mt-2 rounded border border-amber-200/80 bg-amber-50/80 px-2 py-1.5 text-amber-950">
          Kontakt: keine bexio-ID — im Kontakt «bexio Kontakt-ID» eintragen, damit Zapier den bexio-Kunden zuordnen kann.
        </p>
      )}
    </>,
  );
}

export function ProjectSheetPhasePanels({
  phaseIndex,
  currentPhaseIndex,
  canEdit,
  actorRole,
  bundle,
  reportAttachments,
  profiles,
  supplierTemplates,
  articles,
  outcomeOptions,
  locationOptions,
  integrationZapierEnabled = false,
  onAfterMutation,
}: ProjectSheetPhasePanelsProps) {
  const technicians = profiles.filter((p) => p.role === "technician");
  const technicianById = new Map(technicians.map((t) => [t.id, t]));
  const besichtigungAppointments = bundle.appointments.filter((a) => a.kind === "besichtigung");
  const ausfuehrungAppointments = bundle.appointments.filter((a) => a.kind === "ausfuehrung");
  const needsBesichtigungAppointment = besichtigungAppointments.length === 0;
  const needsAusfuehrungAppointment = ausfuehrungAppointments.length === 0;
  const latestReport = bundle.reports.at(-1) ?? null;
  const latestQuote = bundle.quotes.at(-1) ?? null;
  const latestInvoice = bundle.invoices.at(-1) ?? null;
  const latestOrder = bundle.orders.at(-1) ?? null;
  const supplierSubmissions = bundle.supplierSubmissions ?? [];
  const supplierNameById = new Map(
    supplierTemplates.map((template) => [template.supplierId, template.supplierName] as const),
  );
  const supplierTemplateById = new Map(
    supplierTemplates.map((template) => [template.id, template] as const),
  );
  const canDownloadSupplierFormPdf = actorRole === "admin" || actorRole === "office";
  const mutationsLocked = !canEdit || phaseIndex < currentPhaseIndex;
  const mutationLockReason = !canEdit
    ? `Ihre Rolle (${actorRole}) darf diesen Schritt nicht bearbeiten.`
    : "Dieser Schritt ist bereits abgeschlossen. Für Korrekturen zuerst den aktuellen Schritt öffnen.";

  const submitAppointment = async (fd: FormData) => {
    if (mutationsLocked) {
      window.alert(mutationLockReason);
      return;
    }
    try {
      await addAppointmentAction(fd);
      await onAfterMutation();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Termin konnte nicht gespeichert werden.");
    }
  };
  const submitFinalizeDocument = async (fd: FormData) => {
    if (mutationsLocked) {
      window.alert(mutationLockReason);
      return;
    }
    try {
      await finalizeProjectDocumentAction(fd);
      await onAfterMutation();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Dokument konnte nicht finalisiert werden.");
    }
  };
  const submitDeleteDraftQuote = async (fd: FormData) => {
    if (mutationsLocked) {
      window.alert(mutationLockReason);
      return;
    }
    const finalized = String(fd.get("quoteFinalized") ?? "") === "1";
    const confirmMsg = finalized
      ? "Diese Offertenversion wirklich löschen? PDF und Positionen in BauFlip werden entfernt. In bexio angelegte Dokumente bleiben unverändert."
      : "Diesen Offerten-Entwurf wirklich löschen?";
    if (!window.confirm(confirmMsg)) {
      return;
    }
    try {
      const next = new FormData();
      next.set("projectId", String(fd.get("projectId") ?? ""));
      next.set("quoteId", String(fd.get("quoteId") ?? ""));
      await deleteDraftQuoteAction(next);
      await onAfterMutation();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Offerte konnte nicht gelöscht werden.");
    }
  };
  const submitDeleteDraftInvoice = async (fd: FormData) => {
    if (mutationsLocked) {
      window.alert(mutationLockReason);
      return;
    }
    const finalized = String(fd.get("invoiceFinalized") ?? "") === "1";
    const confirmMsg = finalized
      ? "Diese Rechnung wirklich löschen? PDF in BauFlip wird entfernt. In bexio angelegte Rechnungen bleiben unverändert."
      : "Diesen Rechnungs-Entwurf wirklich löschen?";
    if (!window.confirm(confirmMsg)) {
      return;
    }
    try {
      const next = new FormData();
      next.set("projectId", String(fd.get("projectId") ?? ""));
      next.set("invoiceId", String(fd.get("invoiceId") ?? ""));
      await deleteDraftInvoiceAction(next);
      await onAfterMutation();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Rechnung konnte nicht gelöscht werden.");
    }
  };
  if (phaseIndex === 0) {
    return null;
  }

  switch (phaseIndex) {
    case 1:
      return (
        <GuidedPhaseSection id="termin" phaseIndex={1} currentPhaseIndex={currentPhaseIndex}>
          <div className="space-y-4">
            {mutationsLocked ? <MutationLockedNotice message={mutationLockReason} /> : null}
            <PhaseHeader workflowStepIndex={1} />
            <PhaseControlCard
              rows={[
                {
                  label: "Besichtigungstermine",
                  value: besichtigungAppointments.length > 0 ? `${besichtigungAppointments.length} erfasst` : "Fehlt",
                },
                {
                  label: "Nächster Besitzer",
                  value: "Monteur",
                },
              ]}
            />
            <Card>
              <CardHeader>
                <CardTitle>Besichtigungstermin</CardTitle>
                <CardDescription>
                  Termin mit Kunden vereinbaren. Büro organisiert, Monteur erhält Benachrichtigung / Kalendereintrag.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <form
                  action={submitAppointment}
                  className={cn(
                    "grid gap-2 rounded-md border p-4 sm:grid-cols-2",
                    needsBesichtigungAppointment && "border-destructive/60 bg-destructive/5",
                  )}
                >
                  <input type="hidden" name="projectId" value={bundle.project.id} />
                  <input type="hidden" name="kind" value="besichtigung" />
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label
                      htmlFor="sh-bes-start"
                      className={cn("text-sm", needsBesichtigungAppointment && "font-semibold text-destructive")}
                    >
                      Beginn
                    </Label>
                    <DateTimeInput
                      id="sh-bes-start"
                      name="startsAt"
                      required
                      className={needsBesichtigungAppointment ? "border-destructive/60" : undefined}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor="sh-bes-end"
                      className={cn("text-sm", needsBesichtigungAppointment && "font-semibold text-destructive")}
                    >
                      Ende
                    </Label>
                    <DateTimeInput
                      id="sh-bes-end"
                      name="endsAt"
                      required
                      className={needsBesichtigungAppointment ? "border-destructive/60" : undefined}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Planungsnotiz</Label>
                    <VoiceTextarea name="planningNotes" placeholder="z. B. Zugang via Hauswart" />
                  </div>
                  <TechnicianSelectField
                    id="sh-bes-technician"
                    name="assignedTechnicianId"
                    technicians={technicians}
                    highlightMissing={needsBesichtigungAppointment}
                  />
                  <div className="sm:col-span-2">
                    <Button type="submit" size="sm" disabled={mutationsLocked}>
                      Besichtigungstermin speichern
                    </Button>
                  </div>
                  {needsBesichtigungAppointment ? (
                    <p className="sm:col-span-2 text-xs font-medium text-destructive">
                      Für «Weiter» müssen Beginn, Ende und Monteur gesetzt werden.
                    </p>
                  ) : null}
                </form>

                {besichtigungAppointments.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {besichtigungAppointments.map((a) => (
                      <div key={a.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                        <p className="font-medium">
                          Beginn: {formatDateTime(a.startsAt)}
                          {" · "}
                          Ende: {formatDateTime(a.endsAt)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Monteur:{" "}
                          {a.assignedTechnicianId
                            ? (technicianById.get(a.assignedTechnicianId)?.displayName ?? "Zugewiesen")
                            : "Nicht zugewiesen"}
                        </p>
                        {a.planningNotes ? <p className="mt-1 text-xs text-muted-foreground">Notiz: {a.planningNotes}</p> : null}
                        <form
                          action={async (fd) => {
                            await deleteAppointmentAction(fd);
                            await onAfterMutation();
                          }}
                          className="mt-2"
                        >
                          <input type="hidden" name="appointmentId" value={a.id} />
                          <input type="hidden" name="projectId" value={bundle.project.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="h-7 border-red-200 px-2 text-xs text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              const ok = window.confirm("Termin wirklich löschen?");
                              if (!ok) {
                                e.preventDefault();
                              }
                            }}
                          >
                            Termin löschen
                          </Button>
                        </form>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Noch kein Besichtigungstermin erfasst.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </GuidedPhaseSection>
      );

    case 2:
      return (
        <GuidedPhaseSection id="rapport" phaseIndex={2} currentPhaseIndex={currentPhaseIndex}>
          <div className="space-y-4">
            {mutationsLocked ? <MutationLockedNotice message={mutationLockReason} /> : null}
            <PhaseHeader workflowStepIndex={2} />
            <PhaseControlCard
              rows={[
                {
                  label: "Rapporte",
                  value: bundle.reports.length > 0 ? `${bundle.reports.length} erfasst` : "Fehlt",
                },
                {
                  label: "Letzter Rapport",
                  value: latestReport ? formatDateTime(latestReport.createdAt) : "Noch keiner",
                },
              ]}
            />
            <Card>
              <CardHeader>
                <CardTitle>Monteurbericht</CardTitle>
                <CardDescription>
                  Monteur erfasst Diagnose, Masse und Entscheid vor Ort. Grundlage für Offerte und Bestellung.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Aktions-Buttons */}
                {mutationsLocked ? null : (
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/rapporte/neu/${bundle.project.id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <Plus className="size-4" />
                      Neuen Rapport erstellen
                    </a>
                  </div>
                )}

                {/* Hochgeladene Rapport-Dateien */}
                {reportAttachments.length > 0 ? (
                  <div className="rounded-md border p-3">
                    <p className="mb-2 text-sm font-medium">Rapport-Dateien</p>
                    <ul className="flex flex-col gap-1 text-sm">
                      {reportAttachments.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-2">
                          {a.href ? (
                            <a
                              href={a.href}
                              className="truncate text-primary underline-offset-4 hover:underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {a.fileName}
                            </a>
                          ) : (
                            <span className="truncate text-muted-foreground">{a.fileName}</span>
                          )}
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Erfasste Rapporte */}
                {bundle.reports.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Erfasste Rapporte ({bundle.reports.length})</p>
                    {bundle.reports.map((report) => (
                      <div key={report.id} className="flex items-start justify-between gap-3 rounded-md border bg-muted/20 p-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{REPORT_OUTCOME_LABEL[report.outcome] ?? report.outcome}</p>
                          {report.summary ? <p className="mt-0.5 truncate text-muted-foreground">{report.summary}</p> : null}
                          <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(report.createdAt)}</p>
                        </div>
                        <a
                          href={`/rapporte/${report.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                          title="PDF herunterladen"
                        >
                          <Download className="size-3.5" />
                          PDF
                        </a>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

          </div>
        </GuidedPhaseSection>
      );

    case 3:
      return (
        <GuidedPhaseSection id="offerte" phaseIndex={3} currentPhaseIndex={currentPhaseIndex}>
          <div className="space-y-4">
            {mutationsLocked ? <MutationLockedNotice message={mutationLockReason} /> : null}
            <ZapierBexioSyncHint
              enabled={integrationZapierEnabled}
              variant="quote"
              bexioContactId={bundle.contact?.bexioContactId ?? null}
            />
            <PhaseHeader workflowStepIndex={3} />
            <PhaseControlCard
              rows={[
                {
                  label: "Offerten",
                  value: bundle.quotes.length > 0 ? `${bundle.quotes.length} Version(en)` : "Fehlt",
                },
                {
                  label: "Letzter Versand",
                  value: latestQuote?.deliverySentAt ? formatDateTime(latestQuote.deliverySentAt) : "Noch nicht versendet",
                },
                {
                  label: "Empfänger",
                  value:
                    latestQuote?.deliveryChannel === "bexio"
                      ? "über bexio (kein Mail aus BauFlip)"
                      : (latestQuote?.deliveryRecipient ?? "Kein Empfänger protokolliert"),
                },
              ]}
            />
            <Card className="h-full min-h-0">
                <CardHeader>
                  <CardTitle>Offerte erstellen</CardTitle>
                  <CardDescription>
                    {integrationZapierEnabled
                      ? "Kontakt und Positionen für den bexio-Entwurf; feine Texte, Versand und Konditionen in bexio."
                      : "Basierend auf Monteur-Rapport. Material + Arbeit."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                  {mutationsLocked ? null : (
                    <QuoteDraftForm
                      projectId={bundle.project.id}
                      suggestedVersion={(bundle.quotes?.length ?? 0) + 1}
                      articleOptions={articles}
                      bexioDraftMode={integrationZapierEnabled}
                      className="flex min-h-0 flex-1 flex-col gap-2 rounded-md border p-3"
                      onSuccess={onAfterMutation}
                    />
                  )}
                  {bundle.quotes.length > 0 ? (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {bundle.quotes.map((q) => (
                        <div key={q.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span>Version {q.version}</span>
                            <div className="flex shrink-0 items-center gap-2">
                              <form action={submitDeleteDraftQuote}>
                                <input type="hidden" name="projectId" value={bundle.project.id} />
                                <input type="hidden" name="quoteId" value={q.id} />
                                <input type="hidden" name="quoteFinalized" value={q.finalizedAt ? "1" : "0"} />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  disabled={mutationsLocked}
                                  title={q.finalizedAt ? "Version löschen" : "Entwurf löschen"}
                                >
                                  <Trash2 className="size-3.5" aria-hidden />
                                  Löschen
                                </Button>
                              </form>
                              <span className="text-xs text-muted-foreground capitalize">
                                {q.status}
                                {q.deliveryChannel ? ` · ${q.deliveryChannel}` : ""}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {q.finalizedAt
                                ? `Finalisiert: ${formatDateTime(q.finalizedAt)}`
                                : "Noch nicht finalisiert"}
                              {q.deliverySentAt ? ` · Versand: ${formatDateTime(q.deliverySentAt)}` : ""}
                              {q.deliveryRecipient ? ` · Empfänger: ${q.deliveryRecipient}` : ""}
                            </p>
                            {integrationZapierEnabled ? (
                              <form
                                action={submitFinalizeDocument}
                                className="flex flex-col gap-2 rounded-md border border-sky-200 bg-sky-50/60 p-3"
                              >
                                <input type="hidden" name="projectId" value={bundle.project.id} />
                                <input type="hidden" name="documentType" value="quote" />
                                <input type="hidden" name="documentId" value={q.id} />
                                <input type="hidden" name="deliveryChannel" value="bexio" />
                                <p className="text-xs text-sky-950">
                                  PDF für die Akte erzeugen und Daten an Zapier senden. Kundenversand nur in bexio — nicht per
                                  E-Mail aus BauFlip.
                                </p>
                                <Button type="submit" size="sm" className="h-9 w-full sm:w-auto" disabled={mutationsLocked}>
                                  Finalisieren (bexio)
                                </Button>
                              </form>
                            ) : (
                              <>
                                <form action={submitFinalizeDocument} className="flex items-center gap-2">
                                  <input type="hidden" name="projectId" value={bundle.project.id} />
                                  <input type="hidden" name="documentType" value="quote" />
                                  <input type="hidden" name="documentId" value={q.id} />
                                  <input type="hidden" name="deliveryChannel" value="post" />
                                  <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={mutationsLocked}>
                                    Per Post finalisieren
                                  </Button>
                                  <span className="text-xs text-muted-foreground">Kein Mailversand</span>
                                </form>
                                <form action={submitFinalizeDocument} className="rounded-md border bg-background p-2">
                                  <input type="hidden" name="projectId" value={bundle.project.id} />
                                  <input type="hidden" name="documentType" value="quote" />
                                  <input type="hidden" name="documentId" value={q.id} />
                                  <input type="hidden" name="deliveryChannel" value="email" />
                                  <div className="grid gap-1">
                                    <Input
                                      name="emailTo"
                                      defaultValue={bundle.contact?.email ?? ""}
                                      placeholder="kunde@beispiel.ch"
                                      className="h-8 text-xs"
                                    />
                                    <Input
                                      name="emailCc"
                                      placeholder="cc@beispiel.ch, team@firma.ch (optional)"
                                      className="h-8 text-xs"
                                    />
                                    <Input
                                      name="emailBcc"
                                      placeholder="bcc@beispiel.ch (optional)"
                                      className="h-8 text-xs"
                                    />
                                    <Input
                                      name="emailSubject"
                                      defaultValue={`Offerte ${bundle.project.title}`}
                                      className="h-8 text-xs"
                                    />
                                    <VoiceTextarea
                                      name="emailHtml"
                                      defaultValue="<p>Guten Tag</p><p>Besten Dank für Ihre Anfrage.</p><p>Im Anhang erhalten Sie die Offerte als PDF.</p><p>Bei Fragen sind wir gerne für Sie da.</p><p>Freundliche Grüsse<br/>Ihr Bauflip Team</p>"
                                    />
                                    <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={mutationsLocked}>
                                      Per E-Mail finalisieren
                                    </Button>
                                  </div>
                                </form>
                              </>
                            )}
                            {q.pdfPath ? (
                              <a
                                href={`/api/project-documents/quote/${q.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                              >
                                PDF öffnen
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
          </div>
        </GuidedPhaseSection>
      );

    case 4:
      return (
        <GuidedPhaseSection id="bestellung" phaseIndex={4} currentPhaseIndex={currentPhaseIndex}>
          <div className="space-y-4">
            {mutationsLocked ? <MutationLockedNotice message={mutationLockReason} /> : null}
            <PhaseHeader workflowStepIndex={4} />
            <PhaseControlCard
              rows={[
                {
                  label: "Bestellungen",
                  value: bundle.orders.length > 0 ? `${bundle.orders.length} erfasst` : "Fehlt",
                },
                {
                  label: "Bestellformulare",
                  value: supplierSubmissions.length > 0 ? `${supplierSubmissions.length} erfasst` : "Fehlt",
                },
                {
                  label: "Letzte Bestellung",
                  value: latestOrder ? formatDateTime(latestOrder.createdAt) : "Noch keine",
                },
              ]}
            />
            <Card>
                <CardHeader>
                  <CardTitle>Lieferanten-Bestellung</CardTitle>
                  <CardDescription>
                    Vom Monteur erfasste Bestellformulare zu diesem Projekt. Bestellung und Versand an den Lieferant erfolgen
                    ausserhalb von BauFlip (manuell).
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {/* Review existing submissions */}
                  {supplierSubmissions.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Erfasste Bestellformulare ({supplierSubmissions.length})</p>
                      {supplierSubmissions.map((sub) => {
                        const tmpl = supplierTemplateById.get(sub.templateId);
                        let vals: Record<string, string> = {};
                        try {
                          const parsed = JSON.parse(sub.valuesJson ?? "{}") as Record<string, unknown>;
                          vals = Object.fromEntries(
                            Object.entries(parsed).map(([k, v]) => [k, String(v ?? "").trim()]),
                          );
                        } catch {
                          vals = {};
                        }
                        const entries = Object.entries(vals).filter(([, v]) => v.length > 0);
                        return (
                          <div key={sub.id} className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 font-medium text-foreground">
                                {tmpl?.supplierName ?? "Lieferant"} · {vals.titel ?? tmpl?.name ?? "Formular"}
                              </p>
                              <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
                                {canDownloadSupplierFormPdf ? (
                                  <a
                                    href={`/api/supplier-submissions/${sub.id}/pdf`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-primary hover:bg-accent"
                                    title="PDF im Browser öffnen (speichern über Drucken / Download)"
                                  >
                                    <FileText className="size-3 shrink-0" aria-hidden />
                                    PDF
                                  </a>
                                ) : null}
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                                    sub.status === "eingereicht"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-amber-100 text-amber-800",
                                  )}
                                >
                                  {sub.status}
                                </span>
                              </div>
                            </div>
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">ID {sub.id}</p>
                            <p className="mt-0.5 text-muted-foreground">{formatDateTime(sub.createdAt)}</p>
                            {entries.length > 0 ? (
                              <div className="mt-1 space-y-0.5 text-muted-foreground">
                                {entries
                                  .filter(([k]) => k !== "titel")
                                  .map(([key, value]) => {
                                    const fieldDef = tmpl?.fieldDefinitions?.find((f) => f.key === key);
                                    return (
                                      <p key={`${sub.id}-${key}`}>
                                        <span className="font-medium text-foreground">{fieldDef?.label ?? key}:</span> {value}
                                      </p>
                                    );
                                  })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Noch keine Bestellformulare vom Monteur erfasst.</p>
                  )}

                  {/* Purchase orders */}
                  {bundle.orders.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {bundle.orders.map((o) => (
                        <div key={o.id} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
                          <span>Lieferant: {supplierNameById.get(o.supplierId) ?? o.supplierId}</span>
                          <span className="text-xs text-muted-foreground capitalize">{o.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
          </div>
        </GuidedPhaseSection>
      );

    case 5:
      return (
        <GuidedPhaseSection id="ausfuehrung" phaseIndex={5} currentPhaseIndex={currentPhaseIndex}>
          <div className="space-y-4">
            {mutationsLocked ? <MutationLockedNotice message={mutationLockReason} /> : null}
            <PhaseHeader workflowStepIndex={5} />
            <PhaseControlCard
              rows={[
                {
                  label: "Ausführungstermine",
                  value: ausfuehrungAppointments.length > 0 ? `${ausfuehrungAppointments.length} erfasst` : "Fehlt",
                },
                {
                  label: "Nächster Besitzer",
                  value: "Monteur",
                },
              ]}
            />
            <Card>
              <CardHeader>
                <CardTitle>2. Termin planen</CardTitle>
                <CardDescription>Büro organisiert Fertigstellungstermin.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <form
                  action={submitAppointment}
                  className={cn(
                    "grid gap-2 rounded-md border p-4 sm:grid-cols-2",
                    needsAusfuehrungAppointment && "border-destructive/60 bg-destructive/5",
                  )}
                >
                  <input type="hidden" name="projectId" value={bundle.project.id} />
                  <input type="hidden" name="kind" value="ausfuehrung" />
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label className={cn("text-sm", needsAusfuehrungAppointment && "font-semibold text-destructive")}>Beginn</Label>
                    <DateTimeInput name="startsAt" required className={needsAusfuehrungAppointment ? "border-destructive/60" : undefined} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className={cn("text-sm", needsAusfuehrungAppointment && "font-semibold text-destructive")}>Ende</Label>
                    <DateTimeInput name="endsAt" required className={needsAusfuehrungAppointment ? "border-destructive/60" : undefined} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Zugang / Hinweise</Label>
                    <VoiceTextarea name="accessNotes" placeholder="Schlüssel, Anwesenheit …" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Planungsnotiz</Label>
                    <VoiceTextarea name="planningNotes" placeholder="Zeitaufwand, besondere Vorbereitungen …" />
                  </div>
                  <TechnicianSelectField
                    id="sh-aus-technician"
                    name="assignedTechnicianId"
                    technicians={technicians}
                    highlightMissing={needsAusfuehrungAppointment}
                  />
                  <div className="sm:col-span-2">
                    <Button type="submit" size="sm" disabled={mutationsLocked}>
                      Ausführungstermin speichern
                    </Button>
                  </div>
                  {needsAusfuehrungAppointment ? (
                    <p className="sm:col-span-2 text-xs font-medium text-destructive">
                      Für «Weiter» müssen Beginn, Ende und Monteur gesetzt werden.
                    </p>
                  ) : null}
                </form>

                {ausfuehrungAppointments.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {ausfuehrungAppointments.map((a) => (
                      <div key={a.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                        <p className="font-medium">
                          Beginn: {formatDateTime(a.startsAt)}
                          {" · "}
                          Ende: {formatDateTime(a.endsAt)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Monteur:{" "}
                          {a.assignedTechnicianId
                            ? (technicianById.get(a.assignedTechnicianId)?.displayName ?? "Zugewiesen")
                            : "Nicht zugewiesen"}
                        </p>
                        {a.planningNotes ? <p className="mt-1 text-xs text-muted-foreground">Notiz: {a.planningNotes}</p> : null}
                        {a.accessNotes ? <p className="mt-1 text-xs text-muted-foreground">Zugang: {a.accessNotes}</p> : null}
                        <form
                          action={async (fd) => {
                            await deleteAppointmentAction(fd);
                            await onAfterMutation();
                          }}
                          className="mt-2"
                        >
                          <input type="hidden" name="appointmentId" value={a.id} />
                          <input type="hidden" name="projectId" value={bundle.project.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="h-7 border-red-200 px-2 text-xs text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              const ok = window.confirm("Termin wirklich löschen?");
                              if (!ok) {
                                e.preventDefault();
                              }
                            }}
                          >
                            Termin löschen
                          </Button>
                        </form>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Noch kein Ausführungstermin erfasst.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </GuidedPhaseSection>
      );

    case 6:
      return (
        <GuidedPhaseSection id="fertigmeldung" phaseIndex={6} currentPhaseIndex={currentPhaseIndex}>
          <div className="space-y-4">
            {mutationsLocked ? <MutationLockedNotice message={mutationLockReason} /> : null}
            <PhaseHeader workflowStepIndex={6} />
            <PhaseControlCard
              rows={[
                {
                  label: "Fertigmeldungen/Rapporte",
                  value: bundle.reports.length > 0 ? `${bundle.reports.length} vorhanden` : "Fehlt",
                },
                {
                  label: "Interne Notizen",
                  value: bundle.notes.length > 0 ? `${bundle.notes.length} Eintrag/Einträge` : "Noch keine",
                },
              ]}
            />
            <div className="grid gap-4 2xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Fertigmeldung</CardTitle>
                  <CardDescription>Monteur meldet Arbeit als erledigt.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {mutationsLocked ? null : (
                    <TechnicianReportForm
                      projectId={bundle.project.id}
                      variant="fertigmeldung"
                      className="flex flex-col gap-3 rounded-md border p-3"
                      submitLabel="Fertigmeldung speichern"
                      onSuccess={onAfterMutation}
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notizen</CardTitle>
                  <CardDescription>Handoffs bleiben nur sauber, wenn Notizen aktuell sind.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <form
                    action={async (fd) => {
                      if (mutationsLocked) {
                        window.alert(mutationLockReason);
                        return;
                      }
                      await addProjectNoteAction(fd);
                      await onAfterMutation();
                    }}
                    className="flex flex-col gap-2 rounded-md border p-3"
                  >
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label className="text-sm">Typ</Label>
                    <Input name="type" defaultValue="techniker" placeholder="techniker / intern / planung" className="h-9" />
                    <Label className="text-sm">Notiz</Label>
                    <VoiceTextarea name="body" required />
                    <Button type="submit" size="sm" disabled={mutationsLocked}>
                      Notiz speichern
                    </Button>
                  </form>
                  {bundle.notes.length > 0 ? (
                    <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
                      {bundle.notes.map((note) => (
                        <div key={note.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                          <span className="font-medium capitalize">{note.type}</span>
                          <p className="mt-0.5">{note.body}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </GuidedPhaseSection>
      );

    case 7:
      return (
        <GuidedPhaseSection id="rechnung" phaseIndex={7} currentPhaseIndex={currentPhaseIndex}>
          <div className="space-y-4">
            {mutationsLocked ? <MutationLockedNotice message={mutationLockReason} /> : null}
            <ZapierBexioSyncHint
              enabled={integrationZapierEnabled}
              variant="invoice"
              bexioContactId={bundle.contact?.bexioContactId ?? null}
            />
            <PhaseHeader workflowStepIndex={7} />
            <PhaseControlCard
              rows={[
                {
                  label: "Rechnungen",
                  value: bundle.invoices.length > 0 ? `${bundle.invoices.length} erfasst` : "Fehlt",
                },
                {
                  label: "Letzter Versand",
                  value: latestInvoice?.deliverySentAt ? formatDateTime(latestInvoice.deliverySentAt) : "Noch nicht versendet",
                },
                {
                  label: "Empfänger",
                  value:
                    latestInvoice?.deliveryChannel === "bexio"
                      ? "über bexio (kein Mail aus BauFlip)"
                      : (latestInvoice?.deliveryRecipient ?? "Kein Empfänger protokolliert"),
                },
              ]}
            />
            <p className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Abschluss:</span> Nach Finalisierung bleibt das Projekt auf Status{" "}
              «Rechnung». Wenn die Rechnung in bexio versandt ist, schliessen Sie das Projekt im{" "}
              <span className="font-medium text-foreground">geführten Prozess</span> ab (wie die Kundenfreigabe nach der Offerte).
            </p>
            <Card>
                <CardHeader>
                  <CardTitle>Rechnung</CardTitle>
                  <CardDescription>
                    {integrationZapierEnabled
                      ? "Rechnung vorbereiten; Versand und Zahlungslauf in bexio über den Zap."
                      : "Rechnung erstellen und versenden."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <form
                    action={async (fd) => {
                      if (mutationsLocked) {
                        window.alert(mutationLockReason);
                        return;
                      }
                      await addInvoiceAction(fd);
                      await onAfterMutation();
                    }}
                    className="flex flex-col gap-2 rounded-md border p-3"
                  >
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <p className="text-xs text-muted-foreground">Rechnungsnummer wird automatisch vergeben.</p>
                    <Button type="submit" size="sm" disabled={mutationsLocked}>
                      Rechnung vorbereiten
                    </Button>
                  </form>
                  {bundle.invoices.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {bundle.invoices.map((inv) => (
                        <div key={inv.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{inv.invoiceNumber ?? "Entwurf"}</span>
                            <div className="flex shrink-0 items-center gap-2">
                              <form action={submitDeleteDraftInvoice}>
                                <input type="hidden" name="projectId" value={bundle.project.id} />
                                <input type="hidden" name="invoiceId" value={inv.id} />
                                <input type="hidden" name="invoiceFinalized" value={inv.finalizedAt ? "1" : "0"} />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  disabled={mutationsLocked}
                                  title={inv.finalizedAt ? "Rechnung löschen" : "Entwurf löschen"}
                                >
                                  <Trash2 className="size-3.5" aria-hidden />
                                  Löschen
                                </Button>
                              </form>
                              <span className="text-xs text-muted-foreground capitalize">
                                {inv.status}
                                {inv.deliveryChannel ? ` · ${inv.deliveryChannel}` : ""}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {inv.finalizedAt
                                ? `Finalisiert: ${formatDateTime(inv.finalizedAt)}`
                                : "Noch nicht finalisiert"}
                              {inv.deliverySentAt ? ` · Versand: ${formatDateTime(inv.deliverySentAt)}` : ""}
                              {inv.deliveryRecipient ? ` · Empfänger: ${inv.deliveryRecipient}` : ""}
                            </p>
                            {integrationZapierEnabled ? (
                              <form
                                action={submitFinalizeDocument}
                                className="flex flex-col gap-2 rounded-md border border-sky-200 bg-sky-50/60 p-3"
                              >
                                <input type="hidden" name="projectId" value={bundle.project.id} />
                                <input type="hidden" name="documentType" value="invoice" />
                                <input type="hidden" name="documentId" value={inv.id} />
                                <input type="hidden" name="deliveryChannel" value="bexio" />
                                <p className="text-xs text-sky-950">
                                  PDF für die Akte erzeugen und Daten an Zapier senden. Kundenversand nur in bexio — nicht per
                                  E-Mail aus BauFlip.
                                </p>
                                <Button type="submit" size="sm" className="h-9 w-full sm:w-auto" disabled={mutationsLocked}>
                                  Finalisieren (bexio)
                                </Button>
                              </form>
                            ) : (
                              <>
                                <form action={submitFinalizeDocument} className="flex items-center gap-2">
                                  <input type="hidden" name="projectId" value={bundle.project.id} />
                                  <input type="hidden" name="documentType" value="invoice" />
                                  <input type="hidden" name="documentId" value={inv.id} />
                                  <input type="hidden" name="deliveryChannel" value="post" />
                                  <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={mutationsLocked}>
                                    Per Post finalisieren
                                  </Button>
                                  <span className="text-xs text-muted-foreground">Kein Mailversand</span>
                                </form>
                                <form action={submitFinalizeDocument} className="rounded-md border bg-background p-2">
                                  <input type="hidden" name="projectId" value={bundle.project.id} />
                                  <input type="hidden" name="documentType" value="invoice" />
                                  <input type="hidden" name="documentId" value={inv.id} />
                                  <input type="hidden" name="deliveryChannel" value="email" />
                                  <div className="grid gap-1">
                                    <Input
                                      name="emailTo"
                                      defaultValue={bundle.contact?.email ?? ""}
                                      placeholder="kunde@beispiel.ch"
                                      className="h-8 text-xs"
                                    />
                                    <Input
                                      name="emailCc"
                                      placeholder="cc@beispiel.ch, team@firma.ch (optional)"
                                      className="h-8 text-xs"
                                    />
                                    <Input
                                      name="emailBcc"
                                      placeholder="bcc@beispiel.ch (optional)"
                                      className="h-8 text-xs"
                                    />
                                    <Input
                                      name="emailSubject"
                                      defaultValue={`Rechnung ${bundle.project.title}`}
                                      className="h-8 text-xs"
                                    />
                                    <VoiceTextarea
                                      name="emailHtml"
                                      defaultValue="<p>Guten Tag</p><p>Im Anhang erhalten Sie die Rechnung als PDF.</p><p>Vielen Dank für den Auftrag.</p><p>Freundliche Grüsse<br/>Ihr Bauflip Team</p>"
                                    />
                                    <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={mutationsLocked}>
                                      Per E-Mail finalisieren
                                    </Button>
                                  </div>
                                </form>
                              </>
                            )}
                            {inv.pdfPath ? (
                              <a
                                href={`/api/project-documents/invoice/${inv.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                              >
                                PDF öffnen
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
          </div>
        </GuidedPhaseSection>
      );

    default:
      return null;
  }
}

function MutationLockedNotice({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {message}
    </p>
  );
}

function TechnicianSelectField({
  id,
  name,
  technicians,
  highlightMissing,
}: {
  id: string;
  name: string;
  technicians: Array<{ id: string; displayName: string }>;
  highlightMissing?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 sm:col-span-2">
      <Label htmlFor={id} className="text-sm">
        Monteur
      </Label>
      <select
        id={id}
        name={name}
        required={technicians.length > 0}
        disabled={technicians.length === 0}
        className={cn(
          "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          highlightMissing && "border-destructive/60",
        )}
      >
        <option value="">{technicians.length > 0 ? "Monteur auswählen" : "Kein Monteur verfügbar"}</option>
        {technicians.map((tech) => (
          <option key={tech.id} value={tech.id}>
            {tech.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value || "—");
  }
  return d.toLocaleString("de-CH");
}

function DateTimeInput({
  id,
  name,
  required,
  defaultValue,
  className,
}: {
  id?: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        name={name}
        type="datetime-local"
        required={required}
        defaultValue={defaultValue}
        step={60}
        lang="de-CH"
        className={cn("pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0", className)}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => {
          const input = inputRef.current;
          if (!input) {
            return;
          }
          const withPicker = input as HTMLInputElement & { showPicker?: () => void };
          if (typeof withPicker.showPicker === "function") {
            withPicker.showPicker();
            return;
          }
          input.focus();
        }}
        aria-label="Datum und Zeit auswählen"
      >
        <CalendarClock className="size-4" />
      </button>
    </div>
  );
}

function PhaseControlCard({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <Card className="border-sky-200/70 bg-sky-50/40">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">Kontrollpunkte</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-md border border-sky-100 bg-white/70 px-3 py-2">
            <p className="text-xs text-muted-foreground">{row.label}</p>
            <p className="text-sm font-medium text-foreground">{row.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PhaseHeader({ workflowStepIndex }: { workflowStepIndex: number }) {
  const step = PROJECT_WORKFLOW_STEPS[workflowStepIndex];
  if (!step) {
    return null;
  }
  const stepNumber = workflowStepIndex + 1;
  return (
    <div className="border-b border-border/60 pb-2">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full border-2 border-primary bg-primary text-[10px] font-bold tabular-nums text-primary-foreground shadow-sm">
          {stepNumber}
        </span>
        <h2 className="text-sm font-semibold text-foreground">{step.label}</h2>
      </div>
    </div>
  );
}
