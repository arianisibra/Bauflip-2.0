"use client";

import { useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { createContactFromFormAction } from "@/app/(app)/kontakte/actions";
import { contactCreateSchema } from "@/lib/validations/forms";
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ContactCreateValues = z.infer<typeof contactCreateSchema>;

const defaultValues: ContactCreateValues = {
  partyKind: "firma",
  category: "kunde",
  contactNumber: "",
  name: "",
  uidNumber: "",
  phone: "",
  mobile: "",
  email: "",
  website: "",
  street: "",
  postalCode: "",
  city: "",
  managedObjectLabel: "",
  persons: [{ firstName: "", lastName: "", email: "", phone: "", mobile: "", roleTitle: "" }],
  addresses: [],
};

export function ContactForm() {
  const [isPending, startTransition] = useTransition();
  const form = useForm<ContactCreateValues>({
    resolver: zodResolver(contactCreateSchema),
    defaultValues,
  });

  const persons = useFieldArray({ control: form.control, name: "persons" });
  const addresses = useFieldArray({ control: form.control, name: "addresses" });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      await createContactFromFormAction(values);
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Art & Kategorie</CardTitle>
          <CardDescription>Firma oder Privat, sowie Rolle im Geschäftsverkehr.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Art</Label>
            <Controller
              control={form.control}
              name="partyKind"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue resolvedLabel={{ firma: "Firma", privat: "Privat" }[field.value as string] ?? field.value} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="firma">Firma</SelectItem>
                    <SelectItem value="privat">Privat</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Kategorie</Label>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue resolvedLabel={{ kunde: "Kunde", lieferant: "Lieferant", partner: "Partner", sonstiges: "Sonstiges" }[field.value as string] ?? field.value} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kunde">Kunde</SelectItem>
                    <SelectItem value="lieferant">Lieferant</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                    <SelectItem value="sonstiges">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="contactNumber">Kontakt- / Identifikationsnummer</Label>
            <Input id="contactNumber" {...form.register("contactNumber")} placeholder="optional" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
          <CardDescription>Name, UID, Erreichbarkeit und Hauptadresse.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="name">Name / Bezeichnung</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="uidNumber">UID-Nummer</Label>
            <Input id="uidNumber" {...form.register("uidNumber")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="managedObjectLabel">Verknüpftes / verwaltetes Objekt</Label>
            <Input id="managedObjectLabel" {...form.register("managedObjectLabel")} />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="street">Strasse</Label>
            <Input id="street" {...form.register("street")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="postalCode">PLZ</Label>
            <Input id="postalCode" {...form.register("postalCode")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="city">Ort</Label>
            <Input id="city" {...form.register("city")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" {...form.register("phone")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mobile">Mobil</Label>
            <Input id="mobile" {...form.register("mobile")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" type="email" {...form.register("email")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="website">Webseite</Label>
            <Input id="website" type="text" placeholder="https://…" {...form.register("website")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Ansprechpartner</CardTitle>
            <CardDescription>Weitere Personen beim Kontakt.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              persons.append({
                firstName: "",
                lastName: "",
                email: "",
                phone: "",
                mobile: "",
                roleTitle: "",
              })
            }
          >
            <Plus className="mr-1 size-4" />
            Person
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {persons.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 rounded-lg border p-4 md:grid-cols-2"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor={`person-${index}-first`}>Vorname</Label>
                <Input id={`person-${index}-first`} {...form.register(`persons.${index}.firstName`)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`person-${index}-last`}>Nachname</Label>
                <Input id={`person-${index}-last`} {...form.register(`persons.${index}.lastName`)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`person-${index}-email`}>E-Mail</Label>
                <Input id={`person-${index}-email`} type="email" {...form.register(`persons.${index}.email`)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`person-${index}-phone`}>Telefon</Label>
                <Input id={`person-${index}-phone`} {...form.register(`persons.${index}.phone`)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`person-${index}-mobile`}>Mobil</Label>
                <Input id={`person-${index}-mobile`} {...form.register(`persons.${index}.mobile`)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`person-${index}-role`}>Position</Label>
                <Input id={`person-${index}-role`} {...form.register(`persons.${index}.roleTitle`)} />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => persons.remove(index)}>
                  <Trash2 className="mr-1 size-4" />
                  Entfernen
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Weitere Adressen</CardTitle>
            <CardDescription>z. B. Rechnungsadresse, Standort, Zweigniederlassung.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              addresses.append({
                label: "",
                street: "",
                postalCode: "",
                city: "",
                country: "CH",
                isPrimary: false,
              })
            }
          >
            <Plus className="mr-1 size-4" />
            Adresse
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {addresses.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 rounded-lg border p-4 md:grid-cols-2"
            >
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label htmlFor={`addr-${index}-label`}>Bezeichnung</Label>
                <Input
                  id={`addr-${index}-label`}
                  placeholder="z. B. Rechnung, Werkhof"
                  {...form.register(`addresses.${index}.label`)}
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label htmlFor={`addr-${index}-street`}>Strasse</Label>
                <Input id={`addr-${index}-street`} {...form.register(`addresses.${index}.street`)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`addr-${index}-plz`}>PLZ</Label>
                <Input id={`addr-${index}-plz`} {...form.register(`addresses.${index}.postalCode`)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`addr-${index}-city`}>Ort</Label>
                <Input id={`addr-${index}-city`} {...form.register(`addresses.${index}.city`)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`addr-${index}-country`}>Land</Label>
                <Input id={`addr-${index}-country`} {...form.register(`addresses.${index}.country`)} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Controller
                  control={form.control}
                  name={`addresses.${index}.isPrimary`}
                  render={({ field }) => (
                    <input
                      id={`addr-${index}-primary`}
                      type="checkbox"
                      className="size-4 rounded border border-input"
                      checked={field.value ?? false}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  )}
                />
                <Label htmlFor={`addr-${index}-primary`} className="font-normal">
                  Primär für diesen Kontakt
                </Label>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => addresses.remove(index)}>
                  <Trash2 className="mr-1 size-4" />
                  Entfernen
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <BauflipLoadingButtonLabel variant="onPrimary">Wird gespeichert…</BauflipLoadingButtonLabel>
        ) : (
          "Kontakt speichern"
        )}
      </Button>
    </form>
  );
}
