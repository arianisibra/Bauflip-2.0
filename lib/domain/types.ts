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

/** Anzeige im Header: Firmenname und optionales Logo (organisations.logo_url). */
export type OrganizationBranding = {
  name: string;
  logoUrl: string | null;
};

export const appPageKeys = [
  "uebersicht",
  "projekte",
  "kanban",
  "mitarbeiter",
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

export const contactPartyKinds = ["privat", "firma"] as const;
export type ContactPartyKind = (typeof contactPartyKinds)[number];

export const contactCategories = ["kunde", "lieferant", "partner", "sonstiges"] as const;
export type ContactCategory = (typeof contactCategories)[number];

/** Stammdaten Kontakt (früher «Kunde»): Kategorie über Dropdown getrennt. */
export type Contact = {
  id: string;
  organizationId: string | null;
  contactNumber: string | null;
  partyKind: ContactPartyKind;
  category: ContactCategory;
  name: string;
  uidNumber: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  website: string | null;
  managedObjectLabel: string | null;
  createdAt: string;
};

export type ContactPerson = {
  id: string;
  contactId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  roleTitle: string | null;
  createdAt: string;
};

export type ContactAddress = {
  id: string;
  contactId: string;
  label: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  isPrimary: boolean;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  role: RoleType;
  avatarUrl: string | null;
  /** Kalender / Termine: Hex z. B. #0ea5e9 */
  calendarColor: string | null;
  /** Reihenfolge in der Team-Legende (kleinere Zahl zuerst) */
  calendarPosition: number;
};

/** Gebäude / Standort, typischerweise Eigentümer oder Verwalter-Kontakt zugeordnet. */
export type SiteProperty = {
  id: string;
  organizationId: string | null;
  name: string;
  ownerContactId: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  mapsUrl: string | null;
  createdAt: string;
};

/** Erweiterbare Arbeitsarten (Bestandsaufnahme, Rapport, …) — getrennt von `Project.type`. */
export type ProjectWorkType = {
  id: string;
  organizationId: string | null;
  name: string;
  sortOrder: number;
  createdAt: string;
};

export type Project = {
  id: string;
  contactId: string;
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
  tenantUnit: string | null;
  sitePhone: string | null;
  siteMobile: string | null;
  referenceCode: string | null;
  technicianNotes: string | null;
  propertyId: string | null;
  mapsUrl: string | null;
  workTypeId: string | null;
  contactPersonId: string | null;
  serviceAddressId: string | null;
  billingAddressId: string | null;
  hintsAndNotes: string | null;
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

/** Projektzeile für Listen (Kontaktname aus Join). */
export type ProjectListRow = Project & {
  contactName: string | null;
};

/** Termin für Monatskalender (Angereichert). */
export type CalendarAppointmentItem = {
  id: string;
  projectId: string;
  projectTitle: string;
  kind: Appointment["kind"];
  startsAt: string;
  endsAt: string;
  calendarColor: string;
  technicianName: string | null;
};

/** Termin in der Kalenderwoche + Projekt-Kernfelder für die Übersichts-Leiste. */
export type WeekTaskItem = {
  appointmentId: string;
  startsAt: string;
  endsAt: string;
  kind: Appointment["kind"];
  projectId: string;
  projectTitle: string;
  projectStatus: ProjectStatus;
  urgency: Project["urgency"];
  assignedTechnicianId: string | null;
  technicianName: string | null;
  /** Aufgelöste Anzeigefarbe (Kante / Legende) */
  calendarColor: string;
};

/** Punkt für Umsatz-Liniendiagramm (genehmigte Offerten; Zuteilung nach Genehmigungs- bzw. Erfassungsdatum). */
export type RevenueSeriesPoint = {
  key: string;
  labelShort: string;
  amountChf: number;
};

export type ApprovedRevenueSeries = {
  points: RevenueSeriesPoint[];
  bucket: "day" | "month";
};

/** Aggregierte Betriebskennzahlen für die Übersicht (Storenbau / Montage). */
export type CompanyKpiSnapshot = {
  /** Summe aus genehmigten Offerten (Positionen × Preis), CHF */
  revenueApprovedChf: number;
  /** Planungs-Indikator ohne Einkaufskosten in der DB (Anteil vom Umsatz) */
  estimatedGrossContributionChf: number;
  contactsCount: number;
  activeProjectsCount: number;
  completedProjectsCount: number;
  openInvoicesCount: number;
  /** Genehmigt / (Genehmigt + Abgelehnt), nur wenn mindestens eine Entscheidung existiert */
  quoteWinRatePercent: number | null;
  quotesDecidedCount: number;
  appointmentsThisWeekCount: number;
  purchaseOrdersInTransit: number;
  supabaseConnected: boolean;
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
  pdfPath: string | null;
  pdfGeneratedAt: string | null;
  pdfVersion: number;
  finalizedAt: string | null;
  finalizedBy: string | null;
  warrantyText: string | null;
  validityDays: number | null;
  leadTimeText: string | null;
  downPaymentPercent: number | null;
  paymentTermsText: string | null;
  salutationText: string | null;
  textBlocks: string | null;
  currency: string;
  discountPercent: number;
  vatPercent: number;
  subtotalNet: number;
  discountAmount: number;
  totalNet: number;
  vatAmount: number;
  totalGross: number;
  deliveryChannel: "email" | "post" | null;
  deliverySentAt: string | null;
  deliveryRecipient: string | null;
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
  pdfPath: string | null;
  pdfGeneratedAt: string | null;
  pdfVersion: number;
  finalizedAt: string | null;
  finalizedBy: string | null;
  deliveryChannel: "email" | "post" | null;
  deliverySentAt: string | null;
  deliveryRecipient: string | null;
  createdAt: string;
};

export type Invoice = {
  id: string;
  projectId: string;
  invoiceNumber: string | null;
  status: "entwurf" | "gesendet" | "bezahlt";
  sentAt: string | null;
  pdfPath: string | null;
  pdfGeneratedAt: string | null;
  pdfVersion: number;
  finalizedAt: string | null;
  finalizedBy: string | null;
  deliveryChannel: "email" | "post" | null;
  deliverySentAt: string | null;
  deliveryRecipient: string | null;
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

export type ProjectAttachment = {
  id: string;
  projectId: string;
  fileName: string;
  fileType: string;
  filePath: string;
  sizeBytes: number | null;
  uploadedBy: string | null;
  createdAt: string;
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

export type ArticleCategoryTemplateScope = "storen" | "sonnenstoren" | "dl" | "generic";

/** Produktkategorie (Dropdown, erweiterbar). `template_scope` steuert Hinweise zu Textplatzhaltern. */
export type ArticleCategory = {
  id: string;
  name: string;
  sortOrder: number;
  templateScope: ArticleCategoryTemplateScope;
  createdAt: string;
};

export type Article = {
  id: string;
  name: string;
  /** Interne Artikelnummer */
  sku: string;
  categoryId: string;
  categoryName: string | null;
  categoryTemplateScope: ArticleCategoryTemplateScope;
  supplierId: string | null;
  purchasePrice: number | null;
  salePrice: number | null;
  /** Berechnungseinheit (z. B. Stk, m, m²) */
  unit: string;
  descriptionLong: string | null;
  descriptionShort: string | null;
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
  fieldDefinitions?: SupplierOrderFieldDefinition[];
};

export type SupplierEntity = {
  id: string;
  name: string;
};

export type SupplierOrderFieldType = "text" | "number" | "select" | "article";
export type SupplierFieldConditionOperator = "equals" | "not_equals";

export type SupplierFieldCondition = {
  fieldKey: string;
  operator: SupplierFieldConditionOperator;
  value: string;
};

export type SupplierOrderFieldDefinition = {
  key: string;
  label: string;
  type: SupplierOrderFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  showWhen?: SupplierFieldCondition[];
  requireWhen?: SupplierFieldCondition[];
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
