"use client";

import { useRef, useState } from "react";
import { useContacts, useCreateIntake } from "@/lib/query/hooks";
import type { Contact } from "@/lib/domain/types";
import { ContactPicker } from "@/components/app/contact-picker";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function IntakeForm({ onCreated }: { onCreated?: (projectId: string) => void }) {
  const createIntake = useCreateIntake();
  const contactsQuery = useContacts();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Gewählte Kontakt-ID je Rolle — geht als Hidden-Input mit und verknüpft Projekt ↔ Kontakt.
  const [linkedTenantId, setLinkedTenantId] = useState("");
  const [linkedManagementId, setLinkedManagementId] = useState("");
  const pending = createIntake.isPending;

  const setField = (name: string, value: string | null) => {
    const el = formRef.current?.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (el && value) el.value = value;
  };

  // Übernimmt einen Kontakt in die passenden Projektfelder: Verwaltung → Verwaltungsblock,
  // sonst → Mieter-/Kontaktblock. Adresse wird immer übernommen, wenn vorhanden.
  const applyContact = (c: Contact) => {
    if (c.kind === "verwaltung") {
      setField("managementName", c.companyName || c.displayName);
      setField("managementEmail", c.email);
      setLinkedManagementId(c.id);
    } else {
      setField("tenantName", c.displayName);
      setField("tenantPhone", c.phone || c.mobile);
      setField("tenantEmail", c.email);
      setLinkedTenantId(c.id);
    }
    setField("serviceStreet", c.street);
    setField("servicePostalCode", c.postalCode);
    setField("serviceCity", c.city);
  };

  const contacts = contactsQuery.data ?? [];

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-4"
      aria-busy={pending}
      action={async (fd) => {
        setError(null);
        try {
          const res = await createIntake.mutateAsync(fd);
          if (res?.projectId) onCreated?.(res.projectId);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
        }
      }}
    >
      <input type="hidden" name="source" value="email" />
      <input type="hidden" name="type" value="reparatur" />
      <input type="hidden" name="tenantContactId" value={linkedTenantId} />
      <input type="hidden" name="managementContactId" value={linkedManagementId} />


      {contacts.length > 0 ? (
        <div className="space-y-1">
          <Label>Aus Kontakt übernehmen (optional)</Label>
          <ContactPicker contacts={contacts} onPick={applyContact} />
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="tenantName">Mieter / Kontakt</Label>
        <Input id="tenantName" name="tenantName" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="tenantPhone">Telefon Mieter</Label>
          <Input id="tenantPhone" name="tenantPhone" type="tel" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tenantEmail">E-Mail Mieter</Label>
          <Input id="tenantEmail" name="tenantEmail" type="email" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="managementName">Verwaltung</Label>
        <Input id="managementName" name="managementName" placeholder="Name" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="managementEmail">Zuständige Person</Label>
        <Input id="managementEmail" name="managementEmail" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="costCeilingText">Kostendach</Label>
        <Input id="costCeilingText" name="costCeilingText" placeholder="z. B. CHF 500 oder frei" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="serviceStreet">Strasse</Label>
          <Input id="serviceStreet" name="serviceStreet" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="servicePostalCode">PLZ</Label>
          <Input id="servicePostalCode" name="servicePostalCode" />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label htmlFor="serviceCity">Ort</Label>
          <Input id="serviceCity" name="serviceCity" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="intakeOriginalText">Wichtige Informationen</Label>
        <Textarea id="intakeOriginalText" name="intakeOriginalText" rows={5} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <BauflipLoadingButtonLabel variant="onPrimary">Wird angelegt …</BauflipLoadingButtonLabel>
        ) : (
          "Auftrag anlegen"
        )}
      </Button>
    </form>
  );
}
