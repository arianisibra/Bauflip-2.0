"use client";

import { useState } from "react";
import { addTechnicianReportAction } from "@/app/(app)/actions";
import type { Article } from "@/lib/domain/types";
import { VoiceTextarea } from "@/components/app/voice-textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TechnicianReportFormProps = {
  projectId: string;
  variant: "full" | "fertigmeldung";
  className?: string;
  submitLabel: string;
  articleOptions?: Article[];
  /** Called after successful save (e.g. refresh sheet data). Server action already revalidates routes. */
  onSuccess?: () => void | Promise<void>;
};

const SERVICE_OPTIONS = [
  "Fehlersuche",
  "Wartung",
  "Reparatur",
  "Montage",
  "Demontage",
  "Einstellung/Kalibrierung",
];

export function TechnicianReportForm({
  projectId,
  variant,
  className,
  submitLabel,
  articleOptions = [],
  onSuccess,
}: TechnicianReportFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [serviceList, setServiceList] = useState<string[]>([]);
  const [articleList, setArticleList] = useState<Array<{ id: string; name: string }>>([]);

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
            <Label className="text-sm">Dienstleistungen (vordefiniert)</Label>
            <div className="flex items-center gap-2">
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
              >
                <option value="">Dienstleistung wählen …</option>
                {SERVICE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!selectedService || serviceList.includes(selectedService)) {
                    return;
                  }
                  setServiceList((prev) => [...prev, selectedService]);
                  setSelectedService("");
                }}
              >
                Hinzufügen
              </Button>
            </div>
            {serviceList.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {serviceList.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="rounded-md border px-2 py-0.5 text-xs"
                    onClick={() => setServiceList((prev) => prev.filter((x) => x !== item))}
                  >
                    {item} ×
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Noch keine Dienstleistung gewählt.</p>
            )}
            <input type="hidden" name="serviceSelections" value={JSON.stringify(serviceList)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Artikel aus Artikelliste</Label>
            <div className="flex items-center gap-2">
              <select
                value={selectedArticleId}
                onChange={(e) => setSelectedArticleId(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
              >
                <option value="">Artikel wählen …</option>
                {articleOptions.map((article) => (
                  <option key={article.id} value={article.id}>
                    {article.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!selectedArticleId || articleList.some((a) => a.id === selectedArticleId)) {
                    return;
                  }
                  const article = articleOptions.find((a) => a.id === selectedArticleId);
                  if (!article) {
                    return;
                  }
                  setArticleList((prev) => [...prev, { id: article.id, name: article.name }]);
                  setSelectedArticleId("");
                }}
              >
                Hinzufügen
              </Button>
            </div>
            {articleList.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {articleList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="rounded-md border px-2 py-0.5 text-xs"
                    onClick={() => setArticleList((prev) => prev.filter((x) => x.id !== item.id))}
                  >
                    {item.name} ×
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Noch kein Artikel gewählt.</p>
            )}
            <input type="hidden" name="articleSelections" value={JSON.stringify(articleList.map((a) => a.id))} />
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
