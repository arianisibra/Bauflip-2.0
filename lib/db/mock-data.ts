import type {
  Appointment,
  Article,
  ArticleCategory,
  AuditEvent,
  CalendarEvent,
  Contact,
  ContactAddress,
  ContactPerson,
  ProjectWorkType,
  SiteProperty,
  Delivery,
  EmployeeStat,
  Invoice,
  KanbanCard,
  KanbanColumn,
  MailDispatchLog,
  MailProviderConfig,
  ModuleLabel,
  Project,
  ProjectAttachment,
  ProjectChatAttachment,
  ProjectChatMessage,
  ProjectNote,
  PurchaseOrder,
  Quote,
  StockDecision,
  SupplierOrderSubmission,
  SupplierOrderTemplate,
  TechnicianReport,
  UserProfile,
} from "@/lib/domain/types";

const now = new Date().toISOString();

export const mockContacts: Contact[] = [
  {
    id: "c-1",
    organizationId: null,
    contactNumber: "K-01",
    partyKind: "firma",
    category: "kunde",
    name: "Müller AG",
    uidNumber: null,
    email: "info@mueller-ag.ch",
    phone: "+41 44 555 10 10",
    mobile: null,
    street: "Bahnhofstrasse 8",
    postalCode: "8001",
    city: "Zürich",
    website: "https://mueller-ag.ch",
    managedObjectLabel: null,
    createdAt: now,
  },
];

export const mockContactPersons: ContactPerson[] = [
  {
    id: "cp-1",
    contactId: "c-1",
    firstName: "Anna",
    lastName: "Schmidt",
    email: "anna.schmidt@mueller-ag.ch",
    phone: "+41 44 555 10 20",
    mobile: null,
    roleTitle: "Einkauf",
    createdAt: now,
  },
];

export const mockContactAddresses: ContactAddress[] = [
  {
    id: "ca-1",
    contactId: "c-1",
    label: "Hauptsitz",
    street: "Bahnhofstrasse 8",
    postalCode: "8001",
    city: "Zürich",
    country: "CH",
    isPrimary: true,
    createdAt: now,
  },
  {
    id: "ca-2",
    contactId: "c-1",
    label: "Rechnung",
    street: "Postfach 100",
    postalCode: "8001",
    city: "Zürich",
    country: "CH",
    isPrimary: false,
    createdAt: now,
  },
];

export const mockSiteProperties: SiteProperty[] = [
  {
    id: "sp-1",
    organizationId: null,
    name: "MFH Bahnhofstrasse 8",
    ownerContactId: "c-1",
    street: "Bahnhofstrasse 8",
    postalCode: "8001",
    city: "Zürich",
    country: "CH",
    mapsUrl: null,
    createdAt: now,
  },
];

export const mockProjectWorkTypes: ProjectWorkType[] = [
  { id: "wt-1", organizationId: null, name: "Bestandsaufnahme", sortOrder: 10, createdAt: now },
  { id: "wt-2", organizationId: null, name: "Rapport", sortOrder: 20, createdAt: now },
  { id: "wt-3", organizationId: null, name: "Reparatur / Montage", sortOrder: 30, createdAt: now },
  { id: "wt-4", organizationId: null, name: "Wartung", sortOrder: 40, createdAt: now },
];

export const mockProfiles: UserProfile[] = [
  {
    id: "u-admin-1",
    displayName: "Nora Admin",
    email: "admin@bauflip.ch",
    role: "admin",
    avatarUrl: null,
    calendarColor: "#8b5cf6",
    calendarPosition: 1,
  },
  {
    id: "u-tech-1",
    displayName: "Luca Monteur",
    email: "monteur@bauflip.ch",
    role: "technician",
    avatarUrl: null,
    calendarColor: "#0ea5e9",
    calendarPosition: 2,
  },
];

