"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type {
  Article,
  ReportOutcomeOption,
  ReportSelectOption,
  SupplierOrderTemplate,
} from "@/lib/domain/types";
import {
  addReportSelectOptionAction,
  addTechnicianReportAction,
  deleteReportSelectOptionAction,
} from "@/app/(app)/actions";
import { ManagedSelect } from "@/components/app/managed-select";
import { OutcomeSelect } from "@/components/app/outcome-select";
import { ReportUploadSection } from "@/components/app/report-upload-section";
import { SupplierOrderForm } from "@/components/app/supplier-order-form";
import { VoiceTextarea } from "@/components/app/voice-textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type RapportCreateClientProps = {
  projectId: string;
  outcomeOptions: ReportOutcomeOption[];
  locationOptions: ReportSelectOption[];
  supplierTemplates: SupplierOrderTemplate[];
  articles: Article[];
  actorRole: string;
};

export function RapportCreateClient({
  projectId,
  outcomeOptions,
  locationOptions,
  supplierTemplates,
  articles,
  actorRole,
}: RapportCreateClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<1 | 2>(1);
  const [outcome, setOutcome] = useState("");
  const [summary, setSummary] = useState("");
  const [ort, setOrt] = useState("");
  const [timeMinutes, setTimeMinutes] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(supplierTemplates[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  const manageable = actorRole === "office" || actorRole === "admin";
  const selectedTemplate = supplierTemplates.find((t) => t.id === selectedTemplateId) ?? supplierTemplates[0] ?? null;

  function handleAfterUpload() {
    setUploadCount((n) => n + 1);
  }

  function handleSubmitRapport() {
    if (!outcome) {
      setError("Bitte Entscheid vor Ort wählen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("outcome", outcome);
      fd.set("summary", summary);
      fd.set("measurementsJson", JSON.stringify({ ort }));
      fd.set("serviceSelections", "[]");
      fd.set("articleSelections", "[]");
      if (timeMinutes.trim()) fd.set("timeSpentMinutes", timeMinutes.trim());
      const result = await addTechnicianReportAction(fd);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      setTimeout(() => router.push("/rapporte"), 1500);
    });
  }

  function goToStep2() {
    if (!outcome) {
      setError("Bitte Entscheid vor Ort wählen.");
      return;
    }
    setError(null);
    setStep(2);
  }

  if (saved) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="size-12 text-emerald-600" />
          <p className="text-lg font-semibold">Rapport gespeichert</p>
          <p className="text-sm text-muted-foreground">Weiterleitung zur Rapportliste …</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 font-medium",
            step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          1
        </span>
        <span className="text-border">—</span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 font-medium",
            step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          2
        </span>
        <span className="ml-2">{step === 1 ? "Rapport" : "Bestellformular"}</span>
      </div>

      {step === 1 ? (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Schritt 1: Rapport</CardTitle>
            <CardDescription>
              Entscheid vor Ort, Messangaben und Fotos. Pflicht ist nur der Entscheid vor Ort.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label>
                Entscheid vor Ort <span className="text-destructive">*</span>
              </Label>
              <OutcomeSelect
                options={outcomeOptions}
                value={outcome}
                onChange={setOutcome}
                manageable={manageable}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Ort (optional)</Label>
              <ManagedSelect
                options={locationOptions}
                value={ort}
                onChange={setOrt}
                placeholder="Ort wählen …"
                manageable={manageable}
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

            <div className="flex flex-col gap-2">
              <Label>Diagnose / Bemerkung (optional)</Label>
              <VoiceTextarea
                name="summary_display"
                placeholder="Was wurde vorgefunden? Kurze Beschreibung …"
                value={summary}
                onValueChange={setSummary}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Zeit vor Ort (Minuten, optional)</Label>
              <Input
                type="number"
                placeholder="z. B. 60"
                value={timeMinutes}
                onChange={(e) => setTimeMinutes(e.target.value)}
                className="h-10 max-w-xs"
                min={0}
              />
            </div>

            <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 p-1">
              <ReportUploadSection projectId={projectId} onAfterMutation={handleAfterUpload} large />
              {uploadCount > 0 ? (
                <p className="px-3 pb-2 text-xs text-muted-foreground">{uploadCount} Datei(en) am Projekt gespeichert.</p>
              ) : null}
            </div>

            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t bg-muted/20 sm:flex-row sm:justify-end">
            <Button type="button" variant="default" size="default" onClick={goToStep2}>
              Weiter zu Schritt 2: Bestellformular
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Schritt 2: Bestellformular</CardTitle>
            <CardDescription>
              Optional: Lieferantenbestellung als Entwurf speichern. Zum Abschluss den Rapport speichern.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {supplierTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Lieferantenvorlagen konfiguriert.</p>
            ) : (
              <>
                {supplierTemplates.length > 1 && (
                  <div className="flex flex-col gap-2">
                    <Label>Lieferant / Formular</Label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {supplierTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.supplierName} — {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {selectedTemplate ? (
                  <SupplierOrderForm
                    key={selectedTemplate.id}
                    projectId={projectId}
                    template={selectedTemplate}
                    articleOptions={articles}
                    draftMode
                    onSubmitted={() => {}}
                  />
                ) : null}
              </>
            )}

            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" size="default" onClick={() => setStep(1)} className="gap-2">
              <ArrowLeft className="size-4" />
              Zurück zu Schritt 1
            </Button>
            <Button
              type="button"
              size="default"
              className="min-w-[12rem] font-semibold shadow-sm"
              disabled={pending || !outcome}
              onClick={handleSubmitRapport}
            >
              {pending ? "Wird gespeichert …" : "Rapport speichern"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
