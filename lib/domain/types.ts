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

export const appPageKeys = [
  "uebersicht",
  "projekte",
  "kunden",
  "kontakte",
  "termine",
  "artikel",
  "rapporte",
  "team_chat",
  "zeiterfassung",
  "bestellformular",
  "einstellungen",
  "integrationen",
  "import_export",
] as const;
export type AppPageKey = (typeof appPageKeys)[number];

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

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  role: RoleType;
  avatarUrl: string | null;
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

export type SidebarItem = {
  key: AppPageKey;
  label: string;
  href: string;
  section: "navigation" | "einsatz" | "system";
};

export type ModuleLabel = {
  key: string;
  label: string;
};

export type KanbanColumn = {
  id: string;
  projectId: string;
  title: string;
  color: "slate" | "blue" | "green" | "orange" | "violet";
  sortOrder: number;
  status: ProjectStatus;
};

export type KanbanCard = {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  sortOrder: number;
  status: ProjectStatus;
  assignedTechnicianIds: string[];
  dueDate: string | null;
};

export type ProjectChatMessage = {
  id: string;
  projectId: string;
  appointmentId: string | null;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
};

export type ProjectChatAttachment = {
  id: string;
  messageId: string;
  projectId: string;
  fileName: string;
  fileType: string;
  filePath: string;
  uploadedAt: string;
};

export type CalendarEvent = {
  id: string;
  projectId: string;
  appointmentId: string;
  technicianId: string;
  technicianEmail: string;
  provider: "google" | "microsoft" | "ics";
  providerEventId: string | null;
  startsAt: string;
  endsAt: string;
  title: string;
  createdAt: string;
};

export type Article = {
  id: string;
  name: string;
  sku: string;
  category: string;
  supplierId: string | null;
  inStock: number;
  createdAt: string;
};

export type EmployeeStat = {
  profileId: string;
  profileName: string;
  offeneProjekte: number;
  abgeschlosseneHeute: number;
  offeneRapporte: number;
  stundenDieseWoche: number;
};

export type AuditEvent = {
  id: string;
  action: string;
  projectId: string | null;
  actorRole: RoleType;
  actorName: string;
  payload: string;
  createdAt: string;
};

export type MailProviderConfig = {
  id: string;
  providerName: "google" | "outlook" | "custom";
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  signature: string;
};

export type MailDispatchLog = {
  id: string;
  projectId: string | null;
  to: string;
  subject: string;
  status: "gesendet" | "fehler";
  errorMessage: string | null;
  sentAt: string;
};

export type SupplierOrderTemplate = {
  id: string;
  supplierId: string;
  supplierName: string;
  name: string;
  requiredFields: string[];
};

export type SupplierOrderSubmission = {
  id: string;
  projectId: string;
  templateId: string;
  valuesJson: string;
  status: "entwurf" | "eingereicht";
  createdAt: string;
};

export type StockDecision = {
  id: string;
  projectId: string;
  decision: "ab_lager" | "bestellen";
  notes: string;
  decidedByRole: RoleType;
  createdAt: string;
};
