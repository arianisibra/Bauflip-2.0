"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { WorkflowStage } from "@/lib/domain/workflow-types";
import {
  RAPPORT_NEXT_STEP_ICON_KEYS,
  STAGE_COLOR_BADGE_CLASSES,
  STAGE_COLOR_KEYS,
} from "@/lib/domain/stage-visuals";
import { workflowStageUpdateSchema } from "@/lib/validations/forms";
import { useUpdateWorkflowStage, useWorkflowStages } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FormState = {
  label: string;
  color: string;
  sortOrder: string;
  isInitial: boolean;
  isSchedulingTarget: boolean;
  promotesOnAppointment: boolean;
  isBilling: boolean;
  isTerminal: boolean;
  hiddenInOfficeFilter: boolean;
  rapportAufgenommen: boolean;
  rapportMontage: boolean;
  rapportBehobenTarget: boolean;
  rapportNextStepDescription: string;
  rapportNextStepIcon: string;
};

function formFromStage(stage: WorkflowStage): FormState {
  return {
    label: stage.label,
    color: stage.color,
    sortOrder: String(stage.sortOrder),
    isInitial: stage.isInitial,
    isSchedulingTarget: stage.isSchedulingTarget,
    promotesOnAppointment: stage.promotesOnAppointment,
    isBilling: stage.isBilling,
    isTerminal: stage.isTerminal,
    hiddenInOfficeFilter: stage.hiddenInOfficeFilter,
    rapportAufgenommen: stage.rapportAufgenommen,
    rapportMontage: stage.rapportMontage,
    rapportBehobenTarget: stage.rapportBehobenTarget,
    rapportNextStepDescription: stage.rapportNextStepDescription ?? "",
    rapportNextStepIcon: stage.rapportNextStepIcon ?? "",
  };
}

const TAG_FIELDS: { key: keyof FormState; label: string; hint: string }[] = [
  { key: "isInitial", label: "Startstatus", hint: "Neue Anfragen beginnen hier." },
  { key: "isSchedulingTarget", label: "Zielstatus bei Terminbuchung", hint: "Wird bei automatischer Promotion angesteuert." },
  { key: "promotesOnAppointment", label: "Wechselt bei Terminbuchung automatisch", hint: "Springt selbst zum Zielstatus, sobald ein Termin ansteht." },
  { key: "isBilling", label: "Abrechnungsstatus", hint: "Kennzeichnet den Rechnungsschritt." },
  { key: "isTerminal", label: "Endstatus", hint: "Projekt gilt danach als abgeschlossen." },
  { key: "hiddenInOfficeFilter", label: "Im Büro-Filter ausgeblendet", hint: "Erscheint nicht in der Standard-Statusliste." },
  { key: "rapportAufgenommen", label: "Rapport: Zwischenstand", hint: "«Schaden aufgenommen» im Monteur-Rapport." },
  { key: "rapportMontage", label: "Rapport: Montage/Einsatz", hint: "Kennzeichnet einen Montage-Einsatz." },
  { key: "rapportBehobenTarget", label: "Zielstatus nach Rapport «Behoben»", hint: "Wird nach einem erledigten Rapport automatisch gesetzt." },
];

