"use client";

import { useState } from "react";
import { addTechnicianReportAction } from "@/app/(app)/actions";
import { VoiceTextarea } from "@/components/app/voice-textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TechnicianReportFormProps = {
  projectId: string;
  variant: "full" | "fertigmeldung";
  className?: string;
  submitLabel: string;
  /** Called after successful save (e.g. refresh sheet data). Server action already revalidates routes. */
  onSuccess?: () => void | Promise<void>;
};

export function TechnicianReportForm({
  projectId,
  variant,
  className,
  submitLabel,
  onSuccess,
}: TechnicianReportFormProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className={className}
      action={async (fd) => {
        setError(null);
        const result = await addTechnicianReportAction(fd);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        await onSuccess?.();
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      {variant === "fertigmeldung" ? (
        <>
          <input type="hidden" name="outcome" value="direkt_geloest" />
          <input type="hidden" name="measurementsJson" value="{}" />
        </>
      ) : null}

      {variant === "full" ? (
        <>
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Entscheid vor Ort</Label>
            <select
              name="outcome"
              required
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
            >
              <option value="">Bitte wählen …</option>
              <option value="direkt_geloest">Direkt gelöst (Reparatur sofort)</option>
              <option value="ersatzteil_noetig">Ersatzteil nötig</option>
              <option value="werkstatt_noetig">Demontage → Werkstatt</option>
              <option value="vollersatz_noetig">Komplettersatz nötig</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Diagnose / Zusammenfassung</Label>
            <VoiceTextarea
              name="summary"
              placeholder="Was wurde vorgefunden? Was ist das Problem?"
              required
              minLength={10}
            />
            <p className="text-xs text-muted-foreground">Mindestens 10 Zeichen.</p>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Masse &amp; Produktdetails (JSON)</Label>
            <VoiceTextarea
              name="measurementsJson"
              placeholder='{"breite_mm": 1200, "hoehe_mm": 2400}'
              required
              minLength={2}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Massnahme / was muss gemacht werden</Label>
            <VoiceTextarea
              name="workDescription"
              placeholder="Genaue Beschreibung der Arbeit"
              required
              minLength={5}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Zeit vor Ort (Minuten)</Label>
            <Input name="timeSpentMinutes" type="number" placeholder="z. B. 60" />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Was wurde gemacht?</Label>
            <VoiceTextarea
              name="summary"
              placeholder="Ausgeführte Arbeiten beschreiben …"
              required
              minLength={10}
            />
            <p className="text-xs text-muted-foreground">Mindestens 10 Zeichen.</p>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Details / Bemerkungen</Label>
            <VoiceTextarea
              name="workDescription"
              placeholder="Besonderheiten, Nachmontage …"
              required
              minLength={5}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Arbeitszeit (Minuten)</Label>
            <Input name="timeSpentMinutes" type="number" placeholder="z. B. 120" className="h-9" />
          </div>
        </>
      )}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="sm">
        {submitLabel}
      </Button>
    </form>
  );
}
