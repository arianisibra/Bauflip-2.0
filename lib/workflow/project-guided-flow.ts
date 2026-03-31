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

/** Vorheriger Status auf dem gleichen Hauptpfad wie `getPrimaryNextStatus` (für kompakte Anzeige). */
export function getPrimaryPreviousStatus(status: ProjectStatus): ProjectStatus | null {
  const forward: Partial<Record<ProjectStatus, ProjectStatus>> = {
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
  for (const [from, to] of Object.entries(forward) as [ProjectStatus, ProjectStatus][]) {
    if (to === status) {
      return from;
    }
  }
  return null;
}

export type BundleGateCounts = {
  besichtigungAppointments: number;
  ausfuehrungAppointments: number;
  reports: number;
  directResolvedReports: number;
  quotes: number;
  quoteFinalized: number;
  /** Erfasste Lieferanten-Bestellformulare (Monteur), nicht die interne Bestell-Entität. */
  supplierSubmissions: number;
  orders: number;
  deliveries: number;
  invoices: number;
  invoiceFinalized: number;
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
    if (bundle.reports < 1) {
      msgs.push("Mindestens einen Rapport oder eine Fertigmeldung erfassen, bevor die Ausführung als erledigt gilt.");
    }
  }
  if (project.status === "besichtigung" && targetStatus === "ausfuehrung_erledigt") {
    if (bundle.directResolvedReports < 1) {
      msgs.push("«Ausführung erledigt» ist erst möglich, wenn ein Rapport mit Entscheid «Direkt gelöst» erfasst wurde.");
    }
  }
  if (project.status === "bericht_ausstehend" && targetStatus === "bericht_fertig") {
    if (bundle.reports < 1) {
      msgs.push("Mindestens einen Monteurbericht erfassen (Schritt «Rapport & Bestandsaufnahme»).");
    }
  }
  if (project.status === "bericht_fertig" && targetStatus === "offerte_in_arbeit") {
    if (bundle.reports < 1) {
      msgs.push("Rapport fehlt: zuerst Monteurbericht erfassen.");
    }
  }
  if (project.status === "offerte_in_arbeit" && targetStatus === "offerte_gesendet") {
    if (bundle.quotes < 1) {
      msgs.push("Mindestens eine Offerte erstellen.");
    }
    if (bundle.quoteFinalized < 1) {
      msgs.push("Offerte finalisieren (PDF), bevor sie als gesendet gilt.");
    }
  }
  if (project.status === "bestellung" && targetStatus === "bestellt") {
    if (bundle.supplierSubmissions < 1) {
      msgs.push("Mindestens ein Lieferanten-Bestellformular vom Monteur erfassen (Schritt «Bestellung»).");
    }
  }
  if (project.status === "ausfuehrung_erledigt" && targetStatus === "rechnung") {
    if (bundle.reports < 1) {
      msgs.push("Fertigmeldung/Rapport fehlt: zuerst Leistung dokumentieren.");
    }
  }
  if (project.status === "rechnung" && targetStatus === "abgeschlossen") {
    if (bundle.invoices < 1) {
      msgs.push("Mindestens eine Rechnung vorbereiten.");
    }
    if (bundle.invoiceFinalized < 1) {
      msgs.push("Rechnung finalisieren (PDF), bevor das Projekt abgeschlossen wird.");
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
  const primaryPrevious = getPrimaryPreviousStatus(project.status);
  const rules = getAllowedTransitions(project.status);

  return rules
    .filter((r) => (role === "admin" ? true : r.allowedRoles.includes(role)))
    .filter((r) => primaryPrevious == null || r.to !== primaryPrevious)
    .filter((r) => {
      if (project.status === "besichtigung" && r.to === "ausfuehrung_erledigt") {
        return bundle.directResolvedReports > 0;
      }
      return true;
    })
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
