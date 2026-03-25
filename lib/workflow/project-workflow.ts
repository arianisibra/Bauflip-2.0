import type { Project, ProjectStatus, RoleType } from "@/lib/domain/types";

export type ProjectRequiredField =
  | "intakeOriginalText"
  | "accessNotes"
  | "keyHandlingNotes"
  | "timingNotes"
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
      requiredFields: ["intakeOriginalText", "accessNotes", "keyHandlingNotes", "timingNotes"],
      nextOwnerRole: "technician",
    },
  ],
  termin_geplant: [
    {
      to: "besichtigung",
      allowedRoles: ["technician", "office", "admin"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "technician",
    },
  ],
  besichtigung: [
    {
      to: "ausfuehrung_erledigt",
      allowedRoles: ["technician"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "office",
    },
    {
      to: "bericht_ausstehend",
      allowedRoles: ["technician"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "technician",
    },
  ],
  bericht_ausstehend: [
    {
      to: "bericht_fertig",
      allowedRoles: ["technician", "office"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "office",
    },
  ],
  bericht_fertig: [
    {
      to: "offerte_in_arbeit",
      allowedRoles: ["office", "admin"],
      requiredFields: ["intakeOriginalText"],
      nextOwnerRole: "office",
    },
  ],
  offerte_in_arbeit: [
    {
      to: "offerte_gesendet",
      allowedRoles: ["office", "admin"],
      requiredFields: ["intakeOriginalText"],
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
  ],
  ware_eingetroffen: [
    {
      to: "ausfuehrung_geplant",
      allowedRoles: ["office", "admin"],
      requiredFields: ["timingNotes"],
      nextOwnerRole: "technician",
    },
  ],
  ausfuehrung_geplant: [
    {
      to: "ausfuehrung_erledigt",
      allowedRoles: ["technician", "office"],
      requiredFields: ["intakeOriginalText"],
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
  ],
  abgeschlossen: [],
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
  accessNotes: "Zugang / Hinweise",
  keyHandlingNotes: "Schlüssel / Zutritt",
  timingNotes: "Zeitfenster",
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