/** Workflow-Stages (Einstellungen, nur Admin): Liste + Bearbeiten-Fenster pro Status. Key ist fix. */
export function WorkflowStagesManager() {
  const stagesQuery = useWorkflowStages();
  const updateStage = useUpdateWorkflowStage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const stages = [...(stagesQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const editing = editingId ? stages.find((s) => s.id === editingId) : null;

  const openEdit = (stage: WorkflowStage) => {
    setEditingId(stage.id);
    setForm(formFromStage(stage));
  };
  const closeEdit = () => {
    setEditingId(null);
    setForm(null);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const submit = async () => {
    if (!editing || !form) return;
    const sortOrder = Number.parseInt(form.sortOrder, 10);
    const payload = {
      label: form.label,
      color: form.color,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      isInitial: form.isInitial,
      isSchedulingTarget: form.isSchedulingTarget,
      promotesOnAppointment: form.promotesOnAppointment,
      isBilling: form.isBilling,
      isTerminal: form.isTerminal,
      hiddenInOfficeFilter: form.hiddenInOfficeFilter,
      rapportAufgenommen: form.rapportAufgenommen,
      rapportMontage: form.rapportMontage,
      rapportBehobenTarget: form.rapportBehobenTarget,
      rapportNextStepDescription: form.rapportNextStepDescription.trim() || null,
      rapportNextStepIcon: form.rapportNextStepIcon.trim() || null,
    };
    const parsed = workflowStageUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
      return;
    }
    try {
      await updateStage.mutateAsync({ stageId: editing.id, values: parsed.data });
      toast.success("Status gespeichert");
      closeEdit();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const summary = stagesQuery.isLoading
    ? "Wird geladen …"
    : stages.length > 0
      ? `${stages.length} Status-Definitionen`
      : "Noch nicht konfiguriert — es gelten die Standardwerte.";

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" disabled={updateStage.isPending} onClick={closeEdit}>
        Abbrechen
      </Button>
      <Button type="button" disabled={updateStage.isPending} onClick={submit}>
        {updateStage.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Speichern
      </Button>
    </div>
  );

  return (
    <>
      <section className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Workflow</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{summary}</p>
          </div>
        </div>

        {stages.length > 0 ? (
          <ul className="mt-3 divide-y divide-border/60">
            {stages.map((stage) => (
              <li key={stage.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STAGE_COLOR_BADGE_CLASSES[stage.color] ?? ""}`}
                  >
                    {stage.label}
                  </span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">{stage.key}</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => openEdit(stage)}>
                  Bearbeiten
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Dialog
        open={editing !== null && form !== null}
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
        title={editing ? `Status «${editing.key}» bearbeiten` : ""}
        description="Anzeige und Automatik-Tags. Der interne Schlüssel bleibt fix."
        footer={footer}
        className="max-w-lg"
      >
        {form ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr]">
              <div>
                <Label className="text-[11px]">Label</Label>
                <Input value={form.label} onChange={(e) => setField("label", e.target.value)} />
              </div>
              <div>
                <Label className="text-[11px]">Farbe</Label>
                <Select value={form.color} onValueChange={(v) => setField("color", String(v))}>
                  <SelectTrigger className="h-9 w-full min-w-0">
                    <SelectValue placeholder="Wählen …" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_COLOR_KEYS.map((color) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Reihenfolge</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setField("sortOrder", e.target.value)}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Automatik-Tags
              </p>
              <div className="space-y-1.5">
                {TAG_FIELDS.map((field) => (
                  <label
                    key={field.key}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm transition-colors hover:bg-muted/30"
                  >
                    <input
                      type="checkbox"
                      className="accent-primary mt-0.5"
                      checked={Boolean(form[field.key])}
                      onChange={(e) => setField(field.key, e.target.checked as FormState[typeof field.key])}
                    />
                    <span>
                      <span className="block font-medium">{field.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{field.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {form.rapportAufgenommen || form.rapportMontage ? (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Rapport-Nächste-Schritte-Karte
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]">
                  <div>
                    <Label className="text-[11px]">Beschreibung</Label>
                    <Input
                      value={form.rapportNextStepDescription}
                      placeholder="z. B. Masse aufgenommen, Offerte erstellen"
                      onChange={(e) => setField("rapportNextStepDescription", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Icon</Label>
                    <Select
                      value={form.rapportNextStepIcon}
                      onValueChange={(v) => setField("rapportNextStepIcon", String(v))}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0">
                        <SelectValue placeholder="Wählen …" />
                      </SelectTrigger>
                      <SelectContent>
                        {RAPPORT_NEXT_STEP_ICON_KEYS.map((icon) => (
                          <SelectItem key={icon} value={icon}>
                            {icon}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
