"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { transitionProjectAction } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

export type GuidedStepDisplay = {
  id: string;
  label: string;
};

export type GuidedOptionDisplay = {
  to: string;
  label: string;
  isPrimary: boolean;
  canSubmit: boolean;
  missingFieldLabels: string[];
  prerequisiteMessages: string[];
  nextOwnerRole: string;
};

const NEXT_OWNER_LABEL_DE: Record<string, string> = {
  office: "Büro",
  admin: "Admin",
  technician: "Monteur",
};

function formatNextOwnerLabel(role: string) {
  return NEXT_OWNER_LABEL_DE[role] ?? role;
}

type ProjectGuidedProcessProps = {
  projectId: string;
  phaseIndex: number;
  totalSteps: number;
  currentStepLabel: string;
  currentStepHint: string;
  stepAnchorId: string;
  completed: boolean;
  steps: GuidedStepDisplay[];
  options: GuidedOptionDisplay[];
  /** Volle Seite: Pills + Hash-Links. Sheet: schlank ohne doppelte Navigation. */
  layoutVariant?: "full" | "sheetCompact";
  /** Sidebar / Sheet: Schritte per Klick ansteuern statt Hash-Links. */
  onNavigateToStep?: (stepId: string) => void;
  /** Welcher Schritt im Inhalt fokussiert ist (für Pills / Springen-Link). */
  focusedStepIndex?: number;
  /** Nach erfolgreichem Statuswechsel (z. B. Sheet-Daten neu laden). */
  onAfterStatusTransition?: () => void | Promise<void>;
};

