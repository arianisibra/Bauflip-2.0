"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Check, MoreHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { transitionProjectAction } from "@/app/(app)/actions";
import { getPrimaryPreviousStatus } from "@/lib/workflow/project-guided-flow";
import { getAllowedTransitions, statusLabels } from "@/lib/workflow/project-workflow";
import { getWorkflowPhaseIndex, PROJECT_WORKFLOW_STEPS } from "@/lib/workflow/project-workflow-rail";
import type { ProjectStatus, RoleType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const bexioAppUrl = process.env.NEXT_PUBLIC_BEXIO_APP_URL ?? "https://office.bexio.com";

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
  currentStatusLabel?: string;
  /** Für kompakte Leiste: Status im System (links / mitte / rechts). */
  projectStatus?: ProjectStatus;
  /** Rolle, die den aktuellen Schritt fahren soll (`project.nextOwnerRole`). */
  projectNextOwnerRole?: RoleType;
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
  /** Rolle für «Zurück» / erlaubte Übergänge (kompakte Leiste). */
  userRole?: RoleType;
  /** Statuswechsel im Sheet erlaubt (z. B. Büro/Admin). */
  canEditWorkflowTransitions?: boolean;
};

function BexioManualActions() {
  return (
    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.03] px-3 py-2">
      <p className="text-xs font-semibold text-primary">Offerte / Rechnung manuell in bexio erstellen</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Öffnet bexio, damit du Angebot oder Rechnung manuell anlegen kannst. Die benötigten Daten findest du im
        Projekt-Sheet (Kunde, Adresse, Positionen).
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href={bexioAppUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ size: "xs", variant: "outline" })}
        >
          bexio öffnen
        </Link>
      </div>
    </div>
  );
}

function GuidedStatusTransitionForms({
  projectId,
  options,
  onAfterStatusTransition,
}: {
  projectId: string;
  options: GuidedOptionDisplay[];
  onAfterStatusTransition?: () => void | Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const blockIssues = (opt: GuidedOptionDisplay) => [...opt.missingFieldLabels, ...opt.prerequisiteMessages];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nächster Schritt im System</p>
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
                  const msg = err instanceof Error ? err.message : "Statuswechsel fehlgeschlagen.";
                  setError(msg);
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
                  Zuständig nach dem Wechsel:{" "}
                  <span className="font-medium text-foreground">{formatNextOwnerLabel(opt.nextOwnerRole)}</span>
                </p>
              </div>
              <Button type="submit" size="default" className="shrink-0 max-w-[min(100%,14rem)] text-balance" disabled={!opt.canSubmit || pending}>
                Zu «{opt.label}» wechseln
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
      <BexioManualActions />
    </div>
  );
}

