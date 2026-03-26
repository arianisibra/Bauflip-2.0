"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  getContactProjectOptionsAction,
  getProjectSheetDataAction,
  updateProjectStammdatenAction,
} from "@/app/(app)/projekte/actions";
import { buildGoogleMapsSearchUrl } from "@/lib/maps/google-maps";
import { projectStammdatenUpdateSchema } from "@/lib/validations/forms";
import type { ContactAddress, ContactPerson, Project } from "@/lib/domain/types";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProjectGuidedProcess } from "@/components/app/project-guided-process";
import { ProjectSheetPhasePanels } from "@/components/app/project-sheet-phase-panels";
import { ProjectWorkflowRailSheet } from "@/components/app/project-workflow-rail-sheet";
import { BauflipLoading, BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { PROJECT_WORKFLOW_STEPS, getWorkflowPhaseIndex } from "@/lib/workflow/project-workflow-rail";
import { buildGuidedTransitionOptions, getGuidedStepMeta } from "@/lib/workflow/project-guided-flow";
import { cn } from "@/lib/utils";

type FormValues = z.infer<typeof projectStammdatenUpdateSchema>;

const empty = "";

const typeLabel: Record<string, string> = {
  reparatur: "Reparatur",
  ersatz: "Ersatz",
  neuinstallation: "Neuinstallation",
};

const urgencyLabel: Record<string, string> = {
  normal: "Normal",
  hoch: "Hoch",
  kritisch: "Kritisch",
};

const sourceLabel: Record<string, string> = {
  whatsapp: "WhatsApp",
  telefon: "Telefon",
  email: "E-Mail",
};

function bundleToFormValues(project: Project): Omit<FormValues, "newWorkTypeName"> & { newWorkTypeName: string } {
  return {
    projectId: project.id,
    contactId: project.contactId,
    title: project.title,
    tenantUnit: project.tenantUnit ?? "",
    sitePhone: project.sitePhone ?? "",
    siteMobile: project.siteMobile ?? "",
    referenceCode: project.referenceCode ?? "",
    technicianNotes: project.technicianNotes ?? "",
    propertyId: project.propertyId ?? "",
    mapsUrl: project.mapsUrl ?? "",
    workTypeId: project.workTypeId ?? "",
    contactPersonId: project.contactPersonId ?? "",
    serviceAddressId: project.serviceAddressId ?? "",
    billingAddressId: project.billingAddressId ?? "",
    hintsAndNotes: project.hintsAndNotes ?? "",
    nextOwnerUserId: project.nextOwnerUserId ?? "",
    newWorkTypeName: "",
    intakeOriginalText: project.intakeOriginalText,
    accessNotes: project.accessNotes ?? "",
    keyHandlingNotes: project.keyHandlingNotes ?? "",
    timingNotes: project.timingNotes ?? "",
    internalNotes: project.internalNotes ?? "",
  };
}

type SheetPayload = Awaited<ReturnType<typeof getProjectSheetDataAction>>;

/** Platzhalter für optionale Selects (Base UI erlaubt kein leeres `value`). */
const SELECT_EMPTY = "__none__";

function mapEmptyFromSelect(v: unknown) {
  return v === SELECT_EMPTY ? empty : String(v);
}

function mapEmptyToSelect(v: string | null | undefined) {
  return v != null && String(v).length > 0 ? String(v) : SELECT_EMPTY;
}

type Props = {
  projectId: string | null;
  open: boolean;
  canEdit: boolean;
};

const STEP_ID_TO_PHASE_INDEX = Object.fromEntries(PROJECT_WORKFLOW_STEPS.map((s, i) => [s.id, i])) as Record<
  string,
  number
>;

export function ProjektSheetEditor({ projectId, open, canEdit }: Props) {
  const router = useRouter();
  const [loadPending, startLoad] = useTransition();
  const [savePending, startSave] = useTransition();
  const [bundleReady, setBundleReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [payload, setPayload] = useState<SheetPayload | null>(null);
  const [persons, setPersons] = useState<ContactPerson[]>([]);
  const [addresses, setAddresses] = useState<ContactAddress[]>([]);
  const [viewPhaseIndex, setViewPhaseIndex] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(projectStammdatenUpdateSchema),
  });

  const contactId = form.watch("contactId");
  const propertyId = form.watch("propertyId");
  const serviceAddressId = form.watch("serviceAddressId");

  const selectedProperty = useMemo(
    () => payload?.properties.find((x) => x.id === propertyId) ?? null,
    [payload?.properties, propertyId],
  );
  const selectedServiceAddress = useMemo(
    () => addresses.find((x) => x.id === serviceAddressId) ?? null,
    [addresses, serviceAddressId],
  );

  useEffect(() => {
    const currentMapsUrl = String(form.getValues("mapsUrl") ?? "").trim();
    if (currentMapsUrl) {
      return;
    }
    if (selectedServiceAddress) {
      const url = buildGoogleMapsSearchUrl({
        street: selectedServiceAddress.street,
        postalCode: selectedServiceAddress.postalCode,
        city: selectedServiceAddress.city,
        country: selectedServiceAddress.country,
      });
      if (url) {
        form.setValue("mapsUrl", url);
      }
      return;
    }
    if (selectedProperty) {
      const url = selectedProperty.mapsUrl
        ? selectedProperty.mapsUrl
        : buildGoogleMapsSearchUrl({
            street: selectedProperty.street,
            postalCode: selectedProperty.postalCode,
            city: selectedProperty.city,
            country: selectedProperty.country,
          });
      if (url) {
        form.setValue("mapsUrl", url);
      }
    }
  }, [form, selectedProperty, selectedServiceAddress]);

  useEffect(() => {
    if (!open || !projectId) {
      setBundleReady(false);
      setPayload(null);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    setBundleReady(false);
    startLoad(async () => {
      try {
        const data = await getProjectSheetDataAction(projectId);
        if (cancelled) {
          return;
        }
        setPayload(data);
        setPersons(data.persons);
        setAddresses(data.addresses);
        form.reset(bundleToFormValues(data.bundle.project));
        setBundleReady(true);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, form]);

  const reloadSheetData = useCallback(() => {
    if (!projectId || !open) {
      return;
    }
    setLoadError(null);
    startLoad(async () => {
      try {
        const data = await getProjectSheetDataAction(projectId);
        setPayload(data);
        setPersons(data.persons);
        setAddresses(data.addresses);
        form.reset(bundleToFormValues(data.bundle.project));
        setBundleReady(true);
        router.refresh();
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Aktualisieren fehlgeschlagen.");
      }
    });
  }, [projectId, open, form, router]);

  useEffect(() => {
    if (!contactId || !open) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { persons: p, addresses: a } = await getContactProjectOptionsAction(contactId);
        if (!cancelled) {
          setPersons(p);
          setAddresses(a);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contactId, open]);

  const syncProjectId = payload?.bundle.project?.id;
  const syncProjectStatus = payload?.bundle.project?.status;
  useEffect(() => {
    if (syncProjectId && syncProjectStatus) {
      setViewPhaseIndex(getWorkflowPhaseIndex(syncProjectStatus));
    }
  }, [syncProjectId, syncProjectStatus]);

  const fillMapsFromProperty = () => {
    if (!selectedProperty) {
      return;
    }
    if (selectedProperty.mapsUrl) {
      form.setValue("mapsUrl", selectedProperty.mapsUrl);
      return;
    }
    const url = buildGoogleMapsSearchUrl({
      street: selectedProperty.street,
      postalCode: selectedProperty.postalCode,
      city: selectedProperty.city,
      country: selectedProperty.country,
    });
    if (url) {
      form.setValue("mapsUrl", url);
    }
  };

  const fillMapsFromServiceAddress = () => {
    if (!selectedServiceAddress) {
      return;
    }
    const url = buildGoogleMapsSearchUrl({
      street: selectedServiceAddress.street,
      postalCode: selectedServiceAddress.postalCode,
      city: selectedServiceAddress.city,
      country: selectedServiceAddress.country,
    });
    if (url) {
      form.setValue("mapsUrl", url);
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    setSaveError(null);
    startSave(async () => {
      try {
        await updateProjectStammdatenAction(values);
        if (projectId) {
          const fresh = await getProjectSheetDataAction(projectId);
          setPayload(fresh);
          setPersons(fresh.persons);
          setAddresses(fresh.addresses);
          form.reset(bundleToFormValues(fresh.bundle.project));
        }
        router.refresh();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      }
    });
  });

  if (!projectId) {
    return null;
  }

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>;
  }

  if ((loadPending || !bundleReady) && !loadError) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center py-6">
        <BauflipLoading label="Projekt wird geladen …" size="sm" />
      </div>
    );
  }

  const project = payload?.bundle.project;
  const contacts = payload?.contacts ?? [];
  const properties = payload?.properties ?? [];
  const workTypes = payload?.workTypes ?? [];
  const profiles = payload?.profiles ?? [];

  if (!project) {
    return null;
  }

  const ro = !canEdit;

  const guidedPhaseMeta = getGuidedStepMeta(project);
  const guidedPhaseIndex = guidedPhaseMeta.phaseIndex;
  const actorRole = payload.actorRole ?? "office";
  const supplierTemplates = payload.supplierTemplates ?? [];
  const articles = payload.articles ?? [];
  const guidedOptions = buildGuidedTransitionOptions(project, actorRole, {
    besichtigungAppointments: payload.bundle.appointments.filter((a) => a.kind === "besichtigung").length,
    ausfuehrungAppointments: payload.bundle.appointments.filter((a) => a.kind === "ausfuehrung").length,
    reports: payload.bundle.reports.length,
    quotes: payload.bundle.quotes.length,
    quoteFinalized: payload.bundle.quotes.filter((q) => Boolean(q.finalizedAt) || Boolean(q.deliverySentAt)).length,
    orders: payload.bundle.orders.length,
    deliveries: payload.bundle.deliveries.length,
    invoices: payload.bundle.invoices.length,
    invoiceFinalized: payload.bundle.invoices.filter((inv) => Boolean(inv.finalizedAt) || Boolean(inv.deliverySentAt)).length,
  });

  const handleNavigateToStep = (stepId: string) => {
    const idx = STEP_ID_TO_PHASE_INDEX[stepId];
    if (typeof idx === "number") {
      setViewPhaseIndex(idx);
    }
  };

  const kopfSummary = [
    typeLabel[project.type] ?? project.type,
    urgencyLabel[project.urgency] ?? project.urgency,
    sourceLabel[project.source] ?? project.source,
    `Geändert ${new Date(project.updatedAt).toLocaleString("de-CH")}`,
  ].join(" · ");

  const stammdatenForm = (
    <form id="eingang" onSubmit={onSubmit} className="flex flex-col gap-8 scroll-mt-4">
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          1
        </span>
        <h2 className="text-sm font-semibold text-foreground">Auftragseingang &amp; Erfassung</h2>
      </div>

      <details className="rounded-lg border border-border/60 bg-muted/10 text-sm">
        <summary className="cursor-pointer list-none px-3 py-2.5 marker:hidden [&::-webkit-details-marker]:hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs text-muted-foreground">Metadaten</span>
              <span className="mt-0.5 block text-sm text-foreground">{kopfSummary}</span>
            </div>
            <span className="shrink-0 text-xs text-primary">Mehr</span>
          </div>
        </summary>
        <div className="grid gap-2 border-t border-border/50 px-3 py-3 sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Typ · </span>
            <span>{typeLabel[project.type] ?? project.type}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Dringlichkeit · </span>
            <span>{urgencyLabel[project.urgency] ?? project.urgency}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">Quelle · </span>
            <span>{sourceLabel[project.source] ?? project.source}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">Erstellt · </span>
            <span>{new Date(project.createdAt).toLocaleString("de-CH")}</span>
            {" · "}
            <span className="text-muted-foreground">Geändert · </span>
            <span>{new Date(project.updatedAt).toLocaleString("de-CH")}</span>
          </div>
        </div>
      </details>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <h3 className="text-sm font-medium text-muted-foreground">Eingang &amp; Planung</h3>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Originalaussage (Kunde)</Label>
            <Textarea
              className="min-h-[7rem] text-sm"
              disabled={ro}
              {...form.register("intakeOriginalText")}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Zugang</Label>
              <Textarea className="min-h-[4.5rem] text-sm" disabled={ro} {...form.register("accessNotes")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Schlüssel / Zutritt</Label>
              <Textarea className="min-h-[4.5rem] text-sm" disabled={ro} {...form.register("keyHandlingNotes")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Zeitfenster</Label>
              <Textarea className="min-h-[4.5rem] text-sm" disabled={ro} {...form.register("timingNotes")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Interne Notizen</Label>
              <Textarea className="min-h-[4.5rem] text-sm" disabled={ro} {...form.register("internalNotes")} />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <h3 className="text-sm font-medium text-muted-foreground">Projekt &amp; Zuordnung</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-sm">Projekttitel</Label>
            <Input className="h-9" disabled={ro} {...form.register("title")} />
            {form.formState.errors.title ? (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Referenz</Label>
            <Input className="h-9" disabled={ro} {...form.register("referenceCode")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Mieter / Wohnung</Label>
            <Input className="h-9" disabled={ro} {...form.register("tenantUnit")} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ps-contactId" className="text-sm">
              Auftraggeber (Kontakt)
            </Label>
            <Controller
              control={form.control}
              name="contactId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={ro}>
                  <SelectTrigger id="ps-contactId" className="h-9 w-full min-w-0">
                    <SelectValue
                      placeholder="Kontakt wählen"
                      resolvedLabel={field.value ? (() => { const c = contacts.find((x) => x.id === field.value); return c ? `${c.name}${c.contactNumber ? ` (${c.contactNumber})` : ""}` : ""; })() : ""}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.contactNumber ? ` (${c.contactNumber})` : ""}
                      </SelectItem>
                    ))}
                    {project.contactId && !contacts.some((c) => c.id === project.contactId) ? (
                      <SelectItem value={project.contactId}>Kontakt nicht in Liste (gespeichert)</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ps-contactPersonId" className="text-sm">
              Ansprechpartner
            </Label>
            <Controller
              control={form.control}
              name="contactPersonId"
              render={({ field }) => (
                <Select
                  value={mapEmptyToSelect(field.value)}
                  onValueChange={(v) => field.onChange(mapEmptyFromSelect(v))}
                  disabled={ro}
                >
                  <SelectTrigger id="ps-contactPersonId" className="h-9 w-full min-w-0">
                    <SelectValue
                      placeholder="—"
                      resolvedLabel={field.value ? (persons.find((p) => p.id === field.value) ? [persons.find((p) => p.id === field.value)!.firstName, persons.find((p) => p.id === field.value)!.lastName].filter(Boolean).join(" ") || "—" : "") : ""}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_EMPTY}>—</SelectItem>
                    {persons.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {[p.firstName, p.lastName].filter(Boolean).join(" ") || "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ps-workTypeId" className="text-sm">
              Arbeitsart
            </Label>
            <Controller
              control={form.control}
              name="workTypeId"
              render={({ field }) => (
                <Select
                  value={mapEmptyToSelect(field.value)}
                  onValueChange={(v) => field.onChange(mapEmptyFromSelect(v))}
                  disabled={ro}
                >
                  <SelectTrigger id="ps-workTypeId" className="h-9 w-full min-w-0">
                    <SelectValue
                      placeholder="—"
                      resolvedLabel={field.value ? (workTypes.find((w) => w.id === field.value)?.name ?? "") : ""}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_EMPTY}>—</SelectItem>
                    {workTypes.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-sm">Neue Arbeitsart (optional)</Label>
            <Input className="h-9" disabled={ro} {...form.register("newWorkTypeName")} placeholder="Wird angelegt und ausgewählt" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ps-nextOwnerUserId" className="text-sm">
              Zugeordneter Mitarbeiter
            </Label>
            <Controller
              control={form.control}
              name="nextOwnerUserId"
              render={({ field }) => (
                <Select
                  value={mapEmptyToSelect(field.value)}
                  onValueChange={(v) => field.onChange(mapEmptyFromSelect(v))}
                  disabled={ro}
                >
                  <SelectTrigger id="ps-nextOwnerUserId" className="h-9 w-full min-w-0">
                    <SelectValue
                      placeholder="—"
                      resolvedLabel={field.value ? (profiles.find((p) => p.id === field.value)?.displayName ?? "") : ""}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_EMPTY}>—</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <h3 className="text-sm font-medium text-muted-foreground">Objekt &amp; Erreichbarkeit</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ps-propertyId" className="text-sm">
              Objekt (Standort)
            </Label>
            <Controller
              control={form.control}
              name="propertyId"
              render={({ field }) => (
                <Select
                  value={mapEmptyToSelect(field.value)}
                  onValueChange={(v) => field.onChange(mapEmptyFromSelect(v))}
                  disabled={ro}
                >
                  <SelectTrigger id="ps-propertyId" className="h-9 w-full min-w-0">
                    <SelectValue
                      placeholder="—"
                      resolvedLabel={field.value ? (properties.find((p) => p.id === field.value)?.name ?? "") : ""}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_EMPTY}>—</SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={ro} onClick={fillMapsFromProperty}>
              Maps aus Objekt
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={ro} onClick={fillMapsFromServiceAddress}>
              Maps aus Einsatzadresse
            </Button>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-sm">Google Maps (Link)</Label>
            <Input className="h-9" disabled={ro} placeholder="https://…" {...form.register("mapsUrl")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Telefon (Objekt)</Label>
            <Input className="h-9" disabled={ro} {...form.register("sitePhone")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Mobil (Objekt)</Label>
            <Input className="h-9" disabled={ro} {...form.register("siteMobile")} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ps-serviceAddressId" className="text-sm">
              Einsatzadresse
            </Label>
            <Controller
              control={form.control}
              name="serviceAddressId"
              render={({ field }) => (
                <Select
                  value={mapEmptyToSelect(field.value)}
                  onValueChange={(v) => field.onChange(mapEmptyFromSelect(v))}
                  disabled={ro}
                >
                  <SelectTrigger id="ps-serviceAddressId" className="h-9 w-full min-w-0">
                    <SelectValue
                      placeholder="—"
                      resolvedLabel={field.value ? (() => { const a = addresses.find((x) => x.id === field.value); return a ? `${a.label}: ${[a.street, `${a.postalCode ?? ""} ${a.city ?? ""}`.trim()].filter(Boolean).join(", ")}` : ""; })() : ""}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_EMPTY}>—</SelectItem>
                    {addresses.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}: {[a.street, `${a.postalCode ?? ""} ${a.city ?? ""}`.trim()].filter(Boolean).join(", ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ps-billingAddressId" className="text-sm">
              Rechnungsadresse
            </Label>
            <Controller
              control={form.control}
              name="billingAddressId"
              render={({ field }) => (
                <Select
                  value={mapEmptyToSelect(field.value)}
                  onValueChange={(v) => field.onChange(mapEmptyFromSelect(v))}
                  disabled={ro}
                >
                  <SelectTrigger id="ps-billingAddressId" className="h-9 w-full min-w-0">
                    <SelectValue
                      placeholder="— gleich wie Einsatz —"
                      resolvedLabel={field.value ? (() => { const a = addresses.find((x) => x.id === field.value); return a ? `${a.label}: ${[a.street, `${a.postalCode ?? ""} ${a.city ?? ""}`.trim()].filter(Boolean).join(", ")}` : ""; })() : ""}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_EMPTY}>— gleich wie Einsatz —</SelectItem>
                    {addresses.map((a) => (
                      <SelectItem key={`b-${a.id}`} value={a.id}>
                        {a.label}: {[a.street, `${a.postalCode ?? ""} ${a.city ?? ""}`.trim()].filter(Boolean).join(", ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <h3 className="text-sm font-medium text-muted-foreground">Notizen</h3>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Notiz für Monteure</Label>
            <Textarea className="min-h-[5rem] text-sm" disabled={ro} {...form.register("technicianNotes")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Weitere Hinweise</Label>
            <Textarea className="min-h-[5rem] text-sm" disabled={ro} {...form.register("hintsAndNotes")} />
          </div>
        </div>
      </section>

      <input type="hidden" {...form.register("projectId")} />

      {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}

      {ro ? (
        <p className="text-sm text-muted-foreground">Nur Büro und Admin können Stammdaten bearbeiten.</p>
      ) : (
        <div className="sticky bottom-0 -mx-1 border-t border-border/60 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button type="submit" className="w-full" disabled={savePending}>
            {savePending ? (
              <BauflipLoadingButtonLabel variant="onPrimary">Speichern …</BauflipLoadingButtonLabel>
            ) : (
              "Änderungen speichern"
            )}
          </Button>
        </div>
      )}
    </form>
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-0">
      <div className="min-w-0 flex-1 space-y-6 lg:border-r lg:border-border/70 lg:pr-6">
        <ProjectGuidedProcess
          layoutVariant="sheetCompact"
          projectId={project.id}
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
          onNavigateToStep={handleNavigateToStep}
          focusedStepIndex={viewPhaseIndex}
          onAfterStatusTransition={reloadSheetData}
        />
        <div
          className={cn(
            "min-h-[3.25rem] rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground",
            viewPhaseIndex < guidedPhaseIndex ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          role="status"
          aria-hidden={viewPhaseIndex < guidedPhaseIndex ? undefined : true}
        >
          Sie lesen einen <span className="font-medium text-foreground">früheren</span> Schritt. Ablauf-Stand im
          System: <span className="font-medium text-foreground">{guidedPhaseMeta.stepLabel}</span>.
        </div>
        {viewPhaseIndex === 0 ? (
          stammdatenForm
        ) : (
          <div
            id={PROJECT_WORKFLOW_STEPS[viewPhaseIndex]?.id ?? "phase"}
            className="scroll-mt-4 space-y-4"
          >
            <ProjectSheetPhasePanels
              phaseIndex={viewPhaseIndex}
              currentPhaseIndex={guidedPhaseIndex}
              bundle={payload.bundle}
              reportAttachments={payload.reportAttachments ?? []}
              profiles={profiles}
              supplierTemplates={supplierTemplates}
              articles={articles}
              onAfterMutation={reloadSheetData}
            />
          </div>
        )}
      </div>
      <div className="lg:w-[17rem] lg:shrink-0 lg:pl-6">
        <ProjectWorkflowRailSheet
          projectId={project.id}
          status={project.status}
          viewPhaseIndex={viewPhaseIndex}
          onSelectPhase={setViewPhaseIndex}
        />
      </div>
    </div>
  );
}