function GuidedStatusTransitionForms({
  projectId,
  options,
  onAfterStatusTransition,
  compact,
}: {
  projectId: string;
  options: GuidedOptionDisplay[];
  onAfterStatusTransition?: () => void | Promise<void>;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const blockIssues = (opt: GuidedOptionDisplay) => [...opt.missingFieldLabels, ...opt.prerequisiteMessages];

  return (
    <div className="flex flex-col gap-3">
      {!compact ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nächster Schritt im System</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {options.map((opt) => {
        const issues = blockIssues(opt);
        return (
          <form
            key={opt.to}
            className={cn(
              "rounded-xl border p-4",
              opt.isPrimary && "border-primary/35 bg-primary/[0.04] shadow-sm",
              !opt.isPrimary && "border-border/80 bg-card",
            )}
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                try {
                  await transitionProjectAction(fd);
                  await onAfterStatusTransition?.();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Statuswechsel fehlgeschlagen.");
                }
              });
            }}
          >
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="targetStatus" value={opt.to} />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold leading-snug text-foreground">
                  {opt.label}
                  {opt.isPrimary ? (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">(empfohlen)</span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nächster Schritt bei: <span className="font-medium text-foreground">{formatNextOwnerLabel(opt.nextOwnerRole)}</span>
                </p>
              </div>
              <Button type="submit" size="default" className="shrink-0" disabled={!opt.canSubmit || pending}>
                Weiter
              </Button>
            </div>
            {!opt.canSubmit && issues.length > 0 ? (
              <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2">
                <p className="text-xs font-semibold text-destructive">Noch offen</p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-destructive">
                  {opt.missingFieldLabels.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                  {opt.prerequisiteMessages.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </form>
        );
      })}
    </div>
  );
}

export function ProjectGuidedProcess({
  projectId,
  phaseIndex,
  totalSteps,
  currentStepLabel,
  currentStepHint,
  stepAnchorId,
  completed,
  steps,
  options,
  layoutVariant = "full",
  onNavigateToStep,
  focusedStepIndex,
  onAfterStatusTransition,
}: ProjectGuidedProcessProps) {
  const sheetMode = Boolean(onNavigateToStep);
  const compact = layoutVariant === "sheetCompact";
  const showPills = !compact;
  const viewingDiffersFromPipeline =
    typeof focusedStepIndex === "number" && focusedStepIndex !== phaseIndex && !completed;

  const cardClass = compact
    ? "border-border/70 bg-card shadow-none"
    : "border-primary/25 bg-gradient-to-br from-sky-50/80 to-background shadow-sm";

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <Card className={cardClass}>
        <CardHeader className={compact ? "space-y-1 pb-2 pt-4" : "pb-2"}>
          <CardTitle className={compact ? "text-sm font-semibold" : "text-base"}>
            {compact ? "Weiter im Ablauf" : "Geführter Ablauf"}
          </CardTitle>
          {!compact ? (
            <CardDescription>
              Schritt für Schritt — «Weiter» ist erst möglich, wenn alle Vorgaben für diesen Schritt erfüllt sind.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className={cn("flex flex-col", compact ? "gap-3 pb-4 pt-0" : "gap-4")}>
          {showPills ? (
            <ol className="flex flex-wrap gap-2">
              {steps.map((s, i) => {
                const done = completed || i < phaseIndex;
                const current = !completed && i === phaseIndex;
                const focused = focusedStepIndex === i;
                const chipClass = cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  done && "border-primary/40 bg-primary/10 text-primary",
                  current && "border-primary bg-primary/15 text-primary ring-2 ring-primary/20",
                  !done && !current && "border-border bg-muted/40 text-muted-foreground",
                  sheetMode && focused && "ring-2 ring-sky-400/50",
                );

                return (
                  <li key={s.id}>
                    {sheetMode ? (
                      <button type="button" onClick={() => onNavigateToStep!(s.id)} className={chipClass}>
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums",
                            done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                        </span>
                        <span className="max-w-[8.5rem] truncate sm:max-w-[10rem]">{s.label}</span>
                      </button>
                    ) : (
                      <Link href={`#${s.id}`} className={chipClass}>
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums",
                            done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                        </span>
                        <span className="max-w-[8.5rem] truncate sm:max-w-[10rem]">{s.label}</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : null}

          {completed ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Alle Schritte abgeschlossen — Projekt ist geschlossen.
            </p>
          ) : (
            <>
              <div
                className={cn(
                  "rounded-lg px-3 py-2",
                  compact ? "border border-border/60 bg-muted/20" : "border border-dashed border-primary/30 bg-primary/5",
                )}
              >
                {compact ? (
                  <p className="text-xs text-muted-foreground">Ablauf-Stand im System</p>
                ) : (
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Aktuell · Schritt {phaseIndex + 1} von {totalSteps}
                  </p>
                )}
                <p className={cn("font-semibold text-foreground", compact ? "mt-0.5 text-sm" : "mt-1 text-sm")}>{currentStepLabel}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{currentStepHint}</p>
              </div>

              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Für Ihre Rolle ist hier kein weiterer Statuswechsel vorgesehen. Bitte Büro oder Admin informieren.
                </p>
              ) : onAfterStatusTransition ? (
                <GuidedStatusTransitionForms
                  projectId={projectId}
                  options={options}
                  onAfterStatusTransition={onAfterStatusTransition}
                  compact={compact}
                />
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nächster Schritt im System</p>
                  {options.map((opt) => {
                    const issues = [...opt.missingFieldLabels, ...opt.prerequisiteMessages];
                    return (
                      <form
                        key={opt.to}
                        action={transitionProjectAction}
                        className={cn(
                          "rounded-xl border p-4",
                          opt.isPrimary && "border-primary/35 bg-primary/[0.04] shadow-sm",
                          !opt.isPrimary && "border-border/80 bg-card",
                        )}
                      >
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="targetStatus" value={opt.to} />
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-semibold leading-snug text-foreground">
                              {opt.label}
                              {opt.isPrimary ? (
                                <span className="ml-2 text-sm font-normal text-muted-foreground">(empfohlen)</span>
                              ) : null}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Nächster Schritt bei:{" "}
                              <span className="font-medium text-foreground">{formatNextOwnerLabel(opt.nextOwnerRole)}</span>
                            </p>
                          </div>
                          <Button type="submit" size="default" className="shrink-0" disabled={!opt.canSubmit}>
                            Weiter
                          </Button>
                        </div>
                        {!opt.canSubmit && issues.length > 0 ? (
                          <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2">
                            <p className="text-xs font-semibold text-destructive">Noch offen</p>
                            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-destructive">
                              {opt.missingFieldLabels.map((m) => (
                                <li key={m}>{m}</li>
                              ))}
                              {opt.prerequisiteMessages.map((m) => (
                                <li key={m}>{m}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </form>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
