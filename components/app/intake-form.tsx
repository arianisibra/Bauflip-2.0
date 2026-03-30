"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { unstable_rethrow } from "next/navigation";
import { createIntakeAction } from "@/app/(app)/actions";
import { intakeSchema } from "@/lib/validations/forms";
import type { z } from "zod";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectLabel, SelectTrigger, SelectValue, SelectGroup } from "@/components/ui/select";
import { VoiceTextarea } from "@/components/app/voice-textarea";
import type { Contact } from "@/lib/domain/types";

type IntakeValues = z.infer<typeof intakeSchema>;

const defaultValues: IntakeValues = {
  title: "",
  source: "telefon",
  type: "reparatur",
  intakeOriginalText: "",
  accessNotes: "",
  keyHandlingNotes: "",
  internalNotes: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  contactStreet: "",
  contactPostalCode: "",
  contactCity: "",
  contactId: "",
};

const uuidLikePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function IntakeForm({ contacts = [] }: { contacts?: Contact[] }) {
  const [isPending, startTransition] = useTransition();
  const [contactSearch, setContactSearch] = useState("");
  const [showContactResults, setShowContactResults] = useState(false);
  const form = useForm<IntakeValues>({
    resolver: zodResolver(intakeSchema),
    defaultValues,
  });
  const createdAtLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("de-CH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const applyContactToFields = useCallback(
    (contact: Contact) => {
      form.setValue("contactId", contact.id, { shouldDirty: true });
      form.setValue("contactName", contact.name ?? "", { shouldDirty: true });
      form.setValue("contactEmail", contact.email ?? "", { shouldDirty: true });
      form.setValue("contactPhone", contact.phone ?? contact.mobile ?? "", { shouldDirty: true });
      form.setValue("contactStreet", contact.street ?? "", { shouldDirty: true });
      form.setValue("contactPostalCode", contact.postalCode ?? "", { shouldDirty: true });
      form.setValue("contactCity", contact.city ?? "", { shouldDirty: true });
    },
    [form],
  );

  const linkedContactId = form.watch("contactId");

  const onSubmit = form.handleSubmit((values) => {
    form.clearErrors("root");
    startTransition(async () => {
      const formData = new FormData();
      for (const [key, value] of Object.entries(values)) {
        formData.set(key, value ?? "");
      }
      try {
        await createIntakeAction(formData);
      } catch (err) {
        unstable_rethrow(err);
        const message =
          err instanceof Error ? err.message : "Speichern fehlgeschlagen. Bitte erneut versuchen.";
        form.setError("root", { message });
      }
    });
  });

  const filteredContacts = useMemo(() => {
    const getContactDisplayName = (contact: Contact) => {
      const raw = (contact.name ?? "").trim();
      if (raw && !uuidLikePattern.test(raw)) {
        return raw;
      }
      return contact.email ?? contact.phone ?? contact.mobile ?? contact.city ?? "Kontakt";
    };

    const q = contactSearch.trim().toLowerCase();
    if (!q) {
      return contacts.slice(0, 8);
    }
    return contacts
      .filter((c) => {
        const haystack = [getContactDisplayName(c), c.city, c.email, c.phone, c.mobile]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 8);
  }, [contacts, contactSearch]);

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Neue Anfrage erfassen</CardTitle>
          <CardDescription>
            Erfassen Sie die Originalinformation vollständig, damit nichts verloren geht.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="createdAtDisplay">Erstellungsdatum</Label>
            <Input id="createdAtDisplay" value={createdAtLabel} readOnly disabled />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Projekttitel</Label>
            <Input id="title" {...form.register("title")} aria-invalid={!!form.formState.errors.title} />
            {form.formState.errors.title ? (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Quelle</Label>
              <Controller
                control={form.control}
                name="source"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Quelle auswählen" resolvedLabel={{ telefon: "Telefon", whatsapp: "WhatsApp", email: "E-Mail" }[field.value as string] ?? field.value} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Eingang</SelectLabel>
                        <SelectItem value="telefon">Telefon</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="email">E-Mail</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Projekttyp</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Typ auswählen" resolvedLabel={{ reparatur: "Reparatur", ersatz: "Ersatz", neuinstallation: "Neuinstallation" }[field.value as string] ?? field.value} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Typ</SelectLabel>
                        <SelectItem value="reparatur">Reparatur</SelectItem>
                        <SelectItem value="ersatz">Ersatz</SelectItem>
                        <SelectItem value="neuinstallation">Neuinstallation</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="intakeOriginalText">Originalaussage Kunde</Label>
            <Controller
              control={form.control}
              name="intakeOriginalText"
              render={({ field }) => (
                <VoiceTextarea
                  id="intakeOriginalText"
                  placeholder="z.B. Lamellenstoren blockiert seit gestern..."
                  value={field.value}
                  onValueChange={field.onChange}
                />
              )}
            />
            {form.formState.errors.intakeOriginalText ? (
              <p className="text-sm text-destructive">{form.formState.errors.intakeOriginalText.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="accessNotes">Zugang/Schlüssel</Label>
            <Controller
              control={form.control}
              name="accessNotes"
              render={({ field }) => (
                <VoiceTextarea
                  id="accessNotes"
                  value={field.value}
                  onValueChange={field.onChange}
                />
              )}
            />
            {form.formState.errors.accessNotes ? (
              <p className="text-sm text-destructive">{form.formState.errors.accessNotes.message}</p>
            ) : null}
          </div>
          <input type="hidden" {...form.register("keyHandlingNotes")} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="internalNotes">Interne Notiz</Label>
            <Controller
              control={form.control}
              name="internalNotes"
              render={({ field }) => (
                <VoiceTextarea id="internalNotes" value={field.value ?? ""} onValueChange={field.onChange} />
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kontakt</CardTitle>
          <CardDescription>Erfassen Sie den Kontakt direkt mit allen nötigen Stammdaten.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {contacts.length > 0 ? (
            <div className="md:col-span-2 grid gap-2">
              <div className="flex flex-col gap-2">
                <Label>Kontakt aus Liste übernehmen</Label>
                <div className="relative">
                  <Input
                    value={contactSearch}
                    placeholder="Name, Ort, E-Mail oder Telefon eingeben …"
                    onChange={(e) => {
                      setContactSearch(e.target.value);
                      setShowContactResults(true);
                    }}
                    onFocus={() => setShowContactResults(true)}
                    onBlur={() => {
                      // Delay keeps click on result item possible.
                      setTimeout(() => setShowContactResults(false), 120);
                    }}
                  />
                  {showContactResults ? (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-white p-1 shadow-md">
                      {filteredContacts.length === 0 ? (
                        <p className="px-2 py-1 text-sm text-muted-foreground">Kein Kontakt gefunden.</p>
                      ) : (
                        filteredContacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                            onClick={() => {
                              const displayName =
                                contact.name && !uuidLikePattern.test(contact.name)
                                  ? contact.name
                                  : contact.email ??
                                    contact.phone ??
                                    contact.mobile ??
                                    contact.city ??
                                    "Kontakt";
                              setContactSearch(
                                `${displayName}${contact.city && displayName !== contact.city ? ` · ${contact.city}` : ""}`,
                              );
                              applyContactToFields(contact);
                              setShowContactResults(false);
                            }}
                          >
                            <span className="font-medium">
                              {contact.name && !uuidLikePattern.test(contact.name)
                                ? contact.name
                                : contact.email ??
                                  contact.phone ??
                                  contact.mobile ??
                                  contact.city ??
                                  "Kontakt"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {[contact.city, contact.email, contact.phone ?? contact.mobile]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">Kontakt wird beim Anklicken automatisch übernommen.</p>
              </div>
              {linkedContactId ? (
                <div className="flex flex-col gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Es wird <strong className="text-foreground">kein neuer Kontakt</strong> angelegt — diese Anfrage wird dem
                    ausgewählten Stammdatensatz zugeordnet.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      form.setValue("contactId", "", { shouldDirty: true });
                    }}
                  >
                    Verknüpfung aufheben
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          <input type="hidden" {...form.register("contactId")} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="contactName">Name</Label>
            <Input
              id="contactName"
              aria-invalid={!!form.formState.errors.contactName}
              {...form.register("contactName")}
            />
            {form.formState.errors.contactName ? (
              <p className="text-sm text-destructive">{form.formState.errors.contactName.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contactPhone">Telefon</Label>
            <Input
              id="contactPhone"
              aria-invalid={!!form.formState.errors.contactPhone}
              {...form.register("contactPhone")}
            />
            {form.formState.errors.contactPhone ? (
              <p className="text-sm text-destructive">{form.formState.errors.contactPhone.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contactEmail">E-Mail</Label>
            <Input
              id="contactEmail"
              aria-invalid={!!form.formState.errors.contactEmail}
              {...form.register("contactEmail")}
            />
            {form.formState.errors.contactEmail ? (
              <p className="text-sm text-destructive">{form.formState.errors.contactEmail.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contactStreet">Strasse</Label>
            <Input id="contactStreet" {...form.register("contactStreet")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contactPostalCode">PLZ</Label>
            <Input id="contactPostalCode" {...form.register("contactPostalCode")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contactCity">Ort</Label>
            <Input id="contactCity" {...form.register("contactCity")} />
          </div>
        </CardContent>
      </Card>

      {form.formState.errors.root ? (
        <p className="text-sm text-destructive" role="alert">
          {form.formState.errors.root.message}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <BauflipLoadingButtonLabel variant="onPrimary">Wird gespeichert…</BauflipLoadingButtonLabel>
        ) : (
          "Anfrage erfassen"
        )}
      </Button>
    </form>
  );
}
