import { CheckCircle2, Clock, ShoppingCart, Truck, ArrowRight, type LucideIcon } from "lucide-react";
import {
  projectStatusBadgeClassName,
  projectStatusBadgeClassNames,
  projectStatusLabels,
  type ProjectStatus,
} from "@/lib/domain/types";

type StageLike = { key: string; label: string; color: string };

/**
 * Farb-Key → Badge-CSS-Klassen. Tailwind braucht literale Klassen zur Buildzeit,
 * darum kann die DB nur einen Farb-Key liefern; die Klassen bleiben im Code.
 * Wiederverwendet exakt die bestehenden Storenbau-Klassen (0 visuelle Änderung).
 */
export const STAGE_COLOR_BADGE_CLASSES: Record<string, string> = {
  zinc: projectStatusBadgeClassNames.offen,
  amber: projectStatusBadgeClassNames.abklaeren,
  indigo: projectStatusBadgeClassNames.offerte_senden,
  violet: projectStatusBadgeClassNames.offerte_gesendet,
  purple: projectStatusBadgeClassNames.offerte_genehmigt,
  fuchsia: projectStatusBadgeClassNames.bestellen,
  pink: projectStatusBadgeClassNames.bestellt,
  orange: projectStatusBadgeClassNames.werkstatt,
  teal: projectStatusBadgeClassNames.abholbereit,
  emerald: projectStatusBadgeClassNames.montagebereit,
  blue: projectStatusBadgeClassNames.einsatz_offen,
  lime: projectStatusBadgeClassNames.abgemacht,
  stone: projectStatusBadgeClassNames.subunternehmer,
  yellow: projectStatusBadgeClassNames.abrechnen,
  green: projectStatusBadgeClassNames.abgeschlossen,
  rose: projectStatusBadgeClassNames.garantiefall,
};

/** Gültige Farb-Keys für die Stage-Bearbeitung (Auswahlliste + Zod-Validierung). */
export const STAGE_COLOR_KEYS = Object.keys(STAGE_COLOR_BADGE_CLASSES) as [string, ...string[]];

/** Label aus der Workflow-Config, sonst hartcodierter Fallback, sonst der Key. */
export function resolveStageLabel(stages: readonly StageLike[], key: string): string {
  const stage = stages.find((s) => s.key === key);
  if (stage) return stage.label;
  return projectStatusLabels[key as ProjectStatus] ?? key;
}

/** Badge-Klassen aus der Workflow-Config (via Farb-Key), sonst hartcodierter Fallback. */
export function resolveStageBadgeClass(stages: readonly StageLike[], key: string): string {
  const stage = stages.find((s) => s.key === key);
  if (stage) return STAGE_COLOR_BADGE_CLASSES[stage.color] ?? projectStatusBadgeClassName(key);
  return projectStatusBadgeClassName(key);
}

type TransitionLike = { fromKey: string; toKey: string; actionLabel: string; sortOrder: number };
type PipelineAction = { label: string; nextStatus: ProjectStatus };

/**
 * Pipeline-Knöpfe (Status → nächster Status) aus der Workflow-Config, sonst
 * hartcodierter Fallback (`fallback`, i.d.R. STATUS_PIPELINE[currentStatus]).
 * Zweistufig: ist überhaupt eine Config geladen (transitions nicht leer)?
 * Dann gilt „keine Treffer für diesen Status" als echtes Ende der Pipeline
 * (nicht als „Config fehlt") — nur eine komplett leere Config fällt zurück.
 */
export function resolveStagePipelineActions(
  transitions: readonly TransitionLike[],
  currentStatus: string,
  fallback: readonly PipelineAction[],
): PipelineAction[] {
  if (transitions.length === 0) return [...fallback];
  return transitions
    .filter((t) => t.fromKey === currentStatus)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({ label: t.actionLabel, nextStatus: t.toKey as ProjectStatus }));
}

/** Icon-Key (DB) → lucide-Komponente. Tailwind/React brauchen echte Komponenten, kein String-Icon-Name. */
export const RAPPORT_NEXT_STEP_ICON_COMPONENTS: Record<string, LucideIcon> = {
  shopping_cart: ShoppingCart,
  check_circle: CheckCircle2,
  truck: Truck,
  clock: Clock,
};

/** Gültige Icon-Keys für die Stage-Bearbeitung (Auswahlliste + Zod-Validierung). */
export const RAPPORT_NEXT_STEP_ICON_KEYS = Object.keys(RAPPORT_NEXT_STEP_ICON_COMPONENTS) as [
  string,
  ...string[],
];

const DEFAULT_NEXT_STEP_ICON: LucideIcon = ArrowRight;

/**
 * Ton-Klassen für die Rapport-Nächste-Schritte-Karten — bewusst eigene, hellere
 * Palette (nicht `STAGE_COLOR_BADGE_CLASSES`, das sind die scharfkantigen
 * Status-Stempel). Deckt alle Farb-Keys ab, die auch für Stages wählbar sind.
 */
export const NEXT_STEP_TONE_CLASSES: Record<string, string> = {
  zinc: "border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-200",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  indigo: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200",
  violet: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-200",
  purple: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-200",
  fuchsia: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-200",
  pink: "border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-200",
  orange: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-200",
  teal: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-200",
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-200",
  lime: "border-lime-500/40 bg-lime-500/10 text-lime-700 dark:text-lime-200",
  stone: "border-stone-500/40 bg-stone-500/10 text-stone-700 dark:text-stone-200",
  yellow: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-200",
  green: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-200",
  rose: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200",
};

type RapportStageLike = {
  key: string;
  label: string;
  color: string;
  sortOrder: number;
  rapportAufgenommen: boolean;
  rapportMontage: boolean;
  rapportNextStepDescription: string | null;
  rapportNextStepIcon: string | null;
};

export type RapportNextStepOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  description: string;
  icon: LucideIcon;
  toneClassName: string;
};

/**
 * Rapport-Nächste-Schritte-Optionen aus der Workflow-Config, sonst hartcodierter
 * Fallback. Filtert nach dem passenden Tag (`rapportAufgenommen`/`rapportMontage`)
 * — Storenbau hat exakt dieselben Stages doppelt markiert wie die bisherigen
 * zwei hartcodierten Options-Arrays, darum bei geseedeter Config identisches
 * Ergebnis in anderer Sprache möglich.
 */
export function resolveRapportNextStepOptions<TValue extends string>(
  stages: readonly RapportStageLike[],
  context: "aufgenommen" | "montage",
  fallback: readonly RapportNextStepOption<TValue>[],
): RapportNextStepOption<TValue>[] {
  if (stages.length === 0) return [...fallback];
  return stages
    .filter((s) => (context === "aufgenommen" ? s.rapportAufgenommen : s.rapportMontage))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      value: s.key as TValue,
      label: s.label,
      description: s.rapportNextStepDescription ?? s.label,
      icon: (s.rapportNextStepIcon && RAPPORT_NEXT_STEP_ICON_COMPONENTS[s.rapportNextStepIcon]) || DEFAULT_NEXT_STEP_ICON,
      toneClassName: NEXT_STEP_TONE_CLASSES[s.color] ?? NEXT_STEP_TONE_CLASSES.zinc,
    }));
}
