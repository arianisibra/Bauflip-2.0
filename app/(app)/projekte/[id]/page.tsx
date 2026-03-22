import { notFound } from "next/navigation";
import {
  getProjectBundle,
  listKanbanCards,
  listKanbanColumns,
  listProjectChat,
  listSupplierTemplates,
} from "@/lib/db/repository";
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
import { Badge } from "@/components/ui/badge";
import { VoiceTextarea } from "@/components/app/voice-textarea";
import { SupplierOrderForm } from "@/components/app/supplier-order-form";
import {
  addAppointmentAction,
  addDeliveryAction,
  addProjectChatAttachmentAction,
  addProjectChatMessageAction,
  addInvoiceAction,
  addStockDecisionAction,
  addOrderAction,
  addProjectNoteAction,
  addQuoteAction,
  addTechnicianReportAction,
  generateSwissQrAction,
  renameKanbanColumnAction,
  sendDocumentMailAction,
  transitionProjectAction,
} from "@/app/(app)/actions";
import {
  getAllowedTransitions,
  getMissingFieldsForTransition,
  statusLabels,
} from "@/lib/workflow/project-workflow";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function ProjektDetailPage({ params }: Params) {
  const { id } = await params;
  const bundle = await getProjectBundle(id);

  if (!bundle) {
    notFound();
  }

  const transitions = getAllowedTransitions(bundle.project.status);
  const kanbanColumns = await listKanbanColumns(id);
  const kanbanCards = await listKanbanCards(id);
  const projectChat = await listProjectChat(id);
  const supplierTemplates = await listSupplierTemplates();
  const nextTransition = transitions.find(
    (transition) => getMissingFieldsForTransition(bundle.project, transition.to).length === 0,
  );
  const colorClasses: Record<string, string> = {
    blue: "border-blue-300 bg-blue-50",
    orange: "border-orange-300 bg-orange-50",
    green: "border-emerald-300 bg-emerald-50",
    violet: "border-violet-300 bg-violet-50",
    slate: "border-slate-300 bg-slate-50",
  };

  return (
    <section className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-2xl">{bundle.project.title}</CardTitle>
            <StatusBadge status={bundle.project.status} />
          </div>
          <CardDescription>
            Kunde: {bundle.customer?.name ?? "-"} · Typ: {bundle.project.type} · Nächster Owner:{" "}
            {bundle.project.nextOwnerRole}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase text-muted-foreground">Originalaussage</p>
            <p className="mt-1 text-sm">{bundle.project.intakeOriginalText}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase text-muted-foreground">Zugang / Schlüssel / Zeit</p>
            <p className="mt-1 text-sm">
              Zugang: {bundle.project.accessNotes ?? "-"}
              <br />
              Schlüssel: {bundle.project.keyHandlingNotes ?? "-"}
              <br />
              Zeit: {bundle.project.timingNotes ?? "-"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-cyan-200 bg-cyan-50/60">
        <CardHeader>
          <CardTitle>Geführter Prozess</CardTitle>
          <CardDescription>
            Sie sehen immer nur den nächsten sinnvollen Schritt im Ablauf.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Aktueller Status</p>
            <p className="text-lg font-semibold">{statusLabels[bundle.project.status]}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Nächste Aktion</p>
            <p className="text-lg font-semibold">
              {nextTransition ? statusLabels[nextTransition.to] : "Keine weitere Aktion"}
            </p>
          </div>
          {nextTransition ? (
            <form action={transitionProjectAction}>
              <input type="hidden" name="projectId" value={bundle.project.id} />
              <input type="hidden" name="targetStatus" value={nextTransition.to} />
              <Button type="submit">Weiter zu {statusLabels[nextTransition.to]}</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projekt-Kanban</CardTitle>
            <CardDescription>
              Spaltennamen frei anpassbar. Statuswechsel verschiebt Karten automatisch.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="grid min-w-[900px] grid-cols-4 gap-3">
              {kanbanColumns.map((column) => (
                <div
                  key={column.id}
                  className={`rounded-lg border p-3 ${colorClasses[column.color] ?? colorClasses.slate}`}
                >
                  <form action={renameKanbanColumnAction} className="mb-2 flex items-center gap-2">
                    <input type="hidden" name="columnId" value={column.id} />
                    <Input name="title" defaultValue={column.title} />
                    <Button size="sm" type="submit">OK</Button>
                  </form>
                  <p className="mb-2 text-xs text-muted-foreground">Status: {statusLabels[column.status]}</p>
                  <div className="space-y-2">
                    {kanbanCards
                      .filter((card) => card.columnId === column.id)
                      .map((card) => (
                        <div key={card.id} className="rounded-md border bg-white p-2 text-sm">
                          <p className="font-medium">{card.title}</p>
                          <p className="text-xs text-muted-foreground">{statusLabels[card.status]}</p>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team-Chat (pro Projekt)</CardTitle>
            <CardDescription>Nachrichten, Bilder und PDF sind am Projekt und Termin referenziert.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={addProjectChatMessageAction} className="rounded-md border p-3">
              <input type="hidden" name="projectId" value={bundle.project.id} />
              <Input name="appointmentId" placeholder="Termin-ID (optional)" />
              <VoiceTextarea name="body" placeholder="Nachricht an Monteure..." required />
              <Button type="submit" className="mt-2" size="sm">Nachricht senden</Button>
            </form>
            <form action={addProjectChatAttachmentAction} className="rounded-md border p-3">
              <input type="hidden" name="projectId" value={bundle.project.id} />
              <Input name="messageId" placeholder="Nachricht-ID" required />
              <Input name="fileName" placeholder="Dateiname (z.B. foto.jpg)" required />
              <Input name="fileType" placeholder="Dateityp (image/jpeg, application/pdf)" required />
              <Input name="filePath" placeholder="Storage-Pfad oder URL" required />
              <Button type="submit" className="mt-2" size="sm">Anhang speichern</Button>
            </form>
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
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status wechseln</CardTitle>
            <CardDescription>Nur zulässige nächste Schritte werden angeboten.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {transitions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kein weiterer Statuswechsel möglich.</p>
            ) : (
              transitions.map((transition) => {
                const missing = getMissingFieldsForTransition(bundle.project, transition.to);
                return (
                  <form key={transition.to} action={transitionProjectAction} className="rounded-md border p-3">
                    <input type="hidden" name="projectId" value={bundle.project.id} />
                    <input type="hidden" name="targetStatus" value={transition.to} />
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Badge variant="outline">{statusLabels[transition.to]}</Badge>
                      <Button type="submit" size="sm" disabled={missing.length > 0}>
                        Weiter
                      </Button>
                    </div>
                    {missing.length > 0 ? (
                      <p className="text-xs text-destructive">
                        Fehlt: {missing.join(", ")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Nächster Owner: {transition.nextOwnerRole}
                      </p>
                    )}
                  </form>
                );
              })
            )}
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
              <Label htmlFor="noteType">Notiztyp</Label>
              <Input id="noteType" name="type" defaultValue="intern" />
              <Label htmlFor="noteBody">Notiz</Label>
              <VoiceTextarea id="noteBody" name="body" required />
              <Button type="submit" size="sm">Notiz speichern</Button>
            </form>
            {bundle.notes.map((note) => (
              <div key={note.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{note.type}</p>
                <p>{note.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Termine</CardTitle>
            <CardDescription>Besichtigung und Ausführung sauber planen.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={addAppointmentAction} className="flex flex-col gap-2 rounded-md border p-3">
              <input type="hidden" name="projectId" value={bundle.project.id} />
              <Label htmlFor="kind">Art</Label>
              <Input id="kind" name="kind" placeholder="besichtigung oder ausfuehrung" />
              <Label htmlFor="startsAt">Start</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" required />
              <Label htmlFor="endsAt">Ende</Label>
              <Input id="endsAt" name="endsAt" type="datetime-local" required />
              <VoiceTextarea name="planningNotes" placeholder="Planungsnotiz" />
              <Button type="submit" size="sm">Termin speichern</Button>
            </form>
            {bundle.appointments.map((appointment) => (
              <div key={appointment.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{appointment.kind}</p>
                <p>{appointment.startsAt}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Technikerbericht</CardTitle>
            <CardDescription>Messdaten und Diagnose sind Grundlage für Offerte und Bestellung.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={addTechnicianReportAction} className="flex flex-col gap-2 rounded-md border p-3">
              <input type="hidden" name="projectId" value={bundle.project.id} />
              <Input name="outcome" placeholder="direkt_geloest" required />
              <VoiceTextarea name="summary" placeholder="Diagnose" required />
              <VoiceTextarea name="measurementsJson" placeholder='{"breite_mm": 1200}' required />
              <VoiceTextarea name="workDescription" placeholder="Massnahme" required />
              <Input name="timeSpentMinutes" type="number" placeholder="Zeit in Minuten" />
              <Button type="submit" size="sm">Bericht speichern</Button>
            </form>
            {bundle.reports.map((report) => (
              <div key={report.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{report.outcome}</p>
                <p>{report.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Offerte und Bestellung</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={addQuoteAction} className="flex flex-col gap-2 rounded-md border p-3">
              <input type="hidden" name="projectId" value={bundle.project.id} />
              <Label htmlFor="version">Offerte-Version</Label>
              <Input id="version" name="version" type="number" defaultValue={1} />
              <Button type="submit" size="sm">Offerte erstellen</Button>
            </form>
            <form action={addOrderAction} className="flex flex-col gap-2 rounded-md border p-3">
              <input type="hidden" name="projectId" value={bundle.project.id} />
              <Label htmlFor="supplierId">Lieferant</Label>
              <Input id="supplierId" name="supplierId" placeholder="supplier-uuid" />
              <Button type="submit" size="sm">Bestellung erfassen</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wareneingang und Rechnung</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={addDeliveryAction} className="flex flex-col gap-2 rounded-md border p-3">
              <input type="hidden" name="projectId" value={bundle.project.id} />
              <Input name="purchaseOrderId" placeholder="Bestellung (optional)" />
              <Input name="deliveryNoteNumber" placeholder="Lieferscheinnummer" />
              <Button type="submit" size="sm">Wareneingang erfassen</Button>
            </form>
            <form action={addInvoiceAction} className="flex flex-col gap-2 rounded-md border p-3">
              <input type="hidden" name="projectId" value={bundle.project.id} />
              <Input name="invoiceNumber" placeholder="Rechnungsnummer" />
              <Button type="submit" size="sm">Rechnung vorbereiten</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lagerentscheidung nach Offerte</CardTitle>
            <CardDescription>
              Nach Versand der Offerte muss entschieden werden: ab Lager oder bestellen.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={addStockDecisionAction} className="rounded-md border p-3">
              <input type="hidden" name="projectId" value={bundle.project.id} />
              <Label htmlFor="decision">Entscheid</Label>
              <select id="decision" name="decision" className="h-10 rounded-lg border border-input px-3">
                <option value="ab_lager">Ab Lager</option>
                <option value="bestellen">Bestellen</option>
              </select>
              <VoiceTextarea name="notes" placeholder="Begründung / Bemerkung" required />
              <Button className="mt-2" type="submit">
                Entscheid speichern
              </Button>
            </form>
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              Jede Bewegung wird im Admin-Log protokolliert.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bestellformular je Lieferant</CardTitle>
            <CardDescription>
              Pflichtfelder sind hart validiert. Ohne vollständige Eingabe kein Abschluss.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {supplierTemplates.slice(0, 1).map((template) => (
              <SupplierOrderForm key={template.id} projectId={bundle.project.id} template={template} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dokumente direkt per Mail senden</CardTitle>
            <CardDescription>Versand über SMTP (Google/Outlook/Custom) mit Signatur.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={sendDocumentMailAction} className="rounded-md border p-3">
              <input type="hidden" name="projectId" value={bundle.project.id} />
              <Input name="to" placeholder="kunde@beispiel.ch" required />
              <Input name="subject" placeholder="Offerte / Bestellung / Rechnung" required />
              <VoiceTextarea name="html" placeholder="Mailinhalt (HTML erlaubt)" required />
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <Input name="icsTitle" placeholder="Termin Titel (optional)" />
                <Input name="icsDescription" placeholder="Termin Beschreibung (optional)" />
                <Input name="icsStartsAt" type="datetime-local" />
                <Input name="icsEndsAt" type="datetime-local" />
              </div>
              <input type="hidden" name="includeIcs" value="true" />
              <Button className="mt-2" type="submit">Mail senden</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schweizer Rechnungs-QR</CardTitle>
            <CardDescription>
              QR-Code für Einzahlungsschein / QR-Rechnung auf Basis der Rechnungsdaten.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={generateSwissQrAction} className="rounded-md border p-3">
              <div className="grid gap-2 md:grid-cols-2">
                <Input name="iban" placeholder="CH44..." required />
                <Input name="amount" placeholder="1200.00" required />
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
              <Button className="mt-2" type="submit">QR-Code erzeugen</Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Hinweis: QR wird serverseitig erzeugt und kann in Rechnungsdokument eingebettet werden.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
