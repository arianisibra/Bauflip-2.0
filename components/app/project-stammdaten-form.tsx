"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Contact, ContactAddress, ContactPerson, Project, ProjectWorkType, SiteProperty, UserProfile } from "@/lib/domain/types";
import { projectStammdatenUpdateSchema } from "@/lib/validations/forms";
import type { z } from "zod";
import { getContactProjectOptionsAction, updateProjectStammdatenAction } from "@/app/(app)/projekte/actions";
import { buildGoogleMapsSearchUrl } from "@/lib/maps/google-maps";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VoiceTextarea } from "@/components/app/voice-textarea";

type FormValues = z.infer<typeof projectStammdatenUpdateSchema>;

type Props = {
  project: Project;
  contacts: Contact[];
  properties: SiteProperty[];
  workTypes: ProjectWorkType[];
  profiles: UserProfile[];
  initialPersons: ContactPerson[];
  initialAddresses: ContactAddress[];
  readOnly?: boolean;
};

const empty = "";

export function ProjectStammdatenForm({
  project,
  contacts,
  properties,
  workTypes,
  profiles,
  initialPersons,
  initialAddresses,
  readOnly = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [persons, setPersons] = useState<ContactPerson[]>(initialPersons);
  const [addresses, setAddresses] = useState<ContactAddress[]>(initialAddresses);

  const defaultValues: FormValues = useMemo(
    () => ({
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
    }),
    [project],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(projectStammdatenUpdateSchema),
    defaultValues,
  });

  const contactId = form.watch("contactId");
  const serviceAddressId = form.watch("serviceAddressId");
  const propertyId = form.watch("propertyId");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { persons: p, addresses: a } = await getContactProjectOptionsAction(contactId);
      if (!cancelled) {
        setPersons(p);
        setAddresses(a);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const selectedProperty = useMemo(
    () => properties.find((x) => x.id === propertyId) ?? null,
    [properties, propertyId],
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

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      await updateProjectStammdatenAction(values);
    });
  });

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

  if (readOnly) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Projekt-Stammdaten</CardTitle>
          <CardDescription>Lesen (nur Büro/Admin kann bearbeiten).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Erstellt</p>
            <p>{new Date(project.createdAt).toLocaleString("de-CH")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Referenz</p>
            <p>{project.referenceCode ?? "—"}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-muted-foreground">Titel</p>
            <p className="font-medium">{project.title}</p>
          </div>
          {project.mapsUrl ? (
            <div className="md:col-span-2">
              <a
                href={project.mapsUrl}
                className="text-primary underline"
                target="_blank"
                rel="noreferrer"
              >
                Google Maps öffnen
              </a>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projekt-Stammdaten</CardTitle>
        <CardDescription>
          Status: Workflow unten · Hier: Einsatzort, Arbeitsart, Zuordnung, Kontakte und Hinweise für die Monteure.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Erstellungsdatum</Label>
              <Input readOnly value={new Date(project.createdAt).toLocaleString("de-CH")} className="bg-muted" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="referenceCode">Referenz (frei)</Label>
              <Input id="referenceCode" {...form.register("referenceCode")} placeholder="z. B. interne Aktennummer" />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="title">Projekttitel</Label>
              <Input id="title" {...form.register("title")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tenantUnit">Mieter / Wohnung</Label>
              <Input id="tenantUnit" {...form.register("tenantUnit")} placeholder="z. B. Whg. 3.1" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Arbeitsart</Label>
              <Controller
                control={form.control}
                name="workTypeId"
                render={({ field }) => (
                  <Select value={field.value || empty} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder="Auswählen"
                        resolvedLabel={field.value ? (workTypes.find((w) => w.id === field.value)?.name ?? "") : ""}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={empty}>—</SelectItem>
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
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="newWorkTypeName">Neue Arbeitsart (wird gespeichert und ausgewählt)</Label>
              <Input id="newWorkTypeName" {...form.register("newWorkTypeName")} placeholder="Optional" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Zugeordneter Mitarbeiter</Label>
              <Controller
                control={form.control}
                name="nextOwnerUserId"
                render={({ field }) => (
                  <Select value={field.value || empty} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder="—"
                        resolvedLabel={field.value ? (profiles.find((p) => p.id === field.value)?.displayName ?? "") : ""}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={empty}>—</SelectItem>
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="sitePhone">Telefon (Objekt / Erreichbarkeit)</Label>
              <Input id="sitePhone" {...form.register("sitePhone")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="siteMobile">Mobil</Label>
              <Input id="siteMobile" {...form.register("siteMobile")} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label>Objekt (Standort)</Label>
              <Controller
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <Select value={field.value || empty} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder="—"
                        resolvedLabel={field.value ? (properties.find((p) => p.id === field.value)?.name ?? "") : ""}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={empty}>—</SelectItem>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Objekte (Standorte) können in der Datenbank dem Verwalter/Eigentümer-Kontakt zugeordnet werden; neue Einträge derzeit über Verwaltung/SQL anlegbar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="button" variant="outline" size="sm" onClick={fillMapsFromProperty}>
                Maps-Link aus Objekt
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={fillMapsFromServiceAddress}>
                Maps-Link aus Einsatzadresse
              </Button>
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="mapsUrl">Google Maps (Link für Monteure)</Label>
              <Input id="mapsUrl" {...form.register("mapsUrl")} placeholder="https://…" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label>Auftraggeber (Kontakt)</Label>
              <Controller
                control={form.control}
                name="contactId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue
                        resolvedLabel={field.value ? (() => { const c = contacts.find((x) => x.id === field.value); return c ? `${c.name}${c.contactNumber ? ` (${c.contactNumber})` : ""}` : ""; })() : ""}
                        placeholder="Kontakt wählen"
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.contactNumber ? ` (${c.contactNumber})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Ansprechpartner</Label>
              <Controller
                control={form.control}
                name="contactPersonId"
                render={({ field }) => (
                  <Select value={field.value || empty} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder="—"
                        resolvedLabel={field.value ? (persons.find((p) => p.id === field.value) ? [persons.find((p) => p.id === field.value)!.firstName, persons.find((p) => p.id === field.value)!.lastName].filter(Boolean).join(" ") || "—" : "") : ""}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={empty}>—</SelectItem>
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
            <div className="flex flex-col gap-2">
              <Label>Einsatzadresse</Label>
              <Controller
                control={form.control}
                name="serviceAddressId"
                render={({ field }) => (
                  <Select value={field.value || empty} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder="—"
                        resolvedLabel={field.value ? (() => { const a = addresses.find((x) => x.id === field.value); return a ? `${a.label}: ${[a.street, `${a.postalCode ?? ""} ${a.city ?? ""}`.trim()].filter(Boolean).join(", ")}` : ""; })() : ""}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={empty}>—</SelectItem>
                      {addresses.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label}: {[a.street, `${a.postalCode ?? ""} ${a.city ?? ""}`.trim()]
                            .filter(Boolean)
                            .join(", ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label>Rechnungsadresse (falls abweichend)</Label>
              <Controller
                control={form.control}
                name="billingAddressId"
                render={({ field }) => (
                  <Select value={field.value || empty} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder="— gleich wie Einsatz —"
                        resolvedLabel={field.value ? (() => { const a = addresses.find((x) => x.id === field.value); return a ? `${a.label}: ${[a.street, `${a.postalCode ?? ""} ${a.city ?? ""}`.trim()].filter(Boolean).join(", ")}` : ""; })() : ""}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={empty}>— gleich wie Einsatz / Hauptkontakt —</SelectItem>
                      {addresses.map((a) => (
                        <SelectItem key={`b-${a.id}`} value={a.id}>
                          {a.label}: {[a.street, `${a.postalCode ?? ""} ${a.city ?? ""}`.trim()]
                            .filter(Boolean)
                            .join(", ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="technicianNotes">Notiz für die Monteure</Label>
            <Controller
              control={form.control}
              name="technicianNotes"
              render={({ field }) => (
                <VoiceTextarea
                  id="technicianNotes"
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="hintsAndNotes">Weitere Notizen &amp; Hinweise</Label>
            <Controller
              control={form.control}
              name="hintsAndNotes"
              render={({ field }) => (
                <VoiceTextarea
                  id="hintsAndNotes"
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                />
              )}
            />
          </div>

          <input type="hidden" {...form.register("projectId")} />
          <input type="hidden" {...form.register("intakeOriginalText")} />
          <input type="hidden" {...form.register("accessNotes")} />
          <input type="hidden" {...form.register("keyHandlingNotes")} />
          <input type="hidden" {...form.register("timingNotes")} />
          <input type="hidden" {...form.register("internalNotes")} />

          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <BauflipLoadingButtonLabel variant="onPrimary">Speichern…</BauflipLoadingButtonLabel>
            ) : (
              "Stammdaten speichern"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
