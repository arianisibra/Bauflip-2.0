"use client";

import { useRef } from "react";
import { CalendarClock } from "lucide-react";
import {
  addAppointmentAction,
  addDeliveryAction,
  addInvoiceAction,
  addOrderAction,
  addProjectNoteAction,
  addStockDecisionAction,
  finalizeProjectDocumentAction,
  generateSwissQrAction,
  uploadProjectReportFileAction,
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

type SheetPayload = Awaited<ReturnType<typeof getProjectSheetDataAction>>;

type ProjectSheetPhasePanelsProps = {
  phaseIndex: number;
  currentPhaseIndex: number;
  bundle: SheetPayload["bundle"];
  reportAttachments: Array<
    SheetPayload["reportAttachments"][number]
  >;
  profiles: SheetPayload["profiles"];
  supplierTemplates: SheetPayload["supplierTemplates"];
  articles: SheetPayload["articles"];
  onAfterMutation: () => void | Promise<void>;
};

export function ProjectSheetPhasePanels({
  phaseIndex,
  currentPhaseIndex,
  bundle,
  reportAttachments,
  profiles,
  supplierTemplates,
  articles,
  onAfterMutation,
}: ProjectSheetPhasePanelsProps) {
  const technicians = profiles.filter((p) => p.role === "technician");
  const technicianById = new Map(technicians.map((t) => [t.id, t]));
  const besichtigungAppointments = bundle.appointments.filter((a) => a.kind === "besichtigung");
  const ausfuehrungAppointments = bundle.appointments.filter((a) => a.kind === "ausfuehrung");
  const latestReport = bundle.reports.at(-1) ?? null;
  const latestQuote = bundle.quotes.at(-1) ?? null;
  const latestInvoice = bundle.invoices.at(-1) ?? null;
  const latestOrder = bundle.orders.at(-1) ?? null;
  const latestDelivery = bundle.deliveries.at(-1) ?? null;

  if (phaseIndex === 0) {
    return null;
  }

  switch (phaseIndex) {
    case 1:
      return (
        <GuidedPhaseSection id="termin" phaseIndex={1} currentPhaseIndex={currentPhaseIndex}>
          <div className="space-y-4">
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
                  action={async (fd) => {
                    await addAppointmentAction(fd);
                    await onAfterMutation();
                  }}
                  className="grid gap-2 rounded-md border p-4 sm:grid-cols-2"
                >
                  <input type="hidden" name="projectId" value={bundle.project.id} />
                  <input type="hidden" name="kind" value="besichtigung" />
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label htmlFor="sh-bes-start" className="text-sm">
                      Beginn
                    </Label>
                    <DateTimeInput id="sh-bes-start" name="startsAt" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="sh-bes-end" className="text-sm">
                      Ende
                    </Label>
                    <DateTimeInput id="sh-bes-end" name="endsAt" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Planungsnotiz</Label>
                    <VoiceTextarea name="planningNotes" placeholder="z. B. Zugang via Hauswart" />
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label htmlFor="sh-bes-technician" className="text-sm">
                      Monteur
                    </Label>
                    <select
                      id="sh-bes-technician"
                      name="assignedTechnicianId"
                      required={technicians.length > 0}
                      disabled={technicians.length === 0}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">{technicians.length > 0 ? "Monteur auswählen" : "Kein Monteur verfügbar"}</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" size="sm">
                      Besichtigungstermin speichern
                    </Button>
                  </div>
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
                <TechnicianReportForm
                  projectId={bundle.project.id}
                  variant="full"
                  articleOptions={articles}
                  className="flex flex-col gap-3 rounded-md border p-4"
                  submitLabel="Bericht speichern"
                  onSuccess={onAfterMutation}
                />

                {bundle.reports.map((report) => (
                  <div key={report.id} className="rounded-md border bg-muted/20 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{report.outcome}</span>
                      <span className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString("de-CH")}</span>
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
          </div>
        </GuidedPhaseSection>
      );

    case 3:
      return (
        <GuidedPhaseSection id="offerte" phaseIndex={3} currentPhaseIndex={currentPhaseIndex}>
          <div className="space-y-4">
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
                  value: latestQuote?.deliveryRecipient ?? "Kein Empfänger protokolliert",
                },
              ]}
            />
            <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
              <Card className="h-full min-h-0">
                <CardHeader>
                  <CardTitle>Offerte erstellen</CardTitle>
                  <CardDescription>Basierend auf Monteur-Rapport. Material + Arbeit.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                  <QuoteDraftForm
                    projectId={bundle.project.id}
                    suggestedVersion={(bundle.quotes?.length ?? 0) + 1}
                    articleOptions={articles}
                    className="flex min-h-0 flex-1 flex-col gap-2 rounded-md border p-3"
                    onSuccess={onAfterMutation}
                  />
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
                              action={async (fd) => {
                                await finalizeProjectDocumentAction(fd);
                                await onAfterMutation();
                              }}
                              className="flex items-center gap-2"
                            >
                              <input type="hidden" name="projectId" value={bundle.project.id} />
                              <input type="hidden" name="documentType" value="quote" />
                              <input type="hidden" name="documentId" value={q.id} />
                              <input type="hidden" name="deliveryChannel" value="post" />
                              <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs">
                                Per Post finalisieren
                              </Button>
                              <span className="text-xs text-muted-foreground">Kein Mailversand</span>
                            </form>
                            <form
                              action={async (fd) => {
                                await finalizeProjectDocumentAction(fd);
                                await onAfterMutation();
                              }}
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
                                  name="emailSubject"
                                  defaultValue={`Offerte ${bundle.project.title}`}
                                  className="h-8 text-xs"
                                />
                                <VoiceTextarea
                                  name="emailHtml"
                                  defaultValue="<p>Guten Tag<br/>im Anhang erhalten Sie die Offerte als PDF.</p>"
                                />
                                <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs">
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
                      await addStockDecisionAction(fd);
                      await onAfterMutation();
                    }}
                    className="flex min-h-0 flex-1 flex-col gap-2 rounded-md border p-3"
                  >
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label className="text-sm">Entscheid</Label>
                    <StockDecisionSelect />
                    <div className="min-h-[5rem] flex-1">
                      <VoiceTextarea name="notes" placeholder="Begründung / Bemerkung" required />
                    </div>
                    <Button className="mt-auto w-fit" type="submit" size="sm">
                      Entscheid speichern
                    </Button>
                  </form>
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
            <PhaseHeader workflowStepIndex={4} />
            <PhaseControlCard
              rows={[
                {
                  label: "Bestellungen",
                  value: bundle.orders.length > 0 ? `${bundle.orders.length} erfasst` : "Fehlt",
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
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Lieferanten-Bestellung</CardTitle>
                  <CardDescription>Lieferantenspezifisches Formular — Admin prüft Vollständigkeit vor Versand.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {supplierTemplates.length > 0 ? (
                    supplierTemplates.slice(0, 1).map((template) => (
                      <SupplierOrderForm
                        key={template.id}
                        projectId={bundle.project.id}
                        template={template}
                        onSubmitted={onAfterMutation}
                      />
                    ))
                  ) : (
                    <form
                      action={async (fd) => {
                        await addOrderAction(fd);
                        await onAfterMutation();
                      }}
                      className="flex flex-col gap-2 rounded-md border p-3"
                    >
                      <input type="hidden" name="projectId" value={bundle.project.id} />
                      <Label className="text-sm">Lieferant (ID)</Label>
                      <Input name="supplierId" placeholder="Lieferant-UUID" />
                      <Button type="submit" size="sm">
                        Bestellung erfassen
                      </Button>
                    </form>
                  )}
                  {bundle.orders.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {bundle.orders.map((o) => (
                        <div key={o.id} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
                          <span>Lieferant: {o.supplierId}</span>
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
                      await addDeliveryAction(fd);
                      await onAfterMutation();
                    }}
                    className="flex flex-col gap-2 rounded-md border p-3"
                  >
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label className="text-sm">Bestellung (optional, ID)</Label>
                    <Input name="purchaseOrderId" placeholder="Bestellungs-ID" />
                    <Label className="text-sm">Lieferscheinnummer</Label>
                    <Input name="deliveryNoteNumber" placeholder="z. B. LS-2024-001" />
                    <Button type="submit" size="sm">
                      Wareneingang erfassen
                    </Button>
                  </form>
                  {bundle.deliveries.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {bundle.deliveries.map((d) => (
                        <div key={d.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{d.deliveryNoteNumber ?? "Kein Lieferschein"}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{new Date(d.arrivedAt).toLocaleDateString("de-CH")}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <form
                              action={async (fd) => {
                                await finalizeProjectDocumentAction(fd);
                                await onAfterMutation();
                              }}
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
                  action={async (fd) => {
                    await addAppointmentAction(fd);
                    await onAfterMutation();
                  }}
                  className="grid gap-2 rounded-md border p-4 sm:grid-cols-2"
                >
                  <input type="hidden" name="projectId" value={bundle.project.id} />
                  <input type="hidden" name="kind" value="ausfuehrung" />
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label className="text-sm">Beginn</Label>
                    <DateTimeInput name="startsAt" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Ende</Label>
                    <DateTimeInput name="endsAt" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Zugang / Hinweise</Label>
                    <VoiceTextarea name="accessNotes" placeholder="Schlüssel, Anwesenheit, Zeitfenster …" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Planungsnotiz</Label>
                    <VoiceTextarea name="planningNotes" placeholder="Zeitaufwand, besondere Vorbereitungen …" />
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label htmlFor="sh-aus-technician" className="text-sm">
                      Monteur
                    </Label>
                    <select
                      id="sh-aus-technician"
                      name="assignedTechnicianId"
                      required={technicians.length > 0}
                      disabled={technicians.length === 0}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">{technicians.length > 0 ? "Monteur auswählen" : "Kein Monteur verfügbar"}</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" size="sm">
                      Ausführungstermin speichern
                    </Button>
                  </div>
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
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Fertigmeldung</CardTitle>
                  <CardDescription>Monteur meldet Arbeit als erledigt.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <TechnicianReportForm
                    projectId={bundle.project.id}
                    variant="fertigmeldung"
                    className="flex flex-col gap-3 rounded-md border p-3"
                    submitLabel="Fertigmeldung speichern"
                    onSuccess={onAfterMutation}
                  />
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
                    <Button type="submit" size="sm">
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
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Rechnung</CardTitle>
                  <CardDescription>Rechnung erstellen und versenden.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <form
                    action={async (fd) => {
                      await addInvoiceAction(fd);
                      await onAfterMutation();
                    }}
                    className="flex flex-col gap-2 rounded-md border p-3"
                  >
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label htmlFor="sh-inv" className="text-sm">
                      Rechnungsnummer
                    </Label>
                    <Input id="sh-inv" name="invoiceNumber" placeholder="z. B. RE-2024-042" className="h-9" />
                    <Button type="submit" size="sm">
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
                              action={async (fd) => {
                                await finalizeProjectDocumentAction(fd);
                                await onAfterMutation();
                              }}
                              className="flex items-center gap-2"
                            >
                              <input type="hidden" name="projectId" value={bundle.project.id} />
                              <input type="hidden" name="documentType" value="invoice" />
                              <input type="hidden" name="documentId" value={inv.id} />
                              <input type="hidden" name="deliveryChannel" value="post" />
                              <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs">
                                Per Post finalisieren
                              </Button>
                              <span className="text-xs text-muted-foreground">Kein Mailversand</span>
                            </form>
                            <form
                              action={async (fd) => {
                                await finalizeProjectDocumentAction(fd);
                                await onAfterMutation();
                              }}
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
                                  name="emailSubject"
                                  defaultValue={`Rechnung ${bundle.project.title}`}
                                  className="h-8 text-xs"
                                />
                                <VoiceTextarea
                                  name="emailHtml"
                                  defaultValue="<p>Guten Tag<br/>im Anhang erhalten Sie die Rechnung als PDF.</p>"
                                />
                                <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs">
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
                  <CardDescription>QR-Code für Einzahlungsschein / QR-Rechnung.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    action={async (fd) => {
                      await generateSwissQrAction(fd);
                      await onAfterMutation();
                    }}
                    className="flex flex-col gap-2 rounded-md border p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input name="iban" placeholder="CH44 …" required />
                      <Input name="amount" placeholder="Betrag CHF" required />
                      <Input name="creditorName" placeholder="Gläubigername" required />
                      <Input name="creditorStreet" placeholder="Gläubigerstrasse" required />
                      <Input name="creditorPostalCode" placeholder="PLZ" required />
                      <Input name="creditorCity" placeholder="Ort" required />
                      <Input name="debtorName" placeholder="Schuldnername" required />
                      <Input name="debtorStreet" placeholder="Schuldnerstrasse" required />
                      <Input name="debtorPostalCode" placeholder="Schuldner PLZ" required />
                      <Input name="debtorCity" placeholder="Schuldner Ort" required />
                      <Input name="reference" placeholder="Referenznummer" required />
                      <Input name="message" placeholder="Mitteilung" required />
                    </div>
                    <input type="hidden" name="currency" value="CHF" />
                    <Button className="mt-1" type="submit" size="sm">
                      QR-Code erzeugen
                    </Button>
                  </form>
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
}: {
  id?: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
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
        className="pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0"
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
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Kontrollpunkte für diesen Schritt</CardTitle>
        <CardDescription>Diese Infos sollten vollständig sein, bevor es weitergeht.</CardDescription>
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
    <div className="space-y-1 border-b border-border/60 pb-3">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
          {stepNumber}
        </span>
        <h2 className="text-sm font-semibold text-foreground">{step.label}</h2>
      </div>
      <p className="pl-8 text-xs leading-snug text-muted-foreground">{step.hint}</p>
    </div>
  );
}
