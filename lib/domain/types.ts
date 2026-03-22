export const projectTypes = ["reparatur", "ersatz", "neuinstallation"] as const;
export type ProjectType = (typeof projectTypes)[number];

export const projectStatuses = [
  "anfrage",
  "termin_geplant",
  "besichtigung",
  "bericht_ausstehend",
  "bericht_fertig",
  "offerte_in_arbeit",
  "offerte_gesendet",
  "genehmigt",
  "bestellung",
  "bestellt",
  "ware_eingetroffen",
  "ausfuehrung_geplant",
  "ausfuehrung_erledigt",
  "rechnung",
  "abgeschlossen",
] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const noteTypes = [
  "kunde",
  "intern",
  "planung",
  "techniker",
  "bestellung",
  "rechnung",
] as const;
export type NoteType = (typeof noteTypes)[number];

export const roleTypes = ["admin", "office", "technician"] as const;
export type RoleType = (typeof roleTypes)[number];

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  createdAt: string;
};

export type Project = {
  id: string;
  customerId: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
  nextOwnerRole: RoleType;
  nextOwnerUserId: string | null;
  source: "whatsapp" | "telefon" | "email";
  urgency: "normal" | "hoch" | "kritisch";
  intakeOriginalText: string;
  accessNotes: string | null;
  keyHandlingNotes: string | null;
  timingNotes: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};

export type ProjectNote = {
  id: string;
  projectId: string;
  type: NoteType;
  body: string;
  authorRole: RoleType;
  createdAt: string;
};

export type Appointment = {
  id: string;
  projectId: string;
  kind: "besichtigung" | "ausfuehrung";
  startsAt: string;
  endsAt: string;
  assignedTechnicianId: string | null;
  planningNotes: string | null;
  accessNotes: string | null;
  keyHandlingNotes: string | null;
  createdAt: string;
};

export type TechnicianReport = {
  id: string;
  projectId: string;
  outcome: "direkt_geloest" | "ersatzteil_noetig" | "werkstatt_noetig" | "vollersatz_noetig";
  summary: string;
  measurementsJson: string;
  workDescription: string;
  timeSpentMinutes: number | null;
  createdAt: string;
};

export type Quote = {
  id: string;
  projectId: string;
  version: number;
  status: "entwurf" | "gesendet" | "genehmigt" | "abgelehnt";
  sentAt: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type PurchaseOrder = {
  id: string;
  projectId: string;
  supplierId: string;
  status: "entwurf" | "gesendet" | "bestaetigt" | "geliefert";
  emailSentAt: string | null;
  createdAt: string;
};

export type Delivery = {
  id: string;
  projectId: string;
  purchaseOrderId: string | null;
  deliveryNoteNumber: string | null;
  arrivedAt: string;
  checkedByRole: RoleType;
  createdAt: string;
};

export type Invoice = {
  id: string;
  projectId: string;
  invoiceNumber: string | null;
  status: "entwurf" | "gesendet" | "bezahlt";
  sentAt: string | null;
  createdAt: string;
};
