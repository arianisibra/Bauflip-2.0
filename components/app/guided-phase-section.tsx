"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type GuidedPhaseSectionProps = {
  phaseIndex: number;
  currentPhaseIndex: number;
  id: string;
  children: ReactNode;
  className?: string;
};

/**
 * Sperrt zukünftige Prozessschritte, bis der aktuelle Schritt per Statuswechsel abgeschlossen ist.
 */
export function GuidedPhaseSection({
  phaseIndex,
  currentPhaseIndex,
  id,
  children,
  className,
}: GuidedPhaseSectionProps) {
  const locked = phaseIndex > currentPhaseIndex;

  return (
    <div id={id} className={cn("scroll-mt-28 space-y-4", className)}>
      <div className={cn("relative", locked && "rounded-xl")}>
        {locked ? (
          <div
            className="pointer-events-none absolute inset-0 z-[1] flex items-start justify-center rounded-xl bg-background/55 px-4 pt-10 pb-6 backdrop-blur-[1px]"
            aria-hidden
          >
            <p className="max-w-sm rounded-lg border bg-card px-4 py-3 text-center text-sm font-medium text-foreground shadow-sm">
              Dieser Schritt ist noch gesperrt. Schliessen Sie zuerst den aktuellen Schritt ab (oben: «Weiter»).
            </p>
          </div>
        ) : null}
        <div className={cn(locked && "pointer-events-none select-none opacity-[0.42]")}>{children}</div>
      </div>
    </div>
  );
}
