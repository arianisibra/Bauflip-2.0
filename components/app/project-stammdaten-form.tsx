"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Contact, ContactAddress, ContactPerson, Project, ProjectWorkType, SiteProperty, UserProfile } from "@/lib/domain/types";
import { projectStammdatenUpdateSchema } from "@/lib/validations/forms";
import type { z } from "zod";
import { getContactProjectOptionsAction, updateProjectStammdatenAction } from "@/app/(app)/projekte/actions";
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsSearchUrl } from "@/lib/maps/google-maps";
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
import { WorkTypeSelect } from "@/components/app/work-type-select";
import { mergeAccessAndKeyNotes } from "@/lib/utils";

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

function normAddressPart(v: string | null | undefined) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [persons, setPersons] = useState<ContactPerson[]>(initialPersons);
  const [addresses, setAddresses] = useState<ContactAddress[]>(initialAddresses);
  const [sameAsContactPerson, setSameAsContactPerson] = useState(false);

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
      accessNotes: mergeAccessAndKeyNotes(project.accessNotes, project.keyHandlingNotes),
      keyHandlingNotes: "",
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
  const contactPersonId = form.watch("contactPersonId");
  const propertiesForContact = useMemo(
    () => properties.filter((p) => !contactId || p.ownerContactId === contactId),
    [properties, contactId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { persons: p, addresses: a } = await getContactProjectOptionsAction(contactId);
      if (!cancelled) {
        setPersons(p);
        setAddresses(a);

        // Kontaktwechsel soll abhängige Felder sinnvoll vorbesetzen.
        const currentPersonId = String(form.getValues("contactPersonId") ?? "").trim();
        const currentServiceAddressId = String(form.getValues("serviceAddressId") ?? "").trim();
        const currentBillingAddressId = String(form.getValues("billingAddressId") ?? "").trim();

        const firstPersonId = p[0]?.id ?? "";
        const primaryAddressId = (a.find((item) => item.isPrimary)?.id ?? a[0]?.id) ?? "";

        if (!currentPersonId || !p.some((item) => item.id === currentPersonId)) {
          form.setValue("contactPersonId", firstPersonId);
        }
        if (!currentServiceAddressId || !a.some((item) => item.id === currentServiceAddressId)) {
          form.setValue("serviceAddressId", primaryAddressId);
        }
        if (!currentBillingAddressId || !a.some((item) => item.id === currentBillingAddressId)) {
          form.setValue("billingAddressId", primaryAddressId);
        }
        const currentPropertyId = String(form.getValues("propertyId") ?? "").trim();
        const firstPropertyId = (properties.find((prop) => prop.ownerContactId === contactId)?.id ?? "");
        if (!currentPropertyId || !properties.some((prop) => prop.id === currentPropertyId && prop.ownerContactId === contactId)) {
          form.setValue("propertyId", firstPropertyId);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contactId, properties, form]);

  const selectedProperty = useMemo(
    () => propertiesForContact.find((x) => x.id === propertyId) ?? null,
    [propertiesForContact, propertyId],
  );

  const selectedServiceAddress = useMemo(
    () => addresses.find((x) => x.id === serviceAddressId) ?? null,
    [addresses, serviceAddressId],
  );
  const selectedContactPerson = useMemo(
    () => persons.find((x) => x.id === contactPersonId) ?? null,
    [persons, contactPersonId],
  );

  useEffect(() => {
    if (!sameAsContactPerson) {
      return;
    }
    form.setValue("sitePhone", selectedContactPerson?.phone ?? "");
    form.setValue("siteMobile", selectedContactPerson?.mobile ?? "");
  }, [form, sameAsContactPerson, selectedContactPerson]);

  useEffect(() => {
    if (!propertyId || !selectedProperty || addresses.length === 0) {
      return;
    }
    const match = addresses.find((a) => {
      return (
        normAddressPart(a.street) === normAddressPart(selectedProperty.street) &&
        normAddressPart(a.postalCode) === normAddressPart(selectedProperty.postalCode) &&
        normAddressPart(a.city) === normAddressPart(selectedProperty.city)
      );
    });
    const fallbackId = (addresses.find((a) => a.isPrimary)?.id ?? addresses[0]?.id) || "";
    const targetId = match?.id ?? fallbackId;
    if (!targetId) {
      return;
    }
    form.setValue("serviceAddressId", targetId);
    form.setValue("billingAddressId", targetId);
  }, [propertyId, selectedProperty, addresses, form]);

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

  const openRoutePlanner = () => {
    const fromServiceAddress = selectedServiceAddress
      ? buildGoogleMapsDirectionsUrl({
          street: selectedServiceAddress.street,
          postalCode: selectedServiceAddress.postalCode,
          city: selectedServiceAddress.city,
          country: selectedServiceAddress.country,
        })
      : "";
    const fromProperty = selectedProperty
      ? selectedProperty.mapsUrl ||
        buildGoogleMapsDirectionsUrl({
          street: selectedProperty.street,
          postalCode: selectedProperty.postalCode,
          city: selectedProperty.city,
          country: selectedProperty.country,
        })
      : "";
    const currentMapsUrl = String(form.getValues("mapsUrl") ?? "").trim();
    const href = fromServiceAddress || fromProperty || currentMapsUrl;
    if (!href) {
      window.alert("Bitte zuerst Objekt oder Einsatzadresse auswählen.");
      return;
    }
    form.setValue("mapsUrl", href);
    window.open(href, "_blank", "noopener,noreferrer");
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
                  <WorkTypeSelect
                    workTypes={workTypes}
                    value={field.value || empty}
                    onChange={field.onChange}
                    disabled={readOnly}
                    manageable={!readOnly}
                    onMutation={() => router.refresh()}
                  />
                )}
              />
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
              <Input id="sitePhone" disabled={sameAsContactPerson} {...form.register("sitePhone")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="siteMobile">Mobil</Label>
              <Input id="siteMobile" disabled={sameAsContactPerson} {...form.register("siteMobile")} />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <input
                id="psf-same-as-person"
                type="checkbox"
                className="size-4 rounded border border-input"
                checked={sameAsContactPerson}
                onChange={(e) => {
                  const next = e.target.checked;
                  setSameAsContactPerson(next);
                  if (next) {
                    form.setValue("sitePhone", selectedContactPerson?.phone ?? "");
                    form.setValue("siteMobile", selectedContactPerson?.mobile ?? "");
                  }
                }}
              />
              <Label htmlFor="psf-same-as-person" className="text-sm font-normal">
                Telefon/Mobil gleich wie Ansprechpartner
              </Label>
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
                        resolvedLabel={field.value ? (propertiesForContact.find((p) => p.id === field.value)?.name ?? "") : ""}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={empty}>—</SelectItem>
                      {propertiesForContact.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {propertiesForContact.length === 0 ? (
                <p className="text-xs text-muted-foreground">Für diesen Kontakt ist noch kein Objekt hinterlegt.</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label>Routenplaner</Label>
              <Button type="button" variant="outline" onClick={openRoutePlanner}>
                Google Maps Routenplaner öffnen
              </Button>
              <input type="hidden" {...form.register("mapsUrl")} />
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
