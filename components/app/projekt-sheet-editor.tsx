"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectCore } from "@/lib/db/repository";
import type { UserProfile } from "@/lib/domain/types";
import { projectStatusLabels } from "@/lib/domain/types";
import {
  addAppointmentAction,
  deleteAppointmentAction,
  getProjectSheetDataAction,
  updateProjectStammdatenAction,
} from "@/app/(app)/projekte/actions";
import { uploadProjectReportFileAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    return <p className="text-sm text-red-600">{error}</p>;
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
            await load();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
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
                  {new Date(a.startsAt).toLocaleString("de-CH")} – {new Date(a.endsAt).toLocaleTimeString("de-CH")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={async () => {
                    if (!window.confirm("Termin löschen?")) return;
                    await deleteAppointmentAction(a.id);
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

      <section className="border-t pt-4">
        <h3 className="mb-2 text-sm font-semibold">Letzte Rapporte</h3>
        <ul className="space-y-3 text-sm">
          {core.reports.map((r) => (
            <li key={r.id} className="rounded border px-2 py-2">
              <div>
                <span className="font-medium">{r.outcome === "schaden_behoben" ? "Behoben" : "Aufgenommen"}</span>
                {r.summary ? <span className="text-muted-foreground"> — {r.summary}</span> : null}
              </div>
              {r.workDescription?.trim() ? (
                <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{r.workDescription}</p>
              ) : null}
              {r.orderForms.length > 0 ? (
                <ul className="mt-2 space-y-2 border-t border-border/60 pt-2 text-xs">
                  {r.orderForms.map((of) => (
                    <li key={`${r.id}-${of.templateId}`} className="rounded-md bg-muted/30 px-2 py-1.5">
                      <p className="font-medium text-foreground">{of.templateName}</p>
                      <dl className="mt-1 space-y-0.5">
                        {of.fields.map((f) => (
                          <div key={f.key} className="flex flex-wrap gap-x-2">
                            <dt className="text-muted-foreground">{f.label}:</dt>
                            <dd className="font-medium">{of.values[f.key]?.trim() || "—"}</dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
