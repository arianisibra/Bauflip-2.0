"use client";

import { useMemo, useState } from "react";
import { addReportSelectOptionAction, addTechnicianReportAction, deleteReportSelectOptionAction } from "@/app/(app)/actions";
import type { Article, ReportOutcomeOption, ReportSelectOption } from "@/lib/domain/types";
import { ManagedSelect } from "@/components/app/managed-select";
import { OutcomeSelect } from "@/components/app/outcome-select";
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
  outcomeOptions?: ReportOutcomeOption[];
  locationOptions?: ReportSelectOption[];
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

const ORT_OPTIONS = [
  "Balkon",
  "Balkon Südseite",
  "Balkon Nordseite",
  "Terrasse",
  "Terrasse Südseite",
  "Fenster",
  "Fassade",
  "Wintergarten",
  "Sitzplatz",
  "Innenbereich",
];

const FARBE_OPTIONS = ["Weiss", "Anthrazit", "Schwarz", "Silber", "Beige", "Grau", "Braun", "RAL nach Auftrag"];
const STOFFART_OPTIONS = ["Acryl", "Polyester", "Screen", "PVC", "Soltis", "Blackout"];
const BEDIENUNG_OPTIONS = ["Kurbel", "Motor", "Funk", "Schalter", "Smart Home"];

function mmOptions(min: number, max: number, step: number): string[] {
  const out: string[] = [];
  for (let v = min; v <= max; v += step) {
    out.push(String(v));
  }
  return out;
}

const BREITE_OPTIONS = mmOptions(600, 7000, 50);
const HOEHE_OPTIONS = mmOptions(600, 4000, 50);
const AUSLADUNG_OPTIONS = mmOptions(1000, 5000, 100);

