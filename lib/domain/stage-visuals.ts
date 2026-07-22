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
