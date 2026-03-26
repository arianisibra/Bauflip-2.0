"use client";

import { useCallback, useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from "@/components/ui/select";
import { VoiceTextarea } from "@/components/app/voice-textarea";
import type { Contact } from "@/lib/domain/types";

type IntakeValues = z.infer<typeof intakeSchema>;

const defaultValues: IntakeValues = {
  title: "",
  source: "telefon",
  type: "reparatur",
  urgency: "normal",
  intakeOriginalText: "",
  accessNotes: "",
  keyHandlingNotes: "",
  timingNotes: "",
  internalNotes: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  contactStreet: "",
  contactPostalCode: "",
  contactCity: "",
};

export function IntakeForm({ contacts = [] }: { contacts?: Contact[] }) {
  const [isPending, startTransition] = useTransition();
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const form = useForm<IntakeValues>({
    resolver: zodResolver(intakeSchema),
    defaultValues,
  });

  const applyContactToFields = useCallback(
    (contact: Contact) => {
      form.setValue("contactName", contact.name ?? "", { shouldDirty: true });
      form.setValue("contactEmail", contact.email ?? "", { shouldDirty: true });
      form.setValue("contactPhone", contact.phone ?? contact.mobile ?? "", { shouldDirty: true });
      form.setValue("contactStreet", contact.street ?? "", { shouldDirty: true });
      form.setValue("contactPostalCode", contact.postalCode ?? "", { shouldDirty: true });
      form.setValue("contactCity", contact.city ?? "", { shouldDirty: true });
    },
    [form],
  );

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
            <Label htmlFor="title">Projekttitel</Label>
            <Input id="title" {...form.register("title")} aria-invalid={!!form.formState.errors.title} />
            {form.formState.errors.title ? (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
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
            <div className="flex flex-col gap-2">
              <Label>Dringlichkeit</Label>
              <Controller
                control={form.control}
                name="urgency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Dringlichkeit auswählen" resolvedLabel={{ normal: "Normal", hoch: "Hoch", kritisch: "Kritisch" }[field.value as string] ?? field.value} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Priorität</SelectLabel>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="hoch">Hoch</SelectItem>
                        <SelectItem value="kritisch">Kritisch</SelectItem>
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

          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="accessNotes">Zugang</Label>
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="keyHandlingNotes">Schlüssel</Label>
              <Controller
                control={form.control}
                name="keyHandlingNotes"
                render={({ field }) => (
                  <VoiceTextarea
                    id="keyHandlingNotes"
                    required
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="timingNotes">Zeitfenster</Label>
              <Controller
                control={form.control}
                name="timingNotes"
                render={({ field }) => (
                  <VoiceTextarea
                    id="timingNotes"
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
              {form.formState.errors.timingNotes ? (
                <p className="text-sm text-destructive">{form.formState.errors.timingNotes.message}</p>
              ) : null}
            </div>
          </div>

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
            <div className="md:col-span-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="flex flex-col gap-2">
                <Label>Kontakt aus Liste übernehmen</Label>
                <Select
                  value={selectedContactId || undefined}
                  onValueChange={(value) => {
                    setSelectedContactId(value);
                    const selected = contacts.find((c) => c.id === value);
                    if (selected) {
                      applyContactToFields(selected);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kontakt auswählen …" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Kontaktdatenbank</SelectLabel>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name}
                          {contact.city ? ` · ${contact.city}` : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const selected = contacts.find((c) => c.id === selectedContactId);
                  if (selected) {
                    applyContactToFields(selected);
                  }
                }}
                disabled={!selectedContactId}
              >
                Kontakt übernehmen
              </Button>
            </div>
          ) : null}
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
