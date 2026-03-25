"use client";

import { useEffect, useState, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { getContactBundleAction, updateContactFromFormAction } from "@/app/(app)/kontakte/actions";
import { contactUpdateSchema } from "@/lib/validations/forms";
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
import { BauflipLoading, BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { cn } from "@/lib/utils";

type ContactUpdateValues = z.infer<typeof contactUpdateSchema>;
type PersonRow = NonNullable<ContactUpdateValues["persons"]>[number];
type AddressRow = NonNullable<ContactUpdateValues["addresses"]>[number];

const emptyPerson: PersonRow = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  mobile: "",
  roleTitle: "",
};

const emptyAddress: AddressRow = {
  label: "",
  street: "",
  postalCode: "",
  city: "",
  country: "CH",
  isPrimary: false,
};

function bundleToForm(
  bundle: NonNullable<Awaited<ReturnType<typeof getContactBundleAction>>>,
): ContactUpdateValues {
  const { contact, persons, addresses } = bundle;
  return {
    id: contact.id,
    partyKind: contact.partyKind,
    category: contact.category,
    contactNumber: contact.contactNumber ?? "",
    name: contact.name,
    uidNumber: contact.uidNumber ?? "",
    phone: contact.phone ?? "",
    mobile: contact.mobile ?? "",
    email: contact.email ?? "",
    website: contact.website ?? "",
    street: contact.street ?? "",
    postalCode: contact.postalCode ?? "",
    city: contact.city ?? "",
    managedObjectLabel: contact.managedObjectLabel ?? "",
    persons:
      persons.length > 0
        ? persons.map((p) => ({
            id: p.id,
            firstName: p.firstName ?? "",
            lastName: p.lastName ?? "",
            email: p.email ?? "",
            phone: p.phone ?? "",
            mobile: p.mobile ?? "",
            roleTitle: p.roleTitle ?? "",
          }))
        : [{ ...emptyPerson }],
    addresses: addresses.map((a) => ({
      id: a.id,
      label: a.label,
      street: a.street ?? "",
      postalCode: a.postalCode ?? "",
      city: a.city ?? "",
      country: a.country,
      isPrimary: a.isPrimary,
    })),
  };
}

type Props = {
  contactId: string | null;
  open: boolean;
  onTitleChange?: (name: string) => void;
};

export function KontaktSheetEditor({ contactId, open, onTitleChange }: Props) {
  const router = useRouter();
  const [loadPending, startLoad] = useTransition();
  const [savePending, startSave] = useTransition();
  const [bundleReady, setBundleReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const form = useForm<ContactUpdateValues>({
    resolver: zodResolver(contactUpdateSchema),
    defaultValues: undefined,
  });

  const persons = useFieldArray({ control: form.control, name: "persons" });
  const addresses = useFieldArray({ control: form.control, name: "addresses" });

  const nameValue = form.watch("name");

  useEffect(() => {
    if (nameValue && onTitleChange) {
      onTitleChange(nameValue);
    }
  }, [nameValue, onTitleChange]);

  useEffect(() => {
    if (!open || !contactId) {
      setBundleReady(false);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    setBundleReady(false);
    startLoad(async () => {
      try {
        const bundle = await getContactBundleAction(contactId);
        if (cancelled) {
          return;
        }
        form.reset(bundleToForm(bundle));
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
  }, [open, contactId, form]);

  const onSubmit = form.handleSubmit((values) => {
    setSaveError(null);
    startSave(async () => {
      try {
        await updateContactFromFormAction(values);
        if (contactId) {
          const fresh = await getContactBundleAction(contactId);
          form.reset(bundleToForm(fresh));
        }
        router.refresh();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      }
    });
  });

  if (!contactId) {
    return null;
  }

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>;
  }

  if ((loadPending || !bundleReady) && !loadError) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center py-6">
        <BauflipLoading label="Kontakt wird geladen …" size="sm" />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Art &amp; Kategorie</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Art</Label>
            <Controller
              control={form.control}
              name="partyKind"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9 w-full min-w-0">
                    <SelectValue resolvedLabel={{ firma: "Firma", privat: "Privat" }[field.value as "firma" | "privat"] ?? field.value} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="firma">Firma</SelectItem>
                    <SelectItem value="privat">Privat</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Kategorie</Label>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9 w-full min-w-0">
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
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ks-contactNumber" className="text-sm">
              Kontaktnummer
            </Label>
            <Input id="ks-contactNumber" className="h-9" {...form.register("contactNumber")} />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stammdaten</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ks-name" className="text-sm">
              Name / Bezeichnung
            </Label>
            <Input id="ks-name" className="h-9" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ks-uid" className="text-sm">
              UID-Nummer
            </Label>
            <Input id="ks-uid" className="h-9" {...form.register("uidNumber")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ks-obj" className="text-sm">
              Verknüpftes Objekt
            </Label>
            <Input id="ks-obj" className="h-9" {...form.register("managedObjectLabel")} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ks-street" className="text-sm">
              Strasse (Hauptadresse)
            </Label>
            <Input id="ks-street" className="h-9" {...form.register("street")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ks-plz" className="text-sm">
              PLZ
            </Label>
            <Input id="ks-plz" className="h-9" {...form.register("postalCode")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ks-city" className="text-sm">
              Ort
            </Label>
            <Input id="ks-city" className="h-9" {...form.register("city")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ks-phone" className="text-sm">
              Telefon
            </Label>
            <Input id="ks-phone" className="h-9" {...form.register("phone")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ks-mobile" className="text-sm">
              Mobil
            </Label>
            <Input id="ks-mobile" className="h-9" {...form.register("mobile")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ks-email" className="text-sm">
              E-Mail
            </Label>
            <Input id="ks-email" type="email" className="h-9" {...form.register("email")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ks-web" className="text-sm">
              Webseite
            </Label>
            <Input id="ks-web" type="text" className="h-9" placeholder="https://…" {...form.register("website")} />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ansprechpartner</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
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
            <Plus className="mr-1 size-3.5" />
            Person
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          {persons.fields.map((field, index) => (
            <div
              key={field.id}
              className={cn(
                "grid gap-2.5 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-2",
                "sm:gap-3",
              )}
            >
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Vorname</Label>
                <Input className="h-9" {...form.register(`persons.${index}.firstName`)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Nachname</Label>
                <Input className="h-9" {...form.register(`persons.${index}.lastName`)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Position</Label>
                <Input className="h-9" {...form.register(`persons.${index}.roleTitle`)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">E-Mail</Label>
                <Input className="h-9" type="email" {...form.register(`persons.${index}.email`)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Telefon</Label>
                <Input className="h-9" {...form.register(`persons.${index}.phone`)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Mobil</Label>
                <Input className="h-9" {...form.register(`persons.${index}.mobile`)} />
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => persons.remove(index)}
                >
                  <Trash2 className="mr-1 size-3.5" />
                  Entfernen
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weitere Adressen</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => addresses.append({ ...emptyAddress })}
          >
            <Plus className="mr-1 size-3.5" />
            Adresse
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          {addresses.fields.map((field, index) => (
            <div key={field.id} className="grid gap-2.5 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-2 sm:gap-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Bezeichnung</Label>
                <Input className="h-9" placeholder="z. B. Rechnung, Werkhof" {...form.register(`addresses.${index}.label`)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Strasse</Label>
                <Input className="h-9" {...form.register(`addresses.${index}.street`)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">PLZ</Label>
                <Input className="h-9" {...form.register(`addresses.${index}.postalCode`)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Ort</Label>
                <Input className="h-9" {...form.register(`addresses.${index}.city`)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Land</Label>
                <Input className="h-9" {...form.register(`addresses.${index}.country`)} />
              </div>
              <div className="flex items-center gap-2 pt-1 sm:col-span-2">
                <Controller
                  control={form.control}
                  name={`addresses.${index}.isPrimary`}
                  render={({ field }) => (
                    <input
                      type="checkbox"
                      className="size-4 rounded border border-input"
                      checked={field.value ?? false}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  )}
                />
                <Label className="text-sm font-normal">Primär</Label>
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => addresses.remove(index)}>
                  <Trash2 className="mr-1 size-3.5" />
                  Entfernen
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}

      <div className="sticky bottom-0 -mx-1 border-t border-border/60 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button type="submit" className="w-full" disabled={savePending}>
          {savePending ? (
            <BauflipLoadingButtonLabel variant="onPrimary">Speichern …</BauflipLoadingButtonLabel>
          ) : (
            "Änderungen speichern"
          )}
        </Button>
      </div>
    </form>
  );
}
