import { notFound } from "next/navigation";
import {
  getProjectBundle,
  listAssignableProfiles,
  listContactAddressesForContact,
  listContactPersonsForContact,
  listContacts,
  listArticles,
  listProjectChat,
  listProjectWorkTypes,
  listSiteProperties,
  listSupplierTemplates,
} from "@/lib/db/repository";
import { getCurrentSession } from "@/lib/auth/session";
import { ProjectStammdatenForm } from "@/components/app/project-stammdaten-form";
import { StatusBadge } from "@/components/app/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TechnicianReportForm } from "@/components/app/technician-report-form";
import { VoiceTextarea } from "@/components/app/voice-textarea";
import { StockDecisionSelect } from "@/components/app/stock-decision-select";
import { SupplierOrderForm } from "@/components/app/supplier-order-form";
import { QuoteDraftForm } from "@/components/app/quote-draft-form";
import {
  addAppointmentAction,
  addDeliveryAction,
  addProjectChatMessageAction,
  addInvoiceAction,
  addStockDecisionAction,
  addOrderAction,
  addProjectNoteAction,
  finalizeProjectDocumentAction,
  generateSwissQrAction,
  sendDocumentMailAction,
  uploadProjectChatFileAction,
} from "@/app/(app)/actions";
import { getProjectFileSignedUrl } from "@/lib/storage/signed-urls";
import { ProjectWorkflowRail } from "@/components/app/project-workflow-rail";
import { ProjectGuidedProcess } from "@/components/app/project-guided-process";
import { GuidedPhaseSection } from "@/components/app/guided-phase-section";
import { PROJECT_WORKFLOW_STEPS } from "@/lib/workflow/project-workflow-rail";
import {
  buildGuidedTransitionOptions,
  getGuidedStepMeta,
} from "@/lib/workflow/project-guided-flow";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function ProjektDetailPage({ params }: Params) {
  const { id } = await params;
  const bundle = await getProjectBundle(id);

  if (!bundle) {
    notFound();
  }

  const projectChat = await listProjectChat(id);
  const attachmentsWithUrls = await Promise.all(
    projectChat.attachments.map(async (a) => ({
      ...a,
      href: await getProjectFileSignedUrl(a.filePath),
    })),
  );
  const supplierTemplates = await listSupplierTemplates();
  const session = await getCurrentSession();
  const contactId = bundle.project.contactId;
  const [contacts, properties, workTypes, profiles, personOptions, addressOptions, articles] = await Promise.all([
    listContacts(),
    listSiteProperties(),
    listProjectWorkTypes(),
    listAssignableProfiles(),
    listContactPersonsForContact(contactId),
    listContactAddressesForContact(contactId),
    listArticles(),
  ]);
  const stammdatenReadOnly = session?.role === "technician";

  const besichtigungAppointments = bundle.appointments.filter((a) => a.kind === "besichtigung");
  const ausfuehrungAppointments = bundle.appointments.filter((a) => a.kind === "ausfuehrung");

  const role = session?.role ?? "office";
  const guidedPhaseMeta = getGuidedStepMeta(bundle.project);
  const guidedPhaseIndex = guidedPhaseMeta.phaseIndex;
  const guidedOptions = buildGuidedTransitionOptions(bundle.project, role, {
    besichtigungAppointments: besichtigungAppointments.length,
    ausfuehrungAppointments: ausfuehrungAppointments.length,
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1 space-y-6">
          <ProjectGuidedProcess
            layoutVariant="full"
            projectId={bundle.project.id}
            phaseIndex={guidedPhaseIndex}
            totalSteps={guidedPhaseMeta.totalSteps}
            currentStepLabel={guidedPhaseMeta.stepLabel}
            currentStepHint={guidedPhaseMeta.stepHint}
            stepAnchorId={guidedPhaseMeta.stepAnchor}
            completed={guidedPhaseMeta.completed}
            steps={PROJECT_WORKFLOW_STEPS.map((s) => ({ id: s.id, label: s.label }))}
            options={guidedOptions.map((o) => ({
              to: o.to,
              label: o.label,
              isPrimary: o.isPrimary,
              canSubmit: o.canSubmit,
              missingFieldLabels: o.missingFieldLabels,
              prerequisiteMessages: o.prerequisiteMessages,
              nextOwnerRole: o.nextOwnerRole,
            }))}
          />

          {/* ── Phase 1: Auftragseingang & Erfassung ── */}
          <GuidedPhaseSection id="eingang" phaseIndex={0} currentPhaseIndex={guidedPhaseIndex}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Auftragseingang &amp; Erfassung</h2>
              <StatusBadge status={bundle.project.status} />
            </div>

            <ProjectStammdatenForm
              project={bundle.project}
              contacts={contacts}
              properties={properties}
              workTypes={workTypes}
              profiles={profiles}
              initialPersons={personOptions}
              initialAddresses={addressOptions}
              readOnly={stammdatenReadOnly}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-amber-50/60 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Originalaussage Kunde</p>
                <p className="text-sm leading-relaxed">{bundle.project.intakeOriginalText || <span className="italic text-muted-foreground">—</span>}</p>
              </div>
              <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hinweise für Monteure</p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Zugang: </span>{bundle.project.accessNotes ?? "—"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Schlüssel: </span>{bundle.project.keyHandlingNotes ?? "—"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Zeitfenster: </span>{bundle.project.timingNotes ?? "—"}
                </p>
              </div>
            </div>
          </div>
          </GuidedPhaseSection>

          {/* ── Phase 2: Ersttermin / Aufmass ── */}
          <GuidedPhaseSection id="termin" phaseIndex={1} currentPhaseIndex={guidedPhaseIndex}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">2</span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ersttermin / Aufmass planen</h2>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Besichtigungstermin</CardTitle>
                <CardDescription>
                  Termin mit Kunden vereinbaren. Büro organisiert, Monteur erhält Benachrichtigung / Kalendereintrag.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <form action={addAppointmentAction} className="grid gap-2 rounded-md border p-4 sm:grid-cols-2">
                  <input type="hidden" name="projectId" value={bundle.project.id} />
                  <input type="hidden" name="kind" value="besichtigung" />
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label htmlFor="t-starts" className="text-sm">Beginn</Label>
                    <Input id="t-starts" name="startsAt" type="datetime-local" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="t-ends" className="text-sm">Ende</Label>
                    <Input id="t-ends" name="endsAt" type="datetime-local" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Planungsnotiz</Label>
                    <VoiceTextarea name="planningNotes" placeholder="z. B. Zugang via Hauswart" />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" size="sm">Besichtigungstermin speichern</Button>
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

          {/* ── Phase 3: Rapport & Bestandsaufnahme ── */}
          <GuidedPhaseSection id="rapport" phaseIndex={2} currentPhaseIndex={guidedPhaseIndex}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">3</span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rapport &amp; Bestandsaufnahme</h2>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Technikerbericht</CardTitle>
                <CardDescription>
                  Monteur erfasst Diagnose, Masse und Entscheid vor Ort. Grundlage für Offerte und Bestellung.
                  Wenn nicht direkt lösbar: Infos müssen hier lückenlos stehen.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <TechnicianReportForm
                  projectId={bundle.project.id}
                  variant="full"
                  className="flex flex-col gap-3 rounded-md border p-4"
                  submitLabel="Bericht speichern"
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

          {/* ── Phase 4: Offerte & Freigabe ── */}
          <GuidedPhaseSection id="offerte" phaseIndex={3} currentPhaseIndex={guidedPhaseIndex}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">4</span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Offerte &amp; Freigabe</h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
              <Card className="h-full min-h-0">
                <CardHeader>
                  <CardTitle>Offerte erstellen</CardTitle>
                  <CardDescription>
                    Basierend auf Monteur-Rapport. Material + Arbeit. Per Mail versenden.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                  <QuoteDraftForm
                    projectId={bundle.project.id}
                    suggestedVersion={(bundle.quotes?.length ?? 0) + 1}
                    articleOptions={articles}
                    className="flex min-h-0 flex-1 flex-col gap-2 rounded-md border p-3"
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
                            <form action={finalizeProjectDocumentAction} className="flex items-center gap-2">
                              <input type="hidden" name="projectId" value={bundle.project.id} />
                              <input type="hidden" name="documentType" value="quote" />
                              <input type="hidden" name="documentId" value={q.id} />
                              <input type="hidden" name="deliveryChannel" value="post" />
                              <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs">Per Post finalisieren</Button>
                              <span className="text-xs text-muted-foreground">Kein Mailversand</span>
                            </form>
                            <form action={finalizeProjectDocumentAction} className="rounded-md border bg-background p-2">
                              <input type="hidden" name="projectId" value={bundle.project.id} />
                              <input type="hidden" name="documentType" value="quote" />
                              <input type="hidden" name="documentId" value={q.id} />
                              <input type="hidden" name="deliveryChannel" value="email" />
                              <div className="grid gap-1">
                                <Input name="emailTo" defaultValue={bundle.contact?.email ?? ""} placeholder="kunde@beispiel.ch" className="h-8 text-xs" />
                                <Input name="emailSubject" defaultValue={`Offerte ${bundle.project.title}`} className="h-8 text-xs" />
                                <VoiceTextarea name="emailHtml" defaultValue="<p>Guten Tag<br/>im Anhang erhalten Sie die Offerte als PDF.</p>" />
                                <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs">Per E-Mail finalisieren</Button>
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
                  <CardDescription>
                    Nach Offert-Freigabe: ab Lager lieferbar oder Bestellung nötig?
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                  <form action={addStockDecisionAction} className="flex min-h-0 flex-1 flex-col gap-2 rounded-md border p-3">
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label className="text-sm">Entscheid</Label>
                    <StockDecisionSelect />
                    <div className="min-h-[5rem] flex-1">
                      <VoiceTextarea name="notes" placeholder="Begründung / Bemerkung" required />
                    </div>
                    <Button className="mt-auto w-fit" type="submit" size="sm">Entscheid speichern</Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
          </GuidedPhaseSection>

          {/* ── Phase 5: Material & Bestellung ── */}
          <GuidedPhaseSection id="bestellung" phaseIndex={4} currentPhaseIndex={guidedPhaseIndex}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">5</span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Material &amp; Bestellung</h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Lieferanten-Bestellung</CardTitle>
                  <CardDescription>
                    Lieferantenspezifisches Formular — nichts geht vergessen. Admin prüft Vollständigkeit vor Versand.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {supplierTemplates.length > 0 ? (
                    supplierTemplates.slice(0, 1).map((template) => (
                      <SupplierOrderForm key={template.id} projectId={bundle.project.id} template={template} />
                    ))
                  ) : (
                    <form action={addOrderAction} className="flex flex-col gap-2 rounded-md border p-3">
                      <input type="hidden" name="projectId" value={bundle.project.id} />
                      <Label className="text-sm">Lieferant (ID)</Label>
                      <Input name="supplierId" placeholder="Lieferant-UUID" />
                      <Button type="submit" size="sm">Bestellung erfassen</Button>
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
                  <CardDescription>
                    Material kontrollieren, lagern, Lieferschein erfassen. Ware dem Projekt zuweisen.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <form action={addDeliveryAction} className="flex flex-col gap-2 rounded-md border p-3">
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label className="text-sm">Bestellung (optional, ID)</Label>
                    <Input name="purchaseOrderId" placeholder="Bestellungs-ID" />
                    <Label className="text-sm">Lieferscheinnummer</Label>
                    <Input name="deliveryNoteNumber" placeholder="z. B. LS-2024-001" />
                    <Button type="submit" size="sm">Wareneingang erfassen</Button>
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
                            <form action={finalizeProjectDocumentAction}>
                              <input type="hidden" name="projectId" value={bundle.project.id} />
                              <input type="hidden" name="documentType" value="delivery" />
                              <input type="hidden" name="documentId" value={d.id} />
                              <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs">Lieferschein PDF erzeugen</Button>
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

          {/* ── Phase 6: Ausführungstermin ── */}
          <GuidedPhaseSection id="ausfuehrung" phaseIndex={5} currentPhaseIndex={guidedPhaseIndex}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">6</span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ausführungstermin</h2>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>2. Termin planen</CardTitle>
                <CardDescription>
                  Büro organisiert Fertigstellungstermin. Zugang, Schlüssel, Anwesenheit und Zeitaufwand klären.
                  Alle bisherigen Notizen sind für den Monteur sichtbar.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <form action={addAppointmentAction} className="grid gap-2 rounded-md border p-4 sm:grid-cols-2">
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
                    <Button type="submit" size="sm">Ausführungstermin speichern</Button>
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

          {/* ── Phase 7: Montage & Fertigmeldung ── */}
          <GuidedPhaseSection id="fertigmeldung" phaseIndex={6} currentPhaseIndex={guidedPhaseIndex}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">7</span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Montage &amp; Fertigmeldung</h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Fertigmeldung</CardTitle>
                  <CardDescription>
                    Monteur meldet Arbeit als erledigt, trägt Zeiten ein und rapportiert was gemacht wurde.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <TechnicianReportForm
                    projectId={bundle.project.id}
                    variant="fertigmeldung"
                    className="flex flex-col gap-3 rounded-md border p-3"
                    submitLabel="Fertigmeldung speichern"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notizen</CardTitle>
                  <CardDescription>Handoffs bleiben nur sauber, wenn Notizen aktuell sind.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <form action={addProjectNoteAction} className="flex flex-col gap-2 rounded-md border p-3">
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label className="text-sm">Typ</Label>
                    <Input name="type" defaultValue="techniker" placeholder="techniker / intern / planung" className="h-9" />
                    <Label className="text-sm">Notiz</Label>
                    <VoiceTextarea name="body" required />
                    <Button type="submit" size="sm">Notiz speichern</Button>
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

          {/* ── Phase 8: Rechnung & Abschluss ── */}
          <GuidedPhaseSection id="rechnung" phaseIndex={7} currentPhaseIndex={guidedPhaseIndex}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">8</span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rechnung &amp; Abschluss</h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Rechnung</CardTitle>
                  <CardDescription>Admin prüft Rapport, Aufwand und Material. Rechnung erstellen und versenden.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <form action={addInvoiceAction} className="flex flex-col gap-2 rounded-md border p-3">
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label htmlFor="invoiceNumber" className="text-sm">Rechnungsnummer</Label>
                    <Input id="invoiceNumber" name="invoiceNumber" placeholder="z. B. RE-2024-042" className="h-9" />
                    <Button type="submit" size="sm">Rechnung vorbereiten</Button>
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
                            <form action={finalizeProjectDocumentAction} className="flex items-center gap-2">
                              <input type="hidden" name="projectId" value={bundle.project.id} />
                              <input type="hidden" name="documentType" value="invoice" />
                              <input type="hidden" name="documentId" value={inv.id} />
                              <input type="hidden" name="deliveryChannel" value="post" />
                              <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs">Per Post finalisieren</Button>
                              <span className="text-xs text-muted-foreground">Kein Mailversand</span>
                            </form>
                            <form action={finalizeProjectDocumentAction} className="rounded-md border bg-background p-2">
                              <input type="hidden" name="projectId" value={bundle.project.id} />
                              <input type="hidden" name="documentType" value="invoice" />
                              <input type="hidden" name="documentId" value={inv.id} />
                              <input type="hidden" name="deliveryChannel" value="email" />
                              <div className="grid gap-1">
                                <Input name="emailTo" defaultValue={bundle.contact?.email ?? ""} placeholder="kunde@beispiel.ch" className="h-8 text-xs" />
                                <Input name="emailSubject" defaultValue={`Rechnung ${bundle.project.title}`} className="h-8 text-xs" />
                                <VoiceTextarea name="emailHtml" defaultValue="<p>Guten Tag<br/>im Anhang erhalten Sie die Rechnung als PDF.</p>" />
                                <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs">Per E-Mail finalisieren</Button>
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
                  <form action={generateSwissQrAction} className="flex flex-col gap-2 rounded-md border p-3">
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
                    <Button className="mt-1" type="submit" size="sm">QR-Code erzeugen</Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
          </GuidedPhaseSection>

          {/* ── Kommunikation & interne Tools ── */}
          <div className="space-y-4 border-t border-border/60 pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kommunikation &amp; interne Tools</h2>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Team-Chat */}
              <Card id="team-chat">
                <CardHeader>
                  <CardTitle>Team-Chat</CardTitle>
                  <CardDescription>Nachrichten, Fotos und Dokumente zum Projekt.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <form action={addProjectChatMessageAction} className="rounded-md border p-3">
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <VoiceTextarea name="body" placeholder="Nachricht …" required />
                    <Button type="submit" className="mt-2" size="sm">Senden</Button>
                  </form>
                  <form action={uploadProjectChatFileAction} className="rounded-md border p-3">
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Label className="text-sm font-medium">Datei hochladen (Bild, PDF, Word)</Label>
                    <Input
                      name="file"
                      type="file"
                      required
                      className="mt-1"
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    />
                    <Button type="submit" className="mt-2" size="sm">Hochladen &amp; teilen</Button>
                  </form>
                  {attachmentsWithUrls.length > 0 ? (
                    <div className="rounded-md border p-3">
                      <p className="mb-2 text-sm font-medium">Anhänge</p>
                      <ul className="flex flex-col gap-1 text-sm">
                        {attachmentsWithUrls.map((a) => (
                          <li key={a.id}>
                            {a.href ? (
                              <a href={a.href} className="text-primary underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
                                {a.fileName}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">{a.fileName}</span>
                            )}
                            <span className="ml-1 text-xs text-muted-foreground">({a.fileType})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {projectChat.messages.length > 0 ? (
                    <div className="rounded-md border p-3">
                      <p className="mb-2 text-sm font-medium">Verlauf</p>
                      <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                        {projectChat.messages.map((message) => (
                          <div key={message.id} className="rounded-md bg-slate-50 p-2 text-sm">
                            <p className="font-medium">{message.senderName}</p>
                            <p>{message.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Mail senden */}
              <Card>
                <CardHeader>
                  <CardTitle>Mail senden</CardTitle>
                  <CardDescription>Offerte, Bestellung oder Rechnung direkt per SMTP versenden.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={sendDocumentMailAction} className="flex flex-col gap-2 rounded-md border p-3">
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <Input name="to" placeholder="kunde@beispiel.ch" required />
                    <Input name="subject" placeholder="Betreff (z. B. Offerte RE-2024-042)" required />
                    <VoiceTextarea name="html" placeholder="Mailinhalt (HTML erlaubt)" required />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input name="icsTitle" placeholder="Termin Titel (optional)" />
                      <Input name="icsDescription" placeholder="Termin Beschreibung (optional)" />
                      <Input name="icsStartsAt" type="datetime-local" />
                      <Input name="icsEndsAt" type="datetime-local" />
                    </div>
                    <input type="hidden" name="includeIcs" value="true" />
                    <Button className="mt-1" type="submit" size="sm">Mail senden</Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>

        </div>
        <ProjectWorkflowRail status={bundle.project.status} />
      </div>
    </section>
  );
}