export const mockProjects: Project[] = [
  {
    id: "p-1",
    contactId: "c-1",
    title: "Lamellenstoren Westfassade",
    type: "reparatur",
    status: "bericht_ausstehend",
    nextOwnerRole: "technician",
    nextOwnerUserId: null,
    source: "telefon",
    urgency: "hoch",
    intakeOriginalText:
      "Kunde meldet: Lamellenstoren blockiert seit gestern, lautes Geräusch beim Hochfahren.",
    accessNotes: "Zugang über Seiteneingang links, Klingel Werkstatt.",
    keyHandlingNotes: "Schlüssel bei Nachbarin Frau Keller, Wohnung 2.",
    timingNotes: "Nur zwischen 07:30 und 11:30 Uhr möglich.",
    internalNotes: "Bitte zuerst Motor prüfen, Kunde braucht schnelle Lösung.",
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    tenantUnit: "Whg. 3.1",
    sitePhone: "+41 44 111 22 33",
    siteMobile: null,
    referenceCode: "REF-2025-001",
    technicianNotes: "Motorzug prüfen, Leiter mitnehmen.",
    propertyId: "sp-1",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Bahnhofstrasse%208%2C%208001%20Z%C3%BCrich%2C%20CH",
    workTypeId: "wt-1",
    contactPersonId: "cp-1",
    serviceAddressId: "ca-1",
    billingAddressId: null,
    hintsAndNotes: "Klingel Werkstatt, nicht Haupteingang.",
  },
];

export const mockNotes: ProjectNote[] = [
  {
    id: "n-1",
    projectId: "p-1",
    type: "kunde",
    body: "Originalmeldung telefonisch aufgenommen, Geräusch beim Hochfahren.",
    authorRole: "office",
    createdAt: now,
  },
  {
    id: "n-2",
    projectId: "p-1",
    type: "planung",
    body: "Ersttermin geplant für Montag 08:30.",
    authorRole: "office",
    createdAt: now,
  },
];

export const mockAppointments: Appointment[] = [
  {
    id: "a-1",
    projectId: "p-1",
    kind: "besichtigung",
    startsAt: now,
    endsAt: now,
    assignedTechnicianId: "u-tech-1",
    planningNotes: "Bitte Leiter und Messgerät mitnehmen.",
    accessNotes: "Seiteneingang.",
    keyHandlingNotes: "Schlüssel bei Nachbarin.",
    createdAt: now,
  },
];

export const mockReports: TechnicianReport[] = [];
export const mockQuotes: Quote[] = [];
export const mockOrders: PurchaseOrder[] = [];
export const mockDeliveries: Delivery[] = [];
export const mockInvoices: Invoice[] = [];

export const mockModuleLabels: ModuleLabel[] = [
  { key: "overview_page_title", label: "Admin Übersicht" },
  { key: "overview_page_subtitle", label: "Was braucht heute deine Aufmerksamkeit?" },
];

export const mockKanbanColumns: KanbanColumn[] = [
  {
    id: "kc-1",
    projectId: "p-1",
    title: "Eingang",
    color: "blue",
    sortOrder: 0,
    status: "anfrage",
  },
  {
    id: "kc-2",
    projectId: "p-1",
    title: "In Abklärung",
    color: "orange",
    sortOrder: 1,
    status: "bericht_ausstehend",
  },
  {
    id: "kc-3",
    projectId: "p-1",
    title: "Umsetzung",
    color: "green",
    sortOrder: 2,
    status: "ausfuehrung_geplant",
  },
  {
    id: "kc-4",
    projectId: "p-1",
    title: "Abschluss",
    color: "violet",
    sortOrder: 3,
    status: "rechnung",
  },
];

export const mockKanbanCards: KanbanCard[] = [
  {
    id: "card-1",
    projectId: "p-1",
    columnId: "kc-2",
    title: "Lamellenstoren Westfassade",
    sortOrder: 0,
    status: "bericht_ausstehend",
    assignedTechnicianIds: ["u-tech-1"],
    dueDate: now,
  },
];

export const mockProjectChatMessages: ProjectChatMessage[] = [
  {
    id: "pcm-1",
    projectId: "p-1",
    appointmentId: "a-1",
    senderId: "u-admin-1",
    senderName: "Nora Admin",
    body: "Bitte bei der Besichtigung besonders auf Motorgeräusche achten.",
    createdAt: now,
  },
];

