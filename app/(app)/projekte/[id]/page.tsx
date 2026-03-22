import { notFound } from "next/navigation";
import { getProjectBundle } from "@/lib/db/repository";
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
import {
  addAppointmentAction,
  addDeliveryAction,
  addInvoiceAction,
  addOrderAction,
  addProjectNoteAction,
  addQuoteAction,
  addTechnicianReportAction,
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
  const nextTransition = transitions.find(
    (transition) => getMissingFieldsForTransition(bundle.project, transition.to).length === 0,
  );

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
    </section>
  );
}