function SheetCompactStrip({
  projectId,
  projectStatus,
  currentStepLabel,
  currentStatusLabel,
  projectNextOwnerRole,
  options,
  onAfterStatusTransition,
  userRole,
  canEditWorkflowTransitions,
}: {
  projectId: string;
  projectStatus: ProjectStatus;
  currentStepLabel: string;
  currentStatusLabel?: string;
  projectNextOwnerRole?: RoleType;
  options: GuidedOptionDisplay[];
  onAfterStatusTransition?: () => void | Promise<void>;
  userRole?: RoleType;
  canEditWorkflowTransitions?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const prev = getPrimaryPreviousStatus(projectStatus);
  const primaryOpt = options.find((o) => o.isPrimary) ?? options[0] ?? null;
  const rest = primaryOpt ? options.filter((o) => o.to !== primaryOpt.to) : [];

  const currentPhaseIdx = getWorkflowPhaseIndex(projectStatus);
  const prevPhaseIdx = prev ? getWorkflowPhaseIndex(prev) : -1;
  const nextPhaseIdx = primaryOpt ? getWorkflowPhaseIndex(primaryOpt.to as ProjectStatus) : -1;

  const prevPhaseLabel = prevPhaseIdx >= 0 ? (PROJECT_WORKFLOW_STEPS[prevPhaseIdx]?.label ?? null) : null;
  const nextPhaseLabel = nextPhaseIdx >= 0 ? (PROJECT_WORKFLOW_STEPS[nextPhaseIdx]?.label ?? primaryOpt?.label ?? null) : null;
  const samePhaseAsNext =
    primaryOpt != null && currentPhaseIdx >= 0 && nextPhaseIdx >= 0 && currentPhaseIdx === nextPhaseIdx;
  /** Innerhalb einer Phase mehrere Systemstatus: rechts den Ziel-Status zeigen, nicht erneut die Phasenüberschrift. */
  const nextStripLabel =
    primaryOpt && nextPhaseLabel
      ? samePhaseAsNext
        ? primaryOpt.label
        : nextPhaseLabel
      : null;

  const backTarget = prev;
  const backRule = backTarget ? getAllowedTransitions(projectStatus).find((r) => r.to === backTarget) : undefined;
  const canGoBack =
    Boolean(
      backTarget &&
        backRule &&
        userRole &&
        backRule.allowedRoles.includes(userRole) &&
        canEditWorkflowTransitions,
    );

  const blockIssues = (opt: GuidedOptionDisplay) => [...opt.missingFieldLabels, ...opt.prerequisiteMessages];

  const technicianLockedHere =
    userRole === "technician" && projectNextOwnerRole && projectNextOwnerRole !== "technician";

  function submitForm(fd: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await transitionProjectAction(fd);
        await onAfterStatusTransition?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Statuswechsel fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div
        className="grid grid-cols-3 divide-x divide-border/70 overflow-hidden rounded-xl border border-border/70 shadow-sm"
        aria-label="Status im Ablauf"
      >
        {/* Linke Spalte: Vorherige Phase */}
        <div className="flex flex-col items-center gap-2 px-2 py-3 text-center bg-muted/20">
          <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground/70">Erledigt</p>
          {prevPhaseLabel ? (
            <>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary shadow-sm">
                <Check className="size-3.5 text-primary-foreground" strokeWidth={3} />
              </span>
              <p className="line-clamp-3 text-xs leading-snug text-muted-foreground">{prevPhaseLabel}</p>
            </>
          ) : (
            <span className="mt-1 text-sm text-muted-foreground/50">—</span>
          )}
        </div>

        {/* Mittlere Spalte: Aktuelle Phase */}
        <div className="flex flex-col items-center gap-2 bg-primary/5 px-2 py-3 text-center ring-inset ring-1 ring-primary/15">
          <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-primary">Aktuell</p>
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary text-[0.65rem] font-bold tabular-nums text-primary-foreground shadow-sm"
            aria-current="step"
          >
            {currentPhaseIdx + 1}
          </span>
          <p className="line-clamp-3 text-xs font-semibold leading-snug text-foreground">{currentStepLabel}</p>
          {currentStatusLabel ? (
            <p className="line-clamp-2 text-[0.65rem] leading-snug text-muted-foreground">
              Status: <span className="font-medium text-foreground">{currentStatusLabel}</span>
            </p>
          ) : null}
          {projectNextOwnerRole ? (
            <p className="line-clamp-2 text-[0.65rem] leading-snug text-muted-foreground">
              Zuständig:{" "}
              <span className="font-medium text-foreground">{formatNextOwnerLabel(projectNextOwnerRole)}</span>
            </p>
          ) : null}
          {canGoBack && backTarget ? (
            <form
              className="mt-1"
              onSubmit={(e) => {
                e.preventDefault();
                submitForm(new FormData(e.currentTarget));
              }}
            >
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="targetStatus" value={backTarget} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="min-w-[5rem]"
                disabled={pending}
                title={backTarget ? `Zu «${statusLabels[backTarget]}»` : undefined}
              >
                Zurück
              </Button>
            </form>
          ) : null}
        </div>

        {/* Rechte Spalte: Nächste Phase + Weiter */}
        <div className="flex flex-col items-center gap-2 bg-background px-2 py-3 text-center">
          <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground/70">Nächster</p>
          {primaryOpt && nextStripLabel ? (
            <>
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary text-[0.65rem] font-bold tabular-nums text-primary-foreground shadow-sm"
                title={samePhaseAsNext ? "Nächster Schritt in derselben Phase" : undefined}
              >
                {samePhaseAsNext ? (
                  <ArrowRight className="size-3.5 stroke-[2.5] text-primary-foreground" aria-hidden />
                ) : (
                  nextPhaseIdx + 1
                )}
              </span>
              {samePhaseAsNext ? (
                <p className="text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">Nächster Status</p>
              ) : null}
              <p className="line-clamp-3 text-xs leading-snug text-foreground">{nextStripLabel}</p>
              <form
                className="mt-0.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitForm(new FormData(e.currentTarget));
                }}
              >
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="targetStatus" value={primaryOpt.to} />
                <Button
                  type="submit"
                  size="sm"
                  className="min-w-[5rem]"
                  disabled={!primaryOpt.canSubmit || pending}
                >
                  Weiter
                </Button>
              </form>
            </>
          ) : (
            <span className="mt-1 text-sm text-muted-foreground/50">—</span>
          )}
        </div>
      </div>

      {technicianLockedHere ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          In diesem Schritt ist das Büro bzw. der Admin zuständig. Als Monteur kannst du den Status hier nicht ändern.
          Wenn etwas nicht passt, bitte kurz im Büro melden.
        </p>
      ) : null}

      <BexioManualActions />

      {primaryOpt && !primaryOpt.canSubmit && blockIssues(primaryOpt).length > 0 ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <p className="mb-1 font-semibold">Noch offen:</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {primaryOpt.missingFieldLabels.map((m) => (
              <li key={m}>{m}</li>
            ))}
            {primaryOpt.prerequisiteMessages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {rest.length > 0 ? (
        <details className="rounded-md border border-border/60 bg-muted/20 text-sm">
          <summary
            className="flex cursor-pointer list-none items-center justify-center gap-1.5 px-2 py-2 text-xs text-muted-foreground outline-none select-none marker:hidden [&::-webkit-details-marker]:hidden"
            aria-label="Weitere Statuswechsel"
          >
            <MoreHorizontal className="size-3.5" aria-hidden />
            Alternativ weitersetzen
          </summary>
          <div className="flex flex-col gap-1.5 px-2 pb-2">
            {rest.map((opt) => {
              const issues = blockIssues(opt);
              const optPhaseIdx = getWorkflowPhaseIndex(opt.to as ProjectStatus);
              const optSamePhase = getWorkflowPhaseIndex(projectStatus) === optPhaseIdx;
              const optPhaseLabel = optSamePhase
                ? opt.label
                : (PROJECT_WORKFLOW_STEPS[optPhaseIdx]?.label ?? opt.label);
              return (
                <form
                  key={opt.to}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitForm(new FormData(e.currentTarget));
                  }}
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="targetStatus" value={opt.to} />
                  <span className="min-w-0 flex-1 text-xs font-medium">{optPhaseLabel}</span>
                  <Button type="submit" size="sm" variant="outline" className="shrink-0" disabled={!opt.canSubmit || pending}>
                    Weiter
                  </Button>
                  {!opt.canSubmit && issues.length > 0 ? (
                    <ul className="basis-full list-disc space-y-0.5 pl-4 text-xs text-destructive">
                      {issues.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  ) : null}
                </form>
              );
            })}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function ProjectGuidedProcess({
  projectId,
  phaseIndex,
  totalSteps,
  currentStepLabel,
  currentStepHint,
  currentStatusLabel,
  projectStatus,
  projectNextOwnerRole,
  stepAnchorId,
  completed,
  steps,
  options,
  layoutVariant = "full",
  onNavigateToStep,
  focusedStepIndex,
  onAfterStatusTransition,
  userRole,
  canEditWorkflowTransitions,
}: ProjectGuidedProcessProps) {
  const sheetMode = Boolean(onNavigateToStep);
  const compact = layoutVariant === "sheetCompact";
  const showPills = !compact;

  const cardClass = compact
    ? "border-border/70 bg-card shadow-sm"
    : "border-primary/25 bg-gradient-to-br from-sky-50/80 to-background shadow-sm";

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <Card className={cardClass}>
        <CardHeader className={compact ? "sr-only" : "pb-2"}>
          <CardTitle className={compact ? "text-base" : "text-base"}>
            {compact ? "Ablauf" : "Geführter Ablauf"}
          </CardTitle>
          {!compact ? (
            <CardDescription>
              Schritt für Schritt — der Button beschreibt den nächsten Status im System und ist erst aktiv, wenn alles
              erfüllt ist.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className={cn("flex flex-col", compact ? "gap-2 pb-3 pt-2" : "gap-4")}>
          {showPills ? (
            <ol className="flex flex-wrap gap-2">
              {steps.map((s, i) => {
                const done = completed || i < phaseIndex;
                const current = !completed && i === phaseIndex;
                const focused = focusedStepIndex === i;
                const chipClass = cn(
                  "flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors",
                  current && "ring-2 ring-primary/25",
                  sheetMode && focused && "ring-2 ring-sky-400/50",
                );

                return (
                  <li key={s.id}>
                    {sheetMode ? (
                      <button type="button" onClick={() => onNavigateToStep!(s.id)} className={chipClass}>
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary text-[10px] font-bold tabular-nums text-primary-foreground shadow-sm">
                          {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                        </span>
                        <span className="max-w-[8.5rem] truncate sm:max-w-[10rem]">{s.label}</span>
                      </button>
                    ) : (
                      <Link href={`#${s.id}`} className={chipClass}>
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary text-[10px] font-bold tabular-nums text-primary-foreground shadow-sm">
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
          ) : compact && projectStatus ? (
            <SheetCompactStrip
              projectId={projectId}
              projectStatus={projectStatus}
              currentStepLabel={currentStepLabel}
              currentStatusLabel={currentStatusLabel}
              projectNextOwnerRole={projectNextOwnerRole}
              options={options}
              onAfterStatusTransition={onAfterStatusTransition}
              userRole={userRole}
              canEditWorkflowTransitions={canEditWorkflowTransitions}
            />
          ) : (
            <>
              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Aktuell · Schritt {phaseIndex + 1} von {totalSteps}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{currentStepLabel}</p>
                {currentStatusLabel ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Status: <span className="font-medium text-foreground">{currentStatusLabel}</span>
                  </p>
                ) : null}
                <p className="mt-0.5 text-xs text-muted-foreground">{currentStepHint}</p>
              </div>

              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {userRole === "technician" && projectNextOwnerRole && projectNextOwnerRole !== "technician"
                    ? "In diesem Schritt ist das Büro bzw. der Admin zuständig. Als Monteur kannst du den Status hier nicht ändern. Wenn etwas nicht passt, bitte kurz im Büro melden."
                    : "Für Ihre Rolle ist hier kein weiterer Statuswechsel vorgesehen. Bitte Büro oder Admin informieren."}
                </p>
              ) : onAfterStatusTransition ? (
                <GuidedStatusTransitionForms
                  projectId={projectId}
                  options={options}
                  onAfterStatusTransition={onAfterStatusTransition}
                />
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status im System weitersetzen
                  </p>
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
                              Zuständig nach dem Wechsel:{" "}
                              <span className="font-medium text-foreground">{formatNextOwnerLabel(opt.nextOwnerRole)}</span>
                            </p>
                          </div>
                          <Button type="submit" size="default" className="shrink-0 max-w-[min(100%,14rem)] text-balance" disabled={!opt.canSubmit}>
                            Zu «{opt.label}» wechseln
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