export const mockProjectChatAttachments: ProjectChatAttachment[] = [];
export const mockProjectAttachments: ProjectAttachment[] = [];

export const mockCalendarEvents: CalendarEvent[] = [];

export const mockArticleCategories: ArticleCategory[] = [
  {
    id: "ac-sonst",
    name: "Sonstiges",
    sortOrder: 0,
    templateScope: "generic",
    createdAt: now,
  },
  {
    id: "ac-1",
    name: "Markisen + Stoff",
    sortOrder: 10,
    templateScope: "generic",
    createdAt: now,
  },
  {
    id: "ac-2",
    name: "Faltrolladen Regapak",
    sortOrder: 20,
    templateScope: "generic",
    createdAt: now,
  },
];

export const mockArticles: Article[] = [
  {
    id: "art-1",
    name: "Markisenstoff Premium",
    sku: "MARK-STOFF-01",
    categoryId: "ac-1",
    categoryName: "Markisen + Stoff",
    categoryTemplateScope: "generic",
    supplierId: null,
    purchasePrice: 42.5,
    salePrice: 89.0,
    unit: "m",
    descriptionLong:
      "Markisenstoff Premium, xxxBEZEICHNUNGxxx — Breite xxxBREITExxx, Ort xxxORTxxx.",
    descriptionShort: "xxxBEZEICHNUNGxxx, xxxORTxxx",
    inStock: 12,
    createdAt: now,
  },
  {
    id: "art-2",
    name: "Faltrolladen Regapak Set",
    sku: "REGAPAK-SET-01",
    categoryId: "ac-2",
    categoryName: "Faltrolladen Regapak",
    categoryTemplateScope: "generic",
    supplierId: null,
    purchasePrice: 120,
    salePrice: 249,
    unit: "Stk",
    descriptionLong: null,
    descriptionShort: null,
    inStock: 3,
    createdAt: now,
  },
];

export const mockEmployeeStats: EmployeeStat[] = [
  {
    profileId: "u-tech-1",
    profileName: "Luca Monteur",
    offeneProjekte: 2,
    abgeschlosseneHeute: 1,
    offeneRapporte: 1,
    stundenDieseWoche: 34,
  },
];

export const mockAuditEvents: AuditEvent[] = [
  {
    id: "ae-1",
    action: "projekt_erstellt",
    projectId: "p-1",
    actorRole: "office",
    actorName: "Nora Admin",
    payload: "{\"status\":\"anfrage\"}",
    createdAt: now,
  },
];

export const mockMailProviders: MailProviderConfig[] = [];
export const mockMailDispatchLogs: MailDispatchLog[] = [];

