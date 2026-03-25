import type { Project, ProjectStatus, RoleType } from "@/lib/domain/types";
import {
  getAllowedTransitions,
  getMissingFieldLabelsForTransition,
  statusLabels,
} from "@/lib/workflow/project-workflow";
import { getWorkflowPhaseIndex, PROJECT_WORKFLOW_STEPS } from "@/lib/workflow/project-workflow-rail";

/** Bevorzugter nächster Status entlang des Hauptpfads (ein «Weiter» pro Schritt). */
export function getPrimaryNextStatus(status: ProjectStatus): ProjectStatus | null {
  const map: Partial<Record<ProjectStatus, ProjectStatus>> = {
    anfrage: "termin_geplant",
    termin_geplant: "besichtigung",
    besichtigung: "bericht_ausstehend",
    bericht_ausstehend: "bericht_fertig",
    bericht_fertig: "offerte_in_arbeit",
    offerte_in_arbeit: "offerte_gesendet",
    offerte_gesendet: "genehmigt",
    genehmigt: "bestellung",
    bestellung: "bestellt",
    bestellt: "ware_eingetroffen",
    ware_eingetroffen: "ausfuehrung_geplant",
    ausfuehrung_geplant: "ausfuehrung_erledigt",
    ausfuehrung_erledigt: "rechnung",
    rechnung: "abgeschlossen",
  };
  return map[status] ?? null;
}

export type BundleGateCounts = {
  besichtigungAppointments: number;
  ausfuehrungAppointments: number;
};

/** Zusätzliche Bedingungen neben Stammdaten-Pflichtfeldern. */
export function getBundlePrerequisiteMessages(
  project: Project,
  targetStatus: ProjectStatus,
  bundle: BundleGateCounts,
): string[] {
  const msgs: string[] = [];
  if (project.status === "termin_geplant" && targetStatus === "besichtigung") {
    if (bundle.besichtigungAppointments < 1) {
      msgs.push("Mindestens einen Besichtigungstermin erfassen (Schritt «Ersttermin / Aufmass»).");
    }
  }
  if (project.status === "ausfuehrung_geplant" && targetStatus === "ausfuehrung_erledigt") {
    if (bundle.ausfuehrungAppointments < 1) {
      msgs.push("Mindestens einen Ausführungstermin erfassen (Schritt «Ausführungstermin»).");
    }
  }
  return msgs;
}

export type GuidedTransitionOption = {
  to: ProjectStatus;
  label: string;
  isPrimary: boolean;
  canSubmit: boolean;
  missingFieldLabels: string[];
  prerequisiteMessages: string[];
  nextOwnerRole: RoleType;
};

export function buildGuidedTransitionOptions(
  project: Project,
  role: RoleType,
  bundle: BundleGateCounts,
): GuidedTransitionOption[] {
  const primary = getPrimaryNextStatus(project.status);
  const rules = getAllowedTransitions(project.status);

  return rules
    .filter((r) => r.allowedRoles.includes(role))
    .map((r) => {
      const missingFieldLabels = getMissingFieldLabelsForTransition(project, r.to);
      const prerequisiteMessages = getBundlePrerequisiteMessages(project, r.to, bundle);
      const canSubmit = missingFieldLabels.length === 0 && prerequisiteMessages.length === 0;
      return {
        to: r.to,
        label: statusLabels[r.to],
        isPrimary: r.to === primary,
        canSubmit,
        missingFieldLabels,
        prerequisiteMessages,
        nextOwnerRole: r.nextOwnerRole,
      };
    })
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) {
        return a.isPrimary ? -1 : 1;
      }
      return a.label.localeCompare(b.label, "de");
    });
}

export function getGuidedStepMeta(project: Project) {
  const phaseIndex = getWorkflowPhaseIndex(project.status);
  const step = PROJECT_WORKFLOW_STEPS[phaseIndex];
  const completed = project.status === "abgeschlossen";
  return {
    phaseIndex,
    stepLabel: step?.label ?? "",
    stepHint: step?.hint ?? "",
    stepAnchor: step?.id ?? "eingang",
    completed,
    totalSteps: PROJECT_WORKFLOW_STEPS.length,
  };
}
