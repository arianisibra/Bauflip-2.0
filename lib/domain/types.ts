import type { OrderFormFieldDef } from "@/lib/order-forms/schema";

export const projectTypes = ["reparatur", "ersatz", "neuinstallation"] as const;
export type ProjectType = (typeof projectTypes)[number];

/** Minimaler Auftrags-Lebenszyklus */
export const projectStatuses = ["offen", "termin_geplant", "einsatz_offen", "abgeschlossen"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const roleTypes = ["admin", "office", "technician"] as const;
export type RoleType = (typeof roleTypes)[number];

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
  offen: "Offen",
  termin_geplant: "Termin geplant",
  einsatz_offen: "Einsatz / Rapport",
  abgeschlossen: "Abgeschlossen",
};