export const mockSupplierTemplates: SupplierOrderTemplate[] = [
  {
    id: "st-lamex",
    supplierId: "s-lamex",
    supplierName: "Lamex",
    name: "Lamellenstoren",
    requiredFields: ["storen_typ", "lamellenfarbe", "position", "anzahl_storren"],
    fieldDefinitions: [
      { key: "storen_typ", label: "Storentyp", type: "select", required: true, options: ["LX90", "LX70", "C80", "C65", "F60", "F80", "F50"] },
      { key: "lamellenfarbe", label: "Lamellenfarbe", type: "select", required: true, options: ["010 Weiss", "071 Braun", "110 Beige", "130 Grau"] },
      { key: "position", label: "Position", type: "text", required: true },
      { key: "anzahl_storren", label: "Anzahl Storren", type: "number", required: true },
      { key: "bk_mm", label: "BK (mm)", type: "number", required: true },
      { key: "hk_mm", label: "HK (mm)", type: "number", required: true },
      { key: "antriebsart", label: "Antriebsart", type: "select", required: true, options: ["Getriebe", "Motor links", "Ohne Antrieb"] },
      { key: "antriebsseite", label: "Antriebsseite", type: "select", required: true, options: ["Links", "Mitte", "Rechts"] },
    ],
  },
  {
    id: "st-storosol",
    supplierId: "s-storosol",
    supplierName: "Storosol",
    name: "Stoffe",
    requiredFields: ["artikel", "stofftyp", "farbe", "breite_mm", "hoehe_mm"],
    fieldDefinitions: [
      { key: "artikel", label: "Artikel", type: "article", required: true },
      { key: "stofftyp", label: "Stofftyp", type: "text", required: true },
      { key: "farbe", label: "Farbe", type: "text", required: true },
      { key: "breite_mm", label: "Breite (mm)", type: "number", required: true },
      { key: "hoehe_mm", label: "Höhe (mm)", type: "number", required: true },
    ],
  },
  {
    id: "st-stobag",
    supplierId: "s-stobag",
    supplierName: "Stobag",
    name: "Gelenkarmmarkise",
    requiredFields: ["artikel", "modell", "farbe_rahmen", "stoff", "breite_mm", "ausladung_mm", "antrieb"],
    fieldDefinitions: [
      { key: "artikel", label: "Artikel", type: "article", required: true },
      { key: "modell", label: "Modell", type: "text", required: true },
      { key: "farbe_rahmen", label: "Rahmenfarbe", type: "text", required: true },
      { key: "stoff", label: "Stoff", type: "text", required: true },
      { key: "breite_mm", label: "Breite (mm)", type: "number", required: true },
      { key: "ausladung_mm", label: "Ausladung (mm)", type: "number", required: true },
      { key: "antrieb", label: "Antrieb", type: "select", required: true, options: ["Motor", "Kurbel"] },
    ],
  },
  {
    id: "st-ragazzi",
    supplierId: "s-ragazzi",
    supplierName: "Ragazzi",
    name: "Rollladen",
    requiredFields: ["artikel", "typ", "farbe", "breite_mm", "hoehe_mm", "antrieb"],
    fieldDefinitions: [
      { key: "artikel", label: "Artikel", type: "article", required: true },
      { key: "typ", label: "Typ", type: "text", required: true },
      { key: "farbe", label: "Farbe", type: "text", required: true },
      { key: "breite_mm", label: "Breite (mm)", type: "number", required: true },
      { key: "hoehe_mm", label: "Höhe (mm)", type: "number", required: true },
      { key: "antrieb", label: "Antrieb", type: "select", required: true, options: ["Gurt", "Kurbel", "Motor"] },
    ],
  },
  {
    id: "st-regazzi",
    supplierId: "s-regazzi",
    supplierName: "Regazzi",
    name: "Regapack Faltrollladen",
    requiredFields: ["artikel", "typ", "farbe", "breite_mm", "hoehe_mm"],
    fieldDefinitions: [
      { key: "artikel", label: "Artikel", type: "article", required: true },
      { key: "typ", label: "Typ", type: "text", required: true },
      { key: "farbe", label: "Farbe", type: "text", required: true },
      { key: "breite_mm", label: "Breite (mm)", type: "number", required: true },
      { key: "hoehe_mm", label: "Höhe (mm)", type: "number", required: true },
      { key: "fuehrung", label: "Führung", type: "text", required: false },
    ],
  },
  {
    id: "st-intern",
    supplierId: "s-intern",
    supplierName: "Intern",
    name: "Reparatur & Ersatzteile",
    requiredFields: ["artikel", "ersatzteil", "menge", "defektbeschreibung", "prioritaet"],
    fieldDefinitions: [
      { key: "artikel", label: "Artikel", type: "article", required: true },
      { key: "ersatzteil", label: "Ersatzteil / Reparaturteil", type: "text", required: true },
      { key: "menge", label: "Menge", type: "number", required: true },
      { key: "defektbeschreibung", label: "Defektbeschreibung", type: "text", required: true },
      { key: "prioritaet", label: "Priorität", type: "select", required: true, options: ["Normal", "Hoch", "Kritisch"] },
      { key: "bemerkung", label: "Bemerkung", type: "text", required: false },
    ],
  },
];

export const mockSupplierSubmissions: SupplierOrderSubmission[] = [];
export const mockStockDecisions: StockDecision[] = [];
