"use client";

import {
  addAppointmentAction,
  addDeliveryAction,
  addInvoiceAction,
  addOrderAction,
  addProjectNoteAction,
  addQuoteAction,
  addStockDecisionAction,
  generateSwissQrAction,
} from "@/app/(app)/actions";
import type { getProjectSheetDataAction } from "@/app/(app)/projekte/actions";
import { PROJECT_WORKFLOW_STEPS } from "@/lib/workflow/project-workflow-rail";
import { VoiceTextarea } from "@/components/app/voice-textarea";
import { StockDecisionSelect } from "@/components/app/stock-decision-select";
import { SupplierOrderForm } from "@/components/app/supplier-order-form";
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
  supplierTemplates: SheetPayload["supplierTemplates"];
  onAfterMutation: () => void | Promise<void>;
};

export function ProjectSheetPhasePanels({
  phaseIndex,
  currentPhaseIndex,
  bundle,
  supplierTemplates,
  onAfterMutation,
}: ProjectSheetPhasePanelsProps) {
  const besichtigungAppointments = bundle.appointments.filter((a) => a.kind === "besichtigung");
  const ausfuehrungAppointments = bundle.appointments.filter((a) => a.kind === "ausfuehrung");

  if (phaseIndex === 0) {
    return null;
  }

  switch (phaseIndex) {
    case 1:
      return (
        <GuidedPhaseSection id="termin" phaseIndex={1} currentPhaseIndex={currentPhaseIndex}>
          <div className="space-y-4">
            <PhaseHeader workflowStepIndex={1} />
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
                    <Input id="sh-bes-start" name="startsAt" type="datetime-local" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="sh-bes-end" className="text-sm">
                      Ende
                    </Label>
                    <Input id="sh-bes-end" name="endsAt" type="datetime-local" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Planungsnotiz</Label>
                    <VoiceTextarea name="planningNotes" placeholder="z. B. Zugang via Hauswart" />
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
                        <span className="font-medium">{new Date(a.startsAt).toLocaleString("de-CH")}</span>
                        {a.planningNotes ? <span className="ml-2 text-muted-foreground">{a.planningNotes}</span> : null}
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
            <PhaseHeader n={3} title="Rapport & Bestandsaufnahme" />
            <Card>
              <CardHeader>
                <CardTitle>Technikerbericht</CardTitle>
                <CardDescription>
                  Monteur erfasst Diagnose, Masse und Entscheid vor Ort. Grundlage für Offerte und Bestellung.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <TechnicianReportForm
                  projectId={bundle.project.id}
                  variant="full"
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
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Offerte erstellen</CardTitle>
                  <CardDescription>Basierend auf Monteur-Rapport. Material + Arbeit.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <form
                    action={async (fd) => {
                      await addQuoteAction(fd);
                      await onAfterMutation();
                    }}
                    className="flex flex-col gap-2 rounded-md border p-3"
                  >
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label htmlFor="sh-q-v" className="text-sm">
                      Version
                    </Label>
                    <Input id="sh-q-v" name="version" type="number" defaultValue={1} className="h-9" />
                    <Button type="submit" size="sm">
                      Offerte erfassen
                    </Button>
                  </form>
                  {bundle.quotes.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {bundle.quotes.map((q) => (
                        <div key={q.id} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
                          <span>Version {q.version}</span>
                          <span className="text-xs text-muted-foreground capitalize">{q.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lagerentscheidung</CardTitle>
                  <CardDescription>Nach Offert-Freigabe: ab Lager lieferbar oder Bestellung nötig?</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <form
                    action={async (fd) => {
                      await addStockDecisionAction(fd);
                      await onAfterMutation();
                    }}
                    className="flex flex-col gap-2 rounded-md border p-3"
                  >
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label className="text-sm">Entscheid</Label>
                    <StockDecisionSelect />
                    <VoiceTextarea name="notes" placeholder="Begründung / Bemerkung" required />
                    <Button className="mt-1" type="submit" size="sm">
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
                          <span className="font-medium">{d.deliveryNoteNumber ?? "Kein Lieferschein"}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{new Date(d.arrivedAt).toLocaleDateString("de-CH")}</span>
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
            <PhaseHeader n={6} title="Ausführungstermin" />
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
                    <Input name="startsAt" type="datetime-local" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Ende</Label>
                    <Input name="endsAt" type="datetime-local" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Zugang / Hinweise</Label>
                    <VoiceTextarea name="accessNotes" placeholder="Schlüssel, Anwesenheit, Zeitfenster …" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Planungsnotiz</Label>
                    <VoiceTextarea name="planningNotes" placeholder="Zeitaufwand, besondere Vorbereitungen …" />
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
                        <span className="font-medium">{new Date(a.startsAt).toLocaleString("de-CH")}</span>
                        {a.planningNotes ? <span className="ml-2 text-muted-foreground">{a.planningNotes}</span> : null}
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
            <PhaseHeader n={8} title="Rechnung & Abschluss" />
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
                        <div key={inv.id} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
                          <span className="font-medium">{inv.invoiceNumber ?? "Entwurf"}</span>
                          <span className="text-xs text-muted-foreground capitalize">{inv.status}</span>
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
