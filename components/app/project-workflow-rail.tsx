import Link from "next/link";
import { Check } from "lucide-react";
import type { ProjectStatus } from "@/lib/domain/types";
import { statusLabels } from "@/lib/workflow/project-workflow";
import { PROJECT_WORKFLOW_STEPS, getWorkflowPhaseIndex } from "@/lib/workflow/project-workflow-rail";
import { cn } from "@/lib/utils";

type ProjectWorkflowRailProps = {
  status: ProjectStatus;
};

export function ProjectWorkflowRail({ status }: ProjectWorkflowRailProps) {
  const phaseIndex = getWorkflowPhaseIndex(status);
  const pipelineDone = status === "abgeschlossen";

  return (
    <aside
      className="w-full shrink-0 rounded-2xl border border-sky-200/80 bg-gradient-to-b from-sky-50/95 to-white shadow-sm ring-1 ring-sky-100/80 lg:sticky lg:top-20 lg:w-72 lg:self-start"
      aria-label="Ablauf für dieses Projekt"
    >
      <div className="border-b border-sky-100/90 px-4 py-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-sky-700/90">Geführter Prozess</p>
        <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">Vom Eingang bis zum Abschluss</p>
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
          Jetzt: <span className="font-medium text-foreground">{statusLabels[status]}</span>
        </p>
      </div>
      <ol className="flex flex-col gap-0 px-2 py-3">
        {PROJECT_WORKFLOW_STEPS.map((step, i) => {
          const done = pipelineDone || i < phaseIndex;
          const current = !pipelineDone && i === phaseIndex;
          const href = `#${step.id}`;

          return (
            <li key={step.id} className="relative flex gap-0">
              {i > 0 ? (
                <div
                  className={cn(
                    "absolute top-0 left-[1.125rem] h-3 w-px -translate-y-full",
                    done || current ? "bg-primary/45" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
              <div className="flex w-full min-w-0 gap-2.5 pb-3">
                <div className="flex flex-col items-center pt-0.5">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums transition-colors",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : current
                          ? "border-primary bg-primary/15 text-primary shadow-sm ring-2 ring-primary/25"
                          : "border-muted-foreground/25 bg-muted/40 text-muted-foreground",
                    )}
                    aria-current={current ? "step" : undefined}
                  >
                    {done ? <Check className="size-4" strokeWidth={2.5} /> : i + 1}
                  </span>
                  {i < PROJECT_WORKFLOW_STEPS.length - 1 ? (
                    <div
                      className={cn(
                        "mt-1 min-h-[1.25rem] w-px flex-1",
                        done ? "bg-primary/40" : "bg-border",
                      )}
                      aria-hidden
                    />
                  ) : null}
                </div>
                <Link
                  href={href}
                  className={cn(
                    "min-w-0 flex-1 rounded-xl px-2 py-1.5 text-left transition-colors",
                    current ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-sky-50/90",
                  )}
                >
                  <span
                    className={cn(
                      "block text-sm font-semibold leading-tight",
                      current ? "text-primary" : "text-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="mt-0.5 block text-[0.7rem] leading-snug text-muted-foreground">{step.hint}</span>
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="border-t border-sky-100/90 px-4 py-3 text-[0.7rem] leading-snug text-muted-foreground">
        Klick auf einen Schritt springt direkt zum passenden Bereich.
      </p>
    </aside>
  );
}
