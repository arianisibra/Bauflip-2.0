"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createIntakeAction } from "@/app/(app)/actions";
import { intakeSchema } from "@/lib/validations/forms";
import type { z } from "zod";
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
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerStreet: "",
  customerPostalCode: "",
  customerCity: "",
};

export function IntakeForm() {
  const [isPending, startTransition] = useTransition();
  const form = useForm<IntakeValues>({
    resolver: zodResolver(intakeSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const formData = new FormData();
      for (const [key, value] of Object.entries(values)) {
        formData.set(key, value ?? "");
      }
      await createIntakeAction(formData);
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
                      <SelectValue placeholder="Quelle auswählen" />
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
                      <SelectValue placeholder="Typ auswählen" />
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
                      <SelectValue placeholder="Dringlichkeit auswählen" />
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
                  required
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
                    required
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
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
                    required
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
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
          <CardTitle>Kunde</CardTitle>
          <CardDescription>Erfassen Sie den Kunden direkt mit allen nötigen Kontaktdaten.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="customerName">Name</Label>
            <Input id="customerName" {...form.register("customerName")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customerPhone">Telefon</Label>
            <Input id="customerPhone" {...form.register("customerPhone")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customerEmail">E-Mail</Label>
            <Input id="customerEmail" {...form.register("customerEmail")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customerStreet">Strasse</Label>
            <Input id="customerStreet" {...form.register("customerStreet")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customerPostalCode">PLZ</Label>
            <Input id="customerPostalCode" {...form.register("customerPostalCode")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customerCity">Ort</Label>
            <Input id="customerCity" {...form.register("customerCity")} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird gespeichert..." : "Anfrage erfassen"}
      </Button>
    </form>
  );
}
