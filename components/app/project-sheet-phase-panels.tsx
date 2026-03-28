"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { CalendarClock } from "lucide-react";
import {
  addAppointmentAction,
  addDeliveryAction,
  addInvoiceAction,
  addProjectNoteAction,
  addStockDecisionAction,
  deleteStockDecisionAction,
  finalizeProjectDocumentAction,
  generateSwissQrAction,
  uploadProjectReportFileAction,
  deleteAppointmentAction,
} from "@/app/(app)/actions";
import type { getProjectSheetDataAction } from "@/app/(app)/projekte/actions";
import { PROJECT_WORKFLOW_STEPS } from "@/lib/workflow/project-workflow-rail";
import { VoiceTextarea } from "@/components/app/voice-textarea";
import { StockDecisionSelect } from "@/components/app/stock-decision-select";
import { SupplierOrderForm } from "@/components/app/supplier-order-form";
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
  onAfterMutation: () => void | Promise<void>;
};

const REPORT_OUTCOME_LABEL: Record<string, string> = {
  direkt_geloest: "Direkt gelöst",
  ersatzteil_noetig: "Ersatzteil nötig",
  werkstatt_noetig: "Werkstatt nötig",
  vollersatz_noetig: "Komplettersatz nötig",
};

const STOCK_DECISION_LABEL: Record<string, string> = {
  ab_lager: "Ab Lager verfügbar",
  bestellen: "Bestellung nötig",
};

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
  onAfterMutation,
}: ProjectSheetPhasePanelsProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [qrPending, setQrPending] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
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
  const latestDelivery = bundle.deliveries.at(-1) ?? null;
  const latestStockDecision = bundle.stockDecisions?.at(-1) ?? null;
  const supplierSubmissions = bundle.supplierSubmissions ?? [];
  const supplierNameById = new Map(
    supplierTemplates.map((template) => [template.supplierId, template.supplierName] as const),
  );
  const supplierTemplateById = new Map(
    supplierTemplates.map((template) => [template.id, template] as const),
  );
  const selectedSupplierTemplate =
    supplierTemplates.find((template) => template.id === selectedTemplateId) ?? supplierTemplates[0] ?? null;
  const qrAmountValue = latestQuote
    ? Number.isFinite(latestQuote.totalGross)
      ? latestQuote.totalGross.toFixed(2)
      : "0.00"
    : "";
  const qrDebtorName = bundle.contact?.name ?? "";
  const qrDebtorStreet = bundle.billingAddress?.street ?? bundle.contact?.street ?? "";
  const qrDebtorPostalCode = bundle.billingAddress?.postalCode ?? bundle.contact?.postalCode ?? "";
  const qrDebtorCity = bundle.billingAddress?.city ?? bundle.contact?.city ?? "";
  const qrDebtorCountry = (bundle.billingAddress?.country ?? "CH").toUpperCase();
  const qrReferenceValue =
    latestInvoice?.invoiceNumber ??
    bundle.project.referenceCode ??
    `PROJ-${String(bundle.project.id).slice(0, 8).toUpperCase()}`;
  const mutationsLocked = !canEdit || phaseIndex < currentPhaseIndex;
  const mutationLockReason = !canEdit
    ? `Ihre Rolle (${actorRole}) darf diesen Schritt nicht bearbeiten.`
    : "Dieser Schritt ist bereits abgeschlossen. Für Korrekturen zuerst den aktuellen Schritt öffnen.";

  useEffect(() => {
    if (supplierTemplates.length === 0) {
      if (selectedTemplateId) {
        setSelectedTemplateId("");
      }
      return;
    }
    if (!selectedTemplateId || !supplierTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(supplierTemplates[0]!.id);
    }
  }, [supplierTemplates, selectedTemplateId]);

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
  const submitQrForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mutationsLocked) {
      window.alert(mutationLockReason);
      return;
    }
    setQrError(null);
    setQrPending(true);
    try {
      const fd = new FormData(event.currentTarget);
      const qrCode = await generateSwissQrAction(fd);
      setQrPreview(qrCode);
      window.alert("QR-Code wurde erfolgreich erzeugt.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "QR-Code konnte nicht erzeugt werden.";
      setQrError(msg);
      window.alert(msg);
    } finally {
      setQrPending(false);
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
                <CardTitle>Technikerbericht</CardTitle>
                <CardDescription>
                  Monteur erfasst Diagnose, Masse und Entscheid vor Ort. Grundlage für Offerte und Bestellung.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {mutationsLocked ? null : (
                  <form
                    action={async (fd) => {
                      await uploadProjectReportFileAction(fd);
                      await onAfterMutation();
                    }}
                    className="flex flex-col gap-2 rounded-md border p-3"
                  >
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label className="text-sm">Datei zum Rapport hochladen (Bild, PDF, Word)</Label>
                    <Input
                      name="file"
                      type="file"
                      required
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    />
                    <div>
                      <Button type="submit" size="sm" variant="outline">
                        Datei hochladen
                      </Button>
                    </div>
                  </form>
                )}
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
                {mutationsLocked ? null : (
                  <TechnicianReportForm
                    projectId={bundle.project.id}
                    variant="full"
                    articleOptions={articles}
                    className="flex flex-col gap-3 rounded-md border p-4"
                    submitLabel="Bericht speichern"
                    onSuccess={onAfterMutation}
                  />
                )}

                {bundle.reports.map((report) => (
                  <div key={report.id} className="rounded-md border bg-muted/20 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{REPORT_OUTCOME_LABEL[report.outcome] ?? report.outcome}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(report.createdAt)}</span>
                    </div>
                    <p className="mt-1">{report.summary}</p>
                    {report.workDescription ? <p className="mt-1 text-muted-foreground">{report.workDescription}</p> : null}
                    {(() => {
                      try {
                        const m = JSON.parse(report.measurementsJson ?? "{}") as {
                          serviceSelections?: string[];
                          articleSelections?: string[];
                        };
                        const services = Array.isArray(m.serviceSelections) ? m.serviceSelections : [];
                        const articles = Array.isArray(m.articleSelections) ? m.articleSelections : [];
                        if (services.length === 0 && articles.length === 0) {
                          return null;
                        }
                        return (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {services.length > 0 ? <p>Dienstleistungen: {services.join(", ")}</p> : null}
                            {articles.length > 0 ? <p>Artikel IDs: {articles.join(", ")}</p> : null}
                          </div>
                        );
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Bestellformulare vor Ort (Monteur) */}
            <Card>
              <CardHeader>
                <CardTitle>Bestellformulare vor Ort</CardTitle>
                <CardDescription>
                  Monteur wählt Lieferantenformular und erfasst Bestelldaten direkt vor Ort.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {supplierTemplates.length > 0 ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <Label className="text-sm">Lieferant / Formular</Label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                      >
                        {supplierTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.supplierName} — {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedSupplierTemplate && !mutationsLocked ? (
                      <SupplierOrderForm
                        key={`draft-${selectedSupplierTemplate.id}`}
                        projectId={bundle.project.id}
                        template={selectedSupplierTemplate}
                        articleOptions={articles}
                        draftMode
                        onSubmitted={onAfterMutation}
                      />
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine Lieferantenvorlagen verfügbar.</p>
                )}
                {/* Already submitted drafts */}
                {supplierSubmissions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Erfasste Bestellformulare</p>
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
                          <p className="font-medium text-foreground">
                            {tmpl?.supplierName ?? "Lieferant"} · {vals.titel ?? tmpl?.name ?? "Formular"} ·{" "}
                            <span className="capitalize">{sub.status}</span> · {formatDateTime(sub.createdAt)}
                          </p>
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
                  label: "Lagerentscheid",
                  value: latestStockDecision
                    ? `${STOCK_DECISION_LABEL[latestStockDecision.decision] ?? latestStockDecision.decision} · ${formatDateTime(latestStockDecision.createdAt)}`
                    : "Noch keiner",
                },
                {
                  label: "Empfänger",
                  value: latestQuote?.deliveryRecipient ?? "Kein Empfänger protokolliert",
                },
              ]}
            />
            <div className="grid gap-4 2xl:grid-cols-2 2xl:items-stretch">
              <Card className="h-full min-h-0">
                <CardHeader>
                  <CardTitle>Offerte erstellen</CardTitle>
                  <CardDescription>Basierend auf Monteur-Rapport. Material + Arbeit.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                  {mutationsLocked ? null : (
                    <QuoteDraftForm
                      projectId={bundle.project.id}
                      suggestedVersion={(bundle.quotes?.length ?? 0) + 1}
                      articleOptions={articles}
                      className="flex min-h-0 flex-1 flex-col gap-2 rounded-md border p-3"
                      onSuccess={onAfterMutation}
                    />
                  )}
                  {bundle.quotes.length > 0 ? (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {bundle.quotes.map((q) => (
                        <div key={q.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span>Version {q.version}</span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {q.status}
                              {q.deliveryChannel ? ` · ${q.deliveryChannel}` : ""}
                            </span>
                          </div>
                          <div className="mt-2 space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {q.finalizedAt
                                ? `Finalisiert: ${formatDateTime(q.finalizedAt)}`
                                : "Noch nicht finalisiert"}
                              {q.deliverySentAt ? ` · Versand: ${formatDateTime(q.deliverySentAt)}` : ""}
                              {q.deliveryRecipient ? ` · Empfänger: ${q.deliveryRecipient}` : ""}
                            </p>
                            <form
                              action={submitFinalizeDocument}
                              className="flex items-center gap-2"
                            >
                              <input type="hidden" name="projectId" value={bundle.project.id} />
                              <input type="hidden" name="documentType" value="quote" />
                              <input type="hidden" name="documentId" value={q.id} />
                              <input type="hidden" name="deliveryChannel" value="post" />
                              <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={mutationsLocked}>
                                Per Post finalisieren
                              </Button>
                              <span className="text-xs text-muted-foreground">Kein Mailversand</span>
                            </form>
                            <form
                              action={submitFinalizeDocument}
                              className="rounded-md border bg-background p-2"
                            >
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

              <Card className="h-full min-h-0">
                <CardHeader>
                  <CardTitle>Lagerentscheidung</CardTitle>
                  <CardDescription>Nach Offert-Freigabe: ab Lager lieferbar oder Bestellung nötig?</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                  <form
                    action={async (fd) => {
                      if (mutationsLocked) {
                        window.alert(mutationLockReason);
                        return;
                      }
                      try {
                        await addStockDecisionAction(fd);
                        await onAfterMutation();
                        window.alert("Lagerentscheid gespeichert.");
                      } catch (error) {
                        window.alert(error instanceof Error ? error.message : "Lagerentscheid konnte nicht gespeichert werden.");
                      }
                    }}
                    className="flex min-h-0 flex-1 flex-col gap-2 rounded-md border p-3"
                  >
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label className="text-sm">Entscheid</Label>
                    <StockDecisionSelect />
                    <div className="min-h-[5rem] flex-1">
                      <VoiceTextarea name="notes" placeholder="Begründung / Bemerkung" required />
                    </div>
                    <Button className="mt-auto w-fit" type="submit" size="sm" disabled={mutationsLocked}>
                      Entscheid speichern
                    </Button>
                  </form>
                  {latestStockDecision ? (
                    <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      <p>
                        Letzter Entscheid:{" "}
                        <span className="font-medium text-foreground">
                          {STOCK_DECISION_LABEL[latestStockDecision.decision] ?? latestStockDecision.decision}
                        </span>{" "}
                        · {formatDateTime(latestStockDecision.createdAt)}
                      </p>
                      {latestStockDecision.notes ? <p className="mt-1">Notiz: {latestStockDecision.notes}</p> : null}
                      <form
                        action={async (fd) => {
                          try {
                            await deleteStockDecisionAction(fd);
                            await onAfterMutation();
                          } catch (error) {
                            window.alert(
                              error instanceof Error ? error.message : "Lagerentscheid konnte nicht gelöscht werden.",
                            );
                          }
                        }}
                        className="mt-2"
                      >
                        <input type="hidden" name="stockDecisionId" value={latestStockDecision.id} />
                        <input type="hidden" name="projectId" value={bundle.project.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          className="h-7 border-red-200 px-2 text-xs text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            const ok = window.confirm("Lagerentscheid wirklich löschen?");
                            if (!ok) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Lagerentscheid löschen
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
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
                  label: "Wareneingänge",
                  value: bundle.deliveries.length > 0 ? `${bundle.deliveries.length} erfasst` : "Fehlt",
                },
                {
                  label: "Letzte Bestellung",
                  value: latestOrder ? formatDateTime(latestOrder.createdAt) : "Noch keine",
                },
                {
                  label: "Letzter Wareneingang",
                  value: latestDelivery ? formatDateTime(latestDelivery.arrivedAt) : "Noch keiner",
                },
              ]}
            />
            <div className="grid gap-4 2xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Lieferanten-Bestellung</CardTitle>
                  <CardDescription>
                    Vom Monteur erfasste Bestellformulare prüfen und bei Bedarf neu erfassen oder absenden.
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
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-foreground">
                                {tmpl?.supplierName ?? "Lieferant"} · {vals.titel ?? tmpl?.name ?? "Formular"}
                              </p>
                              <span className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                                sub.status === "eingereicht"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-amber-100 text-amber-800",
                              )}>
                                {sub.status}
                              </span>
                            </div>
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

                  {/* Admin/Office: new order form */}
                  {supplierTemplates.length > 0 && !mutationsLocked ? (
                    <div className="flex flex-col gap-2 rounded-md border p-3">
                      <Label className="text-sm">Neues Formular erfassen / absenden</Label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                      >
                        {supplierTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.supplierName} — {t.name}
                          </option>
                        ))}
                      </select>
                      {selectedSupplierTemplate ? (
                        <SupplierOrderForm
                          key={`send-${selectedSupplierTemplate.id}`}
                          projectId={bundle.project.id}
                          template={selectedSupplierTemplate}
                          articleOptions={articles}
                          onSubmitted={onAfterMutation}
                        />
                      ) : null}
                    </div>
                  ) : null}

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

              <Card>
                <CardHeader>
                  <CardTitle>Wareneingang</CardTitle>
                  <CardDescription>Material kontrollieren, Lieferschein erfassen.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <form
                    action={async (fd) => {
                      if (mutationsLocked) {
                        window.alert(mutationLockReason);
                        return;
                      }
                      try {
                        await addDeliveryAction(fd);
                        await onAfterMutation();
                        window.alert("Wareneingang gespeichert.");
                      } catch (error) {
                        window.alert(error instanceof Error ? error.message : "Wareneingang konnte nicht erfasst werden.");
                      }
                    }}
                    className="flex flex-col gap-2 rounded-md border p-3"
                  >
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label className="text-sm">Bestellung (optional, ID)</Label>
                    <select
                      name="purchaseOrderId"
                      defaultValue=""
                      className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                    >
                      <option value="">Keine direkte Bestellung zuordnen</option>
                      {bundle.orders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {supplierNameById.get(order.supplierId) ?? "Lieferant"} · {order.status} · {formatDateTime(order.createdAt)}
                        </option>
                      ))}
                    </select>
                    <Label className="text-sm">Lieferscheinnummer</Label>
                    <Input name="deliveryNoteNumber" placeholder="z. B. LS-2024-001" />
                    <Button type="submit" size="sm" disabled={mutationsLocked}>
                      Wareneingang erfassen
                    </Button>
                  </form>
                  {bundle.deliveries.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {bundle.deliveries.map((d) => (
                        <div key={d.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{d.deliveryNoteNumber ?? "Kein Lieferschein"}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(d.arrivedAt)}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <form
                              action={submitFinalizeDocument}
                            >
                              <input type="hidden" name="projectId" value={bundle.project.id} />
                              <input type="hidden" name="documentType" value="delivery" />
                              <input type="hidden" name="documentId" value={d.id} />
                              <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs">
                                Lieferschein PDF erzeugen
                              </Button>
                            </form>
                            {d.pdfPath ? (
                              <a
                                href={`/api/project-documents/delivery/${d.id}`}
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
                    <VoiceTextarea name="accessNotes" placeholder="Schlüssel, Anwesenheit, Zeitfenster …" />
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
                  value: latestInvoice?.deliveryRecipient ?? "Kein Empfänger protokolliert",
                },
              ]}
            />
            <div className="grid gap-4 2xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Rechnung</CardTitle>
                  <CardDescription>Rechnung erstellen und versenden.</CardDescription>
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
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{inv.invoiceNumber ?? "Entwurf"}</span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {inv.status}
                              {inv.deliveryChannel ? ` · ${inv.deliveryChannel}` : ""}
                            </span>
                          </div>
                          <div className="mt-2 space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {inv.finalizedAt
                                ? `Finalisiert: ${formatDateTime(inv.finalizedAt)}`
                                : "Noch nicht finalisiert"}
                              {inv.deliverySentAt ? ` · Versand: ${formatDateTime(inv.deliverySentAt)}` : ""}
                              {inv.deliveryRecipient ? ` · Empfänger: ${inv.deliveryRecipient}` : ""}
                            </p>
                            <form
                              action={submitFinalizeDocument}
                              className="flex items-center gap-2"
                            >
                              <input type="hidden" name="projectId" value={bundle.project.id} />
                              <input type="hidden" name="documentType" value="invoice" />
                              <input type="hidden" name="documentId" value={inv.id} />
                              <input type="hidden" name="deliveryChannel" value="post" />
                              <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={mutationsLocked}>
                                Per Post finalisieren
                              </Button>
                              <span className="text-xs text-muted-foreground">Kein Mailversand</span>
                            </form>
                            <form
                              action={submitFinalizeDocument}
                              className="rounded-md border bg-background p-2"
                            >
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

              <Card>
                <CardHeader>
                  <CardTitle>Schweizer Rechnungs-QR</CardTitle>
                  <CardDescription>
                    QR-Code für Einzahlungsschein / QR-Rechnung. Firmendaten (IBAN/Gläubiger) kommen aus den Firmeneinstellungen,
                    Betrag aus der letzten Offerte, Schuldnerdaten aus der Rechnungsadresse.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submitQrForm} className="flex flex-col gap-2 rounded-md border p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input name="amount" value={qrAmountValue} readOnly required placeholder="Betrag CHF" />
                      <Input name="debtorName" value={qrDebtorName} readOnly placeholder="Schuldnername" />
                      <Input name="debtorStreet" value={qrDebtorStreet} readOnly placeholder="Schuldnerstrasse" />
                      <Input
                        name="debtorPostalCode"
                        value={qrDebtorPostalCode}
                        readOnly
                        placeholder="Schuldner PLZ"
                      />
                      <Input name="debtorCity" value={qrDebtorCity} readOnly placeholder="Schuldner Ort" />
                      <input type="hidden" name="debtorCountry" value={qrDebtorCountry} />
                      <Input name="reference" value={qrReferenceValue} readOnly placeholder="Referenznummer" />
                      <Input name="message" placeholder="Mitteilung" required />
                    </div>
                    {!latestQuote || !qrDebtorName || !qrDebtorStreet || !qrDebtorPostalCode || !qrDebtorCity ? (
                      <p className="text-xs text-muted-foreground">
                        Für QR werden Betrag (letzte Offerte) und Rechnungsadresse automatisch übernommen. Bitte fehlende Daten zuerst
                        im Projekt ergänzen.
                      </p>
                    ) : null}
                    <input type="hidden" name="currency" value="CHF" />
                    <Button
                      className="mt-1"
                      type="submit"
                      size="sm"
                      disabled={
                        qrPending || !latestQuote || !qrDebtorName || !qrDebtorStreet || !qrDebtorPostalCode || !qrDebtorCity
                      }
                    >
                      {qrPending ? "Erzeuge QR-Code..." : "QR-Code erzeugen"}
                    </Button>
                  </form>
                  {qrError ? <p className="mt-2 text-xs text-destructive">{qrError}</p> : null}
                  {qrPreview ? (
                    <div className="mt-3 rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">Vorschau</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 border-red-200 px-2 text-xs text-red-700 hover:bg-red-50"
                          onClick={() => {
                            const ok = window.confirm("QR-Code-Vorschau wirklich löschen?");
                            if (!ok) {
                              return;
                            }
                            setQrPreview(null);
                            setQrError(null);
                          }}
                        >
                          QR-Code löschen
                        </Button>
                      </div>
                      <img src={qrPreview} alt="QR-Code Rechnung" className="max-w-[260px] rounded border bg-white p-2" />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
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
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
          {stepNumber}
        </span>
        <h2 className="text-sm font-semibold text-foreground">{step.label}</h2>
      </div>
    </div>
  );
}
