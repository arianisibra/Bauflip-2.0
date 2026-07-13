"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Schlanker, wiederverwendbarer Schritt-Indikator für geführte Fenster-Flows
 * (Offerte/Rechnung/Zahlung). Rein präsentational — der Zustand liegt beim Aufrufer.
 * Bereits abgeschlossene Schritte sind anklickbar (zurückspringen), wenn `onStepClick`
 * gesetzt ist.
 */
export function Stepper({
  steps,
  current,
  onStepClick,
}: {
  steps: string[];
  current: number;
  onStepClick?: (index: number) => void;
}) {
  return (
    <ol className="flex items-center gap-1.5">
      {steps.map((label, index) => {
        const state = index < current ? "done" : index === current ? "active" : "todo";
        const canJump = Boolean(onStepClick) && index < current;
        return (
          <li key={label} className="flex flex-1 items-center gap-1.5">
            <button
              type="button"
              disabled={!canJump}
              onClick={() => canJump && onStepClick?.(index)}
              className={cn(
                "flex items-center gap-2 rounded-full text-left",
                canJump ? "cursor-pointer" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                  state === "done" && "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500",
                  state === "active" && "border-foreground bg-foreground text-background",
                  state === "todo" && "border-border bg-background text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden text-sm sm:inline",
                  state === "active" ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </button>
            {index < steps.length - 1 ? (
              <span
                className={cn(
                  "h-px flex-1",
                  index < current ? "bg-emerald-600/60 dark:bg-emerald-500/60" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
