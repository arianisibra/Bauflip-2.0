import type { Project, ProjectStatus, RoleType } from "@/lib/domain/types";

export type ProjectRequiredField =
  | "intakeOriginalText"
  | "accessNotes"
  | "internalNotes";

type RequiredField = ProjectRequiredField;

type TransitionRule = {
  to: ProjectStatus;
  allowedRoles: RoleType[];
  requiredFields: RequiredField[];
  nextOwnerRole: RoleType;
};

export const statusLabels: Record<ProjectStatus, string> = {
  anfrage: "Anfrage",
  termin_geplant: "Termin geplant",
  besichtigung: "Besichtigung",
  bericht_ausstehend: "Bericht ausstehend",
  bericht_fertig: "Bericht fertig",
  offerte_in_arbeit: "Offerte in Arbeit",
  offerte_gesendet: "Offerte gesendet",
  genehmigt: "Genehmigt",
  bestellung: "Bestellung",
  bestellt: "Bestellt",
  ware_eingetroffen: "Ware eingetroffen",
  ausfuehrung_geplant: "Ausfuehrung geplant",
  ausfuehrung_erledigt: "Ausfuehrung erledigt",
  rechnung: "Rechnung",
  abgeschlossen: "Abgeschlossen",
};

const transitions: Record<ProjectStatus, TransitionRule[]> = {
  anfrage: [
    {
      to: "termin_geplant",
      allowedRoles: ["office", "admin"],
      requiredFields: [],
      nextOwnerRole: "admin",
    },
  ],
  termin_geplant: [
    {
      to: "besichtigung",
      allowedRoles: ["technician", "office", "admin"],
      requiredFields: [],
      nextOwnerRole: "technician",
    },
    {
      to: "anfrage",
      allowedRoles: ["office", "admin"],
      requiredFields: [],
      nextOwnerRole: "admin",
    },
  ],
  besichtigung: [
    {
      to: "ausfuehrung_erledigt",
      allowedRoles: ["technician", "office", "admin"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "technician",
    },
    {
      to: "bericht_ausstehend",
      allowedRoles: ["technician", "office", "admin"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "technician",
    },
    {
      to: "termin_geplant",
      allowedRoles: ["technician", "office", "admin"],
      requiredFields: [],
      nextOwnerRole: "admin",
    },
  ],
  bericht_ausstehend: [
    {
      to: "bericht_fertig",
      allowedRoles: ["technician", "office", "admin"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "office",
    },
  ],
  bericht_fertig: [
    {
      to: "offerte_in_arbeit",
      allowedRoles: ["office", "admin"],
      requiredFields: ["intakeOriginalText", "internalNotes"],
      nextOwnerRole: "office",
    },
    {
      to: "bericht_ausstehend",
      allowedRoles: ["office", "admin"],
      requiredFields: [],
      nextOwnerRole: "technician",
    },
  ],
  offerte_in_arbeit: [
    {
      to: "offerte_gesendet",
      allowedRoles: ["office", "admin"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "office",
    },
    {
      to: "bericht_fertig",
      allowedRoles: ["office", "admin"],
      requiredFields: [],
      nextOwnerRole: "office",
    },
  ],
  offerte_gesendet: [
    {
      to: "genehmigt",
      allowedRoles: ["office", "admin"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "admin",
    },
  ],
  genehmigt: [
    {
      to: "bestellung",
      allowedRoles: ["admin", "office"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "admin",
    },
    {
      to: "offerte_gesendet",
      allowedRoles: ["admin", "office"],
      requiredFields: [],
      nextOwnerRole: "office",
    },
  ],
  bestellung: [
    {
      to: "bestellt",
      allowedRoles: ["admin", "office"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "admin",
    },
  ],
  bestellt: [
    {
      to: "ware_eingetroffen",
      allowedRoles: ["office", "admin"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "office",
    },
    {
      to: "bestellung",
      allowedRoles: ["office", "admin"],
      requiredFields: [],
      nextOwnerRole: "admin",
    },
  ],
  ware_eingetroffen: [
    {
      to: "ausfuehrung_geplant",
      allowedRoles: ["office", "admin"],
      requiredFields: ["accessNotes"],
      nextOwnerRole: "technician",
    },
  ],
  ausfuehrung_geplant: [
    {
      to: "ausfuehrung_erledigt",
      allowedRoles: ["technician", "office", "admin"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "technician",
    },
    {
      to: "ware_eingetroffen",
      allowedRoles: ["office", "admin"],
      requiredFields: [],
      nextOwnerRole: "office",
    },
  ],
  ausfuehrung_erledigt: [
    {
      to: "rechnung",
      allowedRoles: ["office", "admin"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "admin",
    },
  ],
  rechnung: [
    {
      to: "abgeschlossen",
      allowedRoles: ["admin", "office"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "admin",
    },
    {
      to: "ausfuehrung_erledigt",
      allowedRoles: ["admin", "office"],
      requiredFields: [],
      nextOwnerRole: "technician",
    },
  ],
  abgeschlossen: [
    {
      to: "rechnung",
      allowedRoles: ["admin", "office"],
      requiredFields: [],
      nextOwnerRole: "admin",
    },
  ],
};

function hasValue(value: string | null): boolean {
  return Boolean(value && value.trim());
}

export function getAllowedTransitions(status: ProjectStatus): TransitionRule[] {
  return transitions[status] ?? [];
}

/** Deutsche Bezeichnungen für Pflichtfelder (Anzeige im geführten Prozess). */
export const requiredFieldLabelsDe: Record<ProjectRequiredField, string> = {
  intakeOriginalText: "Originalaussage Kunde",
  accessNotes: "Zugang/Schlüssel",
  internalNotes: "Interne Notiz",
};

export function getMissingFieldsForTransition(
  project: Project,
  targetStatus: ProjectStatus,
): RequiredField[] {
  const rule = getAllowedTransitions(project.status).find((item) => item.to === targetStatus);
  if (!rule) {
    return [];
  }

  return rule.requiredFields.filter((field) => !hasValue(project[field]));
}

export function getMissingFieldLabelsForTransition(
  project: Project,
  targetStatus: ProjectStatus,
): string[] {
  return getMissingFieldsForTransition(project, targetStatus).map((f) => requiredFieldLabelsDe[f]);
}

export function assertCanTransition(
  project: Project,
  targetStatus: ProjectStatus,
  role: RoleType,
): { ok: true; nextOwnerRole: RoleType } | { ok: false; reason: string } {
  const rule = getAllowedTransitions(project.status).find((item) => item.to === targetStatus);
  if (!rule) {
    return { ok: false, reason: "Dieser Statuswechsel ist nicht erlaubt." };
  }

  if (!rule.allowedRoles.includes(role)) {
    return { ok: false, reason: "Ihre Rolle darf diesen Statuswechsel nicht ausfuehren." };
  }

  const missingFields = getMissingFieldsForTransition(project, targetStatus);
  if (missingFields.length > 0) {
    return {
      ok: false,
      reason: `Pflichtangaben fehlen: ${missingFields.join(", ")}`,
    };
  }

  return { ok: true, nextOwnerRole: rule.nextOwnerRole };
}
