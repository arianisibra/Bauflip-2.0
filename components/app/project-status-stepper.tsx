"use client";

import { ChevronRight } from "lucide-react";
import type { ProjectStatus } from "@/lib/domain/types";
import { projectStatuses } from "@/lib/domain/types";
import { statusLabels } from "@/lib/workflow/project-workflow";
import { cn } from "@/lib/utils";

const order = projectStatuses as readonly ProjectStatus[];

/**
 * Kanban-artige Statuszeile: bis zu fünf Stufen (2 davor, aktuell, 2 danach) entlang der definierten Projektstatus-Reihenfolge.
 */
export function ProjectStatusStepper({ status }: { status: ProjectStatus }) {
  const idx = order.indexOf(status);

  if (idx === -1) {
    return (
      <div
        className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
        role="status"
      >
        Unbekannter Status: {String(status)}
      </div>
    );
  }

  const steps = Array.from({ length: 5 }, (_, i) => {
    const j = idx - 2 + i;
    if (j < 0 || j >= order.length) {
      return { label: null as string | null };
    }
    const s = order[j]!;
    return { label: statusLabels[s] };
  });

  return (
    <div className="overflow-x-auto pb-1" role="region" aria-label="Projektstatus im Ablauf">
      <ol className="flex min-w-[min(100%,640px)] list-none items-stretch gap-0">
        {steps.map((step, i) => (
          <li key={i} className="flex min-w-0 flex-1 items-stretch">
            {i > 0 ? (
              <div className="flex shrink-0 items-center text-muted-foreground/40" aria-hidden>
                <ChevronRight className="size-4 sm:size-5" />
              </div>
            ) : null}
            <div
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center rounded-md border px-1 py-1.5 text-center text-[10px] font-semibold leading-snug sm:min-h-12 sm:px-2 sm:text-xs",
                i === 2 && step.label
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : step.label
                    ? i < 2
                      ? "border-border/70 bg-muted/60 text-foreground"
                      : "border-dashed border-border/60 bg-muted/25 text-muted-foreground"
                    : "border-transparent bg-muted/10 text-transparent",
              )}
              aria-current={i === 2 && step.label ? "step" : undefined}
              title={step.label ?? undefined}
            >
              <span className="line-clamp-2 w-full">{step.label ?? "\u00a0"}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
