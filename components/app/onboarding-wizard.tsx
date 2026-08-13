"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  completeOnboardingAction,
  updateOrganizationNameAction,
} from "@/app/(app)/einstellungen/onboarding-actions";
import {
  useUpdateWorkflowStage,
  useUpdateWorkflowTransition,
  useWorkflowStages,
  useWorkflowTransitions,
} from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Erstes Einrichten einer frisch angelegten Organisation (nur Admin, nur solange
 * `onboarding_completed_at` leer ist): Firmenname → Status-Bezeichnungen →
 * Pipeline-Knöpfe. Speichert pro Schritt nur, was tatsächlich geändert wurde —
 * die Storenbau-Begriffe bleiben sonst als Vorlage stehen. Jederzeit über
 * «Später» schliessbar; erscheint dann beim nächsten Seitenaufruf erneut.
 */
export function OnboardingWizard({ initialCompanyName }: { initialCompanyName: string }) {
  const router = useRouter();
  const stagesQuery = useWorkflowStages();
  const transitionsQuery = useWorkflowTransitions();
  const updateStage = useUpdateWorkflowStage();
  const updateTransition = useUpdateWorkflowTransition();

  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [stageLabels, setStageLabels] = useState<Record<string, string>>({});
  const [transitionLabels, setTransitionLabels] = useState<Record<string, string>>({});

  const stages = [...(stagesQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const transitions = [...(transitionsQuery.data ?? [])].sort((a, b) => {
    if (a.fromKey !== b.fromKey) return a.fromKey.localeCompare(b.fromKey);
    return a.sortOrder - b.sortOrder;
  });
  const stageLabel = (key: string) => {
    const stage = stages.find((s) => s.key === key);
    if (!stage) return key;
    return stageLabels[stage.id] ?? stage.label;
  };

  const saveStep = async (): Promise<boolean> => {
    setSaving(true);
    try {
      if (step === 0) {
        const trimmed = companyName.trim();
        if (!trimmed) {
          toast.error("Firmenname darf nicht leer sein.");
          return false;
        }
        if (trimmed !== initialCompanyName) {
          await updateOrganizationNameAction(trimmed);
        }
      } else if (step === 1) {
        for (const stage of stages) {
          const edited = stageLabels[stage.id]?.trim();
          if (edited && edited !== stage.label) {
            await updateStage.mutateAsync({
              stageId: stage.id,
              values: {
                label: edited,
                color: stage.color,
                sortOrder: stage.sortOrder,
                isInitial: stage.isInitial,
                isSchedulingTarget: stage.isSchedulingTarget,
                promotesOnAppointment: stage.promotesOnAppointment,
                isBilling: stage.isBilling,
                isTerminal: stage.isTerminal,
                hiddenInOfficeFilter: stage.hiddenInOfficeFilter,
                rapportAufgenommen: stage.rapportAufgenommen,
                rapportMontage: stage.rapportMontage,
                rapportBehobenTarget: stage.rapportBehobenTarget,
                // Beide sind im Schema nullable, aber nicht optional. Fehlten sie hier,
                // scheiterte das Umbenennen im Wizard mit «expected string, received
                // undefined» — der Schritt, um den es im Onboarding überhaupt geht.
                rapportNextStepDescription: stage.rapportNextStepDescription,
                rapportNextStepIcon: stage.rapportNextStepIcon,
              },
            });
          }
        }
      } else if (step === 2) {
        for (const t of transitions) {
          const edited = transitionLabels[t.id]?.trim();
          if (edited && edited !== t.actionLabel) {
            await updateTransition.mutateAsync({
              transitionId: t.id,
              values: { fromKey: t.fromKey, toKey: t.toKey, actionLabel: edited, sortOrder: t.sortOrder },
            });
          }
        }
      }
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (!(await saveStep())) return;
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    setSaving(true);
    try {
      await completeOnboardingAction();
      toast.success("Einrichtung abgeschlossen");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Abschliessen fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const stepTitles = ["Willkommen bei Bauflip", "Eure Arbeitsschritte", "Eure Pipeline-Knöpfe"] as const;
  const stepDescriptions = [
    "Wie heisst euer Betrieb? Der Name erscheint auf Offerten, Rechnungen und im Kopfbereich.",
    "So heissen die Status eines Auftrags bei euch. Passt die Begriffe an eure Sprache an — die Vorschläge sind ein neutraler Startpunkt und lassen sich später jederzeit in den Einstellungen ändern.",
    "Diese Knöpfe schalten einen Auftrag von einem Status zum nächsten. Beschriftet sie so, wie ihr im Alltag sprecht.",
  ] as const;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setOpen(false);
      }}
      title={`${stepTitles[step]} (${step + 1}/3)`}
      description={stepDescriptions[step]}
      className="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" disabled={saving} onClick={() => setOpen(false)}>
            Später
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button type="button" variant="outline" disabled={saving} onClick={() => setStep(step - 1)}>
                Zurück
              </Button>
            ) : null}
            <Button type="button" disabled={saving} onClick={next}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {step < 2 ? "Weiter" : "Fertig"}
            </Button>
          </div>
        </div>
      }
    >
      {step === 0 ? (
        <div>
          <Label className="text-[11px]">Firmenname</Label>
          <Input
            value={companyName}
            placeholder="z. B. Muster AG"
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-1.5">
          {stagesQuery.isLoading ? <p className="text-sm text-muted-foreground">Wird geladen …</p> : null}
          {stages.map((stage) => (
            <div key={stage.id} className="grid grid-cols-[1fr_2fr] items-center gap-2">
              <span className="truncate font-mono text-[11px] text-muted-foreground">{stage.key}</span>
              <Input
                value={stageLabels[stage.id] ?? stage.label}
                onChange={(e) => setStageLabels((prev) => ({ ...prev, [stage.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-1.5">
          {transitionsQuery.isLoading ? <p className="text-sm text-muted-foreground">Wird geladen …</p> : null}
          {transitions.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_1fr] items-center gap-2">
              <span className="truncate text-[11px] text-muted-foreground">
                {stageLabel(t.fromKey)} → {stageLabel(t.toKey)}
              </span>
              <Input
                value={transitionLabels[t.id] ?? t.actionLabel}
                onChange={(e) => setTransitionLabels((prev) => ({ ...prev, [t.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      ) : null}
    </Dialog>
  );
}
