import type { OrderFormFieldDef } from "@/lib/order-forms/schema";

export const projectTypes = ["reparatur", "ersatz", "neuinstallation"] as const;
export type ProjectType = (typeof projectTypes)[number];

/** Vollständiger Auftrags-Lebenszyklus (analog Monday.com Workflow) */
export const projectStatuses = [
  "offen",
  "abgemacht",
  "termin_geplant",
  "einsatz_offen",
  "offerte_senden",
  "offerte_gesendet",
  "offerte_genehmigt",
  "bestellen",
  "bestellt",
  "montagebereit",
  "abholbereit",
  "werkstatt",
  "abklaeren",
  "abrechnen",
  "subunternehmer",
  "abgeschlossen",
] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export type NextProjectStatusAfterAppointmentContext = {
  /** Genau ein Termin für diesen Auftrag nach dem Speichern (erster Eintrag). */
  isFirstAppointmentForProject: boolean;
  /**
   * Termin ist noch nicht beendet (`endsAt >= jetzt`) — laufend oder zukünftig.
   * Nur dann wird auf „abgemacht“ / Montage-Sprung automatisiert.
   */
  appointmentIsUpcoming: boolean;
};

/** Termin-Slot noch nicht vorbei (heute/laufend oder später). */
export function appointmentEndsInFutureOrNow(endsAtIso: string): boolean {
  return new Date(endsAtIso).getTime() >= Date.now();
}

/**
 * Nach neu gebuchtem Termin: welcher Projektstatus gesetzt werden soll.
 * `null` = Status nicht anfassen.
 */
export function nextProjectStatusAfterAppointmentBooked(
  current: ProjectStatus,
  ctx: NextProjectStatusAfterAppointmentContext,
): ProjectStatus | null {
  if (!ctx.appointmentIsUpcoming) {
    return null;
  }
  if (current === "offen" && ctx.isFirstAppointmentForProject) return "abgemacht";
  if (current === "termin_geplant") return "abgemacht";
  if (current === "einsatz_offen") return "montagebereit";
  return null;
}

/** Status-Optionen nach Rapport "Aufgenommen" beim Erstbesuch (Bestandesaufnahme) */
export const RAPPORT_NEXT_STEPS_AUFGENOMMEN = [
  "offerte_senden",
  "bestellen",
  "montagebereit",
  "abholbereit",
] as const satisfies readonly ProjectStatus[];
export type RapportNextStepAufgenommen = (typeof RAPPORT_NEXT_STEPS_AUFGENOMMEN)[number];

/** Status-Optionen nach Rapport "Nicht fertig" beim Montage-/Folgebesuch */
export const RAPPORT_NEXT_STEPS_MONTAGE = [
  "einsatz_offen",   // Weiterer Termin nötig
  "montagebereit",   // Bereit für nächsten Montageeinsatz
  "abholbereit",     // Werkstatt nötig
] as const satisfies readonly ProjectStatus[];
export type RapportNextStepMontage = (typeof RAPPORT_NEXT_STEPS_MONTAGE)[number];

/** Alle möglichen nextStatus-Werte (union für Schema-Validierung) */
export const RAPPORT_ALL_NEXT_STEPS = [
  ...RAPPORT_NEXT_STEPS_AUFGENOMMEN,
  ...RAPPORT_NEXT_STEPS_MONTAGE,
] as const;
export type RapportNextStep = (typeof RAPPORT_ALL_NEXT_STEPS)[number];

/** Status nach Rapport "Behoben" / "Fertig" — immer Abrechnen */
export const RAPPORT_NEXT_STEP_BEHOBEN = "abrechnen" as const satisfies ProjectStatus;

export const roleTypes = ["admin", "office", "technician"] as const;
export type RoleType = (typeof roleTypes)[number];

/** Monteur-, Admin- und Büro-Zugang zu Einsatz-Routen unter (tech): /tag, /auftrag, … */
export function canAccessTechFieldRoutes(role: RoleType): boolean {
  return role === "technician" || role === "admin" || role === "office";
}

export type OrganizationBranding = {
  name: string;
  logoUrl: string | null;
};

export const appPageKeys = [
  "projekte",
  "kalender",
  "mitarbeiter",
  "bestellformulare",
  "einstellungen",
  "mein_tag",
  "monteur_profil",
] as const;
export type AppPageKey = (typeof appPageKeys)[number];

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  role: RoleType;
  avatarUrl: string | null;
  calendarColor: string | null;
  calendarPosition: number;
};

export type Project = {
  id: string;
  organizationId: string | null;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
  nextOwnerRole: RoleType;
  nextOwnerUserId: string | null;
  source: "whatsapp" | "telefon" | "email";
  intakeOriginalText: string;
  accessNotes: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  referenceCode: string | null;
  hintsAndNotes: string | null;
  tenantName: string | null;
  tenantPhone: string | null;
  tenantEmail: string | null;
  managementName: string | null;
  managementPhone: string | null;
  managementEmail: string | null;
  costCeilingText: string | null;
  serviceStreet: string | null;
  servicePostalCode: string | null;
  serviceCity: string | null;
  serviceCountry: string;
};

export type Appointment = {
  id: string;
  projectId: string;
  kind: "besichtigung" | "ausfuehrung";
  startsAt: string;
  endsAt: string;
  assignedTechnicianId: string | null;
  planningNotes: string | null;
  createdAt: string;
};

/** Nur Felder für die Büro-Liste; Stammdaten-Detail lädt das Sheet separat. */
export type OfficeProjectListItem = {
  id: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
  displayLabel: string | null;
  serviceAddressShort: string | null;
};

