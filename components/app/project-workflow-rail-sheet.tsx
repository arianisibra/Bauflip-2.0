"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { ProjectStatus } from "@/lib/domain/types";
import { statusLabels } from "@/lib/workflow/project-workflow";
import { PROJECT_WORKFLOW_STEPS, getWorkflowPhaseIndex } from "@/lib/workflow/project-workflow-rail";
import { cn } from "@/lib/utils";

type ProjectWorkflowRailSheetProps = {
  projectId: string;
  status: ProjectStatus;
  /** Welche Phase der Nutzer gerade im Inhaltsbereich sieht (0–7). */
  viewPhaseIndex: number;
  onSelectPhase: (phaseIndex: number) => void;
};

export function ProjectWorkflowRailSheet({
  projectId,
  status,
  viewPhaseIndex,
  onSelectPhase,
}: ProjectWorkflowRailSheetProps) {
  const phaseIndex = getWorkflowPhaseIndex(status);
  const pipelineDone = status === "abgeschlossen";

  return (
    <aside
      className="w-full shrink-0 rounded-2xl border border-sky-200/80 bg-gradient-to-b from-sky-50/95 to-white shadow-sm ring-1 ring-sky-100/80 lg:sticky lg:top-4 lg:w-64 lg:self-start"
      aria-label="Ablauf für dieses Projekt"
    >
      <div className="border-b border-sky-100/90 px-3 py-2.5">
        <p className="text-xs font-semibold leading-snug text-slate-900">Geführter Prozess</p>
        <p className="mt-0.5 text-[0.7rem] leading-snug text-muted-foreground">Vom Eingang bis zum Abschluss</p>
        <p className="mt-1.5 text-[0.7rem] leading-snug text-muted-foreground">
          Jetzt: <span className="font-medium text-foreground">{statusLabels[status]}</span>
        </p>
      </div>
      <ol className="flex flex-col gap-0 px-1.5 py-2">
        {PROJECT_WORKFLOW_STEPS.map((step, i) => {
          const done = pipelineDone || i < phaseIndex;
          const currentPipeline = !pipelineDone && i === phaseIndex;
          const viewing = i === viewPhaseIndex;
          const reachable = pipelineDone || i <= phaseIndex;

          return (
            <li key={step.id} className="relative flex gap-0">
              {i > 0 ? (
                <div
                  className={cn(
                    "absolute top-0 left-[1.125rem] h-3 w-px -translate-y-full",
                    done || currentPipeline ? "bg-primary/45" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
              <div className="flex w-full min-w-0 gap-2 pb-2">
                <div className="flex flex-col items-center pt-0.5">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-[0.65rem] font-bold tabular-nums transition-colors",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : currentPipeline
                          ? "border-primary bg-primary/15 text-primary shadow-sm ring-2 ring-primary/25"
                          : "border-muted-foreground/25 bg-muted/40 text-muted-foreground",
                    )}
                    aria-current={currentPipeline ? "step" : undefined}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
                  </span>
                  {i < PROJECT_WORKFLOW_STEPS.length - 1 ? (
                    <div
                      className={cn(
                        "mt-1 min-h-[1rem] w-px flex-1",
                        done ? "bg-primary/40" : "bg-border",
                      )}
                      aria-hidden
                    />
                  ) : null}
                </div>
                {reachable ? (
                  <button
                    type="button"
                    onClick={() => onSelectPhase(i)}
                    className={cn(
                      "min-w-0 flex-1 rounded-xl px-2 py-1 text-left transition-colors",
                      viewing ? "bg-primary/12 ring-1 ring-primary/25" : "hover:bg-sky-50/90",
                      currentPipeline && !viewing && "ring-1 ring-primary/15",
                    )}
                  >
                    <span
                      className={cn(
                        "block text-[0.8rem] font-semibold leading-tight",
                        currentPipeline ? "text-primary" : "text-foreground",
                      )}
                    >
                      {step.label}
                    </span>
                    <span className="mt-0.5 block text-[0.65rem] leading-snug text-muted-foreground">{step.hint}</span>
                  </button>
                ) : (
                  <div className="min-w-0 flex-1 rounded-xl px-2 py-1 opacity-45">
                    <span className="block text-[0.8rem] font-semibold leading-tight text-muted-foreground">{step.label}</span>
                    <span className="mt-0.5 block text-[0.65rem] leading-snug text-muted-foreground">{step.hint}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-sky-100/90 px-3 py-2.5">
        <p className="text-[0.65rem] leading-snug text-muted-foreground">
          Erledigte Schritte können Sie erneut öffnen. «Weiter» schaltet den nächsten Schritt frei.
        </p>
        <Link
          href={`/projekte/${projectId}`}
          className="mt-2 inline-block text-[0.7rem] font-medium text-primary underline-offset-4 hover:underline"
        >
          Vollansicht Projekt (Chat, Mail, …)
        </Link>
      </div>
    </aside>
  );
}
