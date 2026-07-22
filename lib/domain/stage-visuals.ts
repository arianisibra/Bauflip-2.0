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