export function TechnicianReportForm({
  projectId,
  variant,
  className,
  submitLabel,
  articleOptions = [],
  outcomeOptions = [],
  locationOptions = [],
  onSuccess,
}: TechnicianReportFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [serviceList, setServiceList] = useState<string[]>([]);
  const [articleList, setArticleList] = useState<Array<{ id: string; name: string }>>([]);
  const [measurements, setMeasurements] = useState({
    breite: "",
    hoehe: "",
    farbeStoff: "",
    farbeRahmen: "",
    stoffart: "",
    ort: "",
    datum: "",
    bedienung: "",
    ausladung: "",
  });

  const selectedArticles = useMemo(
    () => articleList.map((item) => articleOptions.find((a) => a.id === item.id)).filter(Boolean) as Article[],
    [articleList, articleOptions],
  );
  const hasStorenArticle = selectedArticles.some((a) => a.categoryTemplateScope === "storen");
  const hasSonnenstorenArticle = selectedArticles.some((a) => a.categoryTemplateScope === "sonnenstoren");
  const hasDlArticle = selectedArticles.some((a) => a.categoryTemplateScope === "dl");
  const effectiveBezeichnung = articleList.map((a) => a.name).join(", ");
  const measurementsJsonValue = JSON.stringify({
    bezeichnung: effectiveBezeichnung,
    breite: measurements.breite,
    hoehe: measurements.hoehe,
    farbeStoff: measurements.farbeStoff,
    farbeRahmen: measurements.farbeRahmen,
    stoffart: measurements.stoffart,
    ort: measurements.ort,
    datum: measurements.datum,
    bedienung: measurements.bedienung,
    ausladung: measurements.ausladung,
    xxxBEZEICHNUNGxxx: effectiveBezeichnung,
    xxxBREITExxx: measurements.breite,
    xxxHOEHExxx: measurements.hoehe,
    xxxFARBESTOFFxxx: measurements.farbeStoff,
    xxxFARBERAHMENxxx: measurements.farbeRahmen,
    xxxSTOFFARTxxx: measurements.stoffart,
    xxxORTxxx: measurements.ort,
    xxxDATUMxxx: measurements.datum,
    xxxBEDIENUNGxxx: measurements.bedienung,
    xxxAUSLADUNGxxx: measurements.ausladung,
  });

  return (
    <form
      className={className}
      action={async (fd) => {
        setError(null);
        if (variant === "full" && !fd.get("outcome")) {
          setError("Bitte wählen Sie einen Entscheid vor Ort.");
          return;
        }
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
            <OutcomeSelect
              options={outcomeOptions}
              value={outcome}
              onChange={setOutcome}
              name="outcome"
              manageable
            />
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
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">Artikel aus Artikelliste</Label>
              <a
                href="/artikel/neu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                + Neuer Artikel
              </a>
            </div>
            <select
              value={selectedArticleId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedArticleId(nextId);
                if (!nextId || articleList.some((a) => a.id === nextId)) {
                  return;
                }
                const article = articleOptions.find((a) => a.id === nextId);
                if (!article) {
                  return;
                }
                setArticleList((prev) => [...prev, { id: article.id, name: article.name }]);
                setSelectedArticleId("");
              }}
              disabled={articleOptions.length === 0}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{articleOptions.length > 0 ? "Artikel wählen …" : "Keine Artikel verfügbar"}</option>
              {articleOptions.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.name}
                </option>
              ))}
            </select>
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
          <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Artikel werden oben ausgewählt. Die Bezeichnung wird automatisch aus den gewählten Artikeln übernommen.
            </p>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label className="text-sm">Ort</Label>
              <ManagedSelect
                options={locationOptions}
                value={measurements.ort}
                onChange={(v) => setMeasurements((prev) => ({ ...prev, ort: v }))}
                placeholder="Ort wählen …"
                manageable
                addDialogTitle="Neuer Ort"
                addDialogPlaceholder="z. B. Dachterrasse"
                onAdd={async (label) => {
                  const fd = new FormData();
                  fd.set("fieldKey", "ort");
                  fd.set("label", label);
                  return addReportSelectOptionAction(fd);
                }}
                onDelete={async (opt) => {
                  const fd = new FormData();
                  fd.set("optionId", opt.id);
                  await deleteReportSelectOptionAction(fd);
                }}
              />
            </div>

            {hasStorenArticle ? (
              <>
                <div className="flex flex-col gap-1">
                  <Label className="text-sm">Breite</Label>
                  <select
                    value={measurements.breite}
                    onChange={(e) => setMeasurements((prev) => ({ ...prev, breite: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                    required
                  >
                    <option value="">Breite wählen …</option>
                    {BREITE_OPTIONS.map((mm) => (
                      <option key={mm} value={mm}>
                        {mm} mm
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-sm">Höhe</Label>
                  <select
                    value={measurements.hoehe}
                    onChange={(e) => setMeasurements((prev) => ({ ...prev, hoehe: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                    required
                  >
                    <option value="">Höhe wählen …</option>
                    {HOEHE_OPTIONS.map((mm) => (
                      <option key={mm} value={mm}>
                        {mm} mm
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-sm">Farbe Stoff</Label>
                  <select
                    value={measurements.farbeStoff}
                    onChange={(e) => setMeasurements((prev) => ({ ...prev, farbeStoff: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                    required
                  >
                    <option value="">Farbe Stoff wählen …</option>
                    {FARBE_OPTIONS.map((item) => (
                      <option key={`stoff-${item}`} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-sm">Farbe Rahmen</Label>
                  <select
                    value={measurements.farbeRahmen}
                    onChange={(e) => setMeasurements((prev) => ({ ...prev, farbeRahmen: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                    required
                  >
                    <option value="">Farbe Rahmen wählen …</option>
                    {FARBE_OPTIONS.map((item) => (
                      <option key={`rahmen-${item}`} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-sm">Stoffart</Label>
                  <select
                    value={measurements.stoffart}
                    onChange={(e) => setMeasurements((prev) => ({ ...prev, stoffart: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                    required
                  >
                    <option value="">Stoffart wählen …</option>
                    {STOFFART_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-sm">Bedienung</Label>
                  <select
                    value={measurements.bedienung}
                    onChange={(e) => setMeasurements((prev) => ({ ...prev, bedienung: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                    required
                  >
                    <option value="">Bedienung wählen …</option>
                    {BEDIENUNG_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}

            {hasSonnenstorenArticle ? (
              <div className="flex flex-col gap-1">
                <Label className="text-sm">Ausladung</Label>
                <select
                  value={measurements.ausladung}
                  onChange={(e) => setMeasurements((prev) => ({ ...prev, ausladung: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                  required
                >
                  <option value="">Ausladung wählen …</option>
                  {AUSLADUNG_OPTIONS.map((mm) => (
                    <option key={mm} value={mm}>
                      {mm} mm
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {hasDlArticle ? (
              <div className="flex flex-col gap-1">
                <Label className="text-sm">Datum (DL)</Label>
                <Input
                  type="date"
                  value={measurements.datum}
                  onChange={(e) => setMeasurements((prev) => ({ ...prev, datum: e.target.value }))}
                  required
                />
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground sm:col-span-2">
              Felder werden je nach ausgewähltem Artikeltyp eingeblendet (Storen, Sonnenstoren, DL).
            </p>
            <input type="hidden" name="measurementsJson" value={measurementsJsonValue} />
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
