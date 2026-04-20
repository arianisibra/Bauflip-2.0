"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createIntakeAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function IntakeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      action={async (fd) => {
        setError(null);
        setPending(true);
        try {
          const res = await createIntakeAction(fd);
          if (res?.projectId) {
            router.push(`/projekte?openProjectId=${encodeURIComponent(res.projectId)}`);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
        } finally {
          setPending(false);
        }
      }}
    >
      <input type="hidden" name="source" value="email" />
      <input type="hidden" name="type" value="reparatur" />

      <div className="space-y-1">
        <Label htmlFor="title">Kurztitel</Label>
        <Input id="title" name="title" required placeholder="z. B. Storen Balkon 3. OG" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="tenantName">Mieter / Kontakt</Label>
        <Input id="tenantName" name="tenantName" required />
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="managementPhone">Telefon Verwaltung</Label>
          <Input id="managementPhone" name="managementPhone" type="tel" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="managementEmail">E-Mail Verwaltung</Label>
          <Input id="managementEmail" name="managementEmail" type="email" />
        </div>
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
        <Label htmlFor="intakeOriginalText">Problembeschreibung</Label>
        <Textarea id="intakeOriginalText" name="intakeOriginalText" required rows={5} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="hintsAndNotes">Hinweise fürs Team (optional)</Label>
        <Textarea id="hintsAndNotes" name="hintsAndNotes" rows={2} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Speichern…" : "Auftrag anlegen"}
      </Button>
    </form>
  );
}