export type WeekTaskItem = {
  appointmentId: string;
  startsAt: string;
  endsAt: string;
  kind: Appointment["kind"];
  projectId: string;
  projectTitle: string;
  projectStatus: ProjectStatus;
  assignedTechnicianId: string | null;
  technicianName: string | null;
  calendarColor: string;
  /** Aus `projects`-Join; vermeidet N+1 `getProjectCore` auf /tag */
  tenantDisplay: string | null;
  serviceAddressShort: string | null;
};

export const technicianReportOutcomes = ["schaden_behoben", "schaden_aufgenommen"] as const;
export type TechnicianReportOutcome = (typeof technicianReportOutcomes)[number];

/** Admin-definierte Vorlage (CMS) für Bestell-/Rapport-Felder. */
export type OrderFormTemplate = {
  id: string;
  organizationId: string;
  /** Optional: Lieferant (Freitext), z. B. für CMS-Gruppierung. */
  supplierName: string | null;
  name: string;
  slug: string;
  description: string | null;
  fields: OrderFormFieldDef[];
  sortOrder: number;
  isActive: boolean;
};

/** Gespeicherte Bestellformular-Daten zu einem Rapport (Anzeige Büro). */
export type TechnicianReportOrderFormEntry = {
  templateId: string;
  templateName: string;
  fields: OrderFormFieldDef[];
  values: Record<string, string>;
};

export type TechnicianReport = {
  id: string;
  projectId: string;
  outcome: TechnicianReportOutcome;
  summary: string;
  measurementsJson: string;
  workDescription: string;
  timeSpentMinutes: number | null;
  createdAt: string;
  orderForms: TechnicianReportOrderFormEntry[];
};

export type ProjectAttachment = {
  id: string;
  projectId: string;
  fileName: string;
  fileType: string;
  filePath: string;
  sizeBytes: number | null;
  uploadedBy: string | null;
  notes: string | null;
  createdAt: string;
  signedUrl?: string;
};

export type SidebarItem = {
  key: AppPageKey;
  label: string;
  href: string;
  section: "navigation" | "einsatz" | "system";
};

export const projectStatusLabels: Record<ProjectStatus, string> = {
  offen: "OFFEN",
  abgemacht: "ABGEMACHT",
  termin_geplant: "TERMIN GEPLANT",
  einsatz_offen: "EINSATZ / RAPPORT",
  offerte_senden: "OFFERTE SENDEN",
  offerte_gesendet: "OFFERTE GESENDET",
  offerte_genehmigt: "OFFERTE GENEHMIGT",
  bestellen: "BESTELLEN",
  bestellt: "BESTELLT",
  montagebereit: "MONTAGEBEREIT",
  abholbereit: "ABHOLBEREIT",
  werkstatt: "WERKSTATT",
  abklaeren: "ABKLÄREN",
  abrechnen: "ABRECHNEN",
  subunternehmer: "SUBUNTERNEHMER",
  abgeschlossen: "ABGESCHLOSSEN",
};

/** Tailwind-Klassen pro Status — jeder Schritt eigene Farbe (Liste, Sheet, Monteur). */
export const projectStatusBadgeClassNames: Record<ProjectStatus, string> = {
  offen: "border-transparent bg-zinc-500/15 text-zinc-900 dark:bg-zinc-500/25 dark:text-zinc-100",
  abgemacht:
    "border-transparent bg-cyan-500/15 text-cyan-950 dark:bg-cyan-500/20 dark:text-cyan-100",
  termin_geplant:
    "border-transparent bg-sky-500/15 text-sky-950 dark:bg-sky-500/20 dark:text-sky-100",
  einsatz_offen:
    "border-transparent bg-blue-500/15 text-blue-950 dark:bg-blue-500/20 dark:text-blue-100",
  offerte_senden:
    "border-transparent bg-indigo-500/15 text-indigo-950 dark:bg-indigo-500/20 dark:text-indigo-100",
  offerte_gesendet:
    "border-transparent bg-violet-500/15 text-violet-950 dark:bg-violet-500/20 dark:text-violet-100",
  offerte_genehmigt:
    "border-transparent bg-purple-500/15 text-purple-950 dark:bg-purple-500/20 dark:text-purple-100",
  bestellen:
    "border-transparent bg-fuchsia-500/15 text-fuchsia-950 dark:bg-fuchsia-500/20 dark:text-fuchsia-100",
  bestellt:
    "border-transparent bg-pink-500/15 text-pink-950 dark:bg-pink-500/20 dark:text-pink-100",
  montagebereit:
    "border-transparent bg-emerald-500/15 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-100",
  abholbereit:
    "border-transparent bg-teal-500/15 text-teal-950 dark:bg-teal-500/20 dark:text-teal-100",
  werkstatt:
    "border-transparent bg-orange-500/15 text-orange-950 dark:bg-orange-500/20 dark:text-orange-100",
  abklaeren:
    "border-transparent bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100",
  abrechnen:
    "border-transparent bg-yellow-500/20 text-yellow-950 dark:bg-yellow-500/25 dark:text-yellow-50",
  subunternehmer:
    "border-transparent bg-stone-500/15 text-stone-900 dark:bg-stone-500/25 dark:text-stone-100",
  abgeschlossen:
    "border-transparent bg-green-600/15 text-green-900 dark:bg-green-600/25 dark:text-green-100",
};

export function projectStatusBadgeClassName(status: string): string {
  if (projectStatuses.includes(status as ProjectStatus)) {
    return projectStatusBadgeClassNames[status as ProjectStatus];
  }
  return "border-transparent bg-muted text-muted-foreground";
}
