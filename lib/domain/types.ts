import type { OrderFormFieldDef } from "@/lib/order-forms/schema";

export const projectTypes = ["reparatur", "ersatz", "neuinstallation"] as const;
export type ProjectType = (typeof projectTypes)[number];

/** Vollständiger Auftrags-Lebenszyklus (analog Monday.com Workflow) — Reihenfolge = Kunden-Priorität. */
export const projectStatuses = [
  "offen",
  "montagebereit",
  "abgemacht",
  "einsatz_offen",
  "offerte_senden",
  "offerte_gesendet",
  "offerte_genehmigt",
  "bestellen",
  "bestellt",
  "werkstatt",
  "abholbereit",
  "abklaeren",
  "subunternehmer",
  "abrechnen",
  "abgeschlossen",
  "garantiefall",
] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

/** Status-Optionen im Büro-Listenfilter (`/projekte`) ohne `einsatz_offen` — oft unbenutzt; Projekte mit diesem Wert bleiben unter „Alle“ sichtbar. */
export const projectStatusesOfficeListFilter = projectStatuses.filter((s) => s !== "einsatz_offen");

export type NextProjectStatusAfterAppointmentContext = {
  /**
   * Termin ist noch nicht beendet (`endsAt >= jetzt`) — laufend oder zukünftig.
   * Nur dann wird auf „abgemacht“ automatisiert.
   */
  appointmentIsUpcoming: boolean;
};

export const projectStatusUpdateSources = ["manual", "appointment_automation"] as const;
export type ProjectStatusUpdateSource = (typeof projectStatusUpdateSources)[number];

/** Termin-Slot noch nicht vorbei (heute/laufend oder später). */
export function appointmentEndsInFutureOrNow(endsAtIso: string): boolean {
  return new Date(endsAtIso).getTime() >= Date.now();
}

/**
 * Nach Termin-Löschung: auf welchen Status zurückfallen.
 * `null` = Status nicht anfassen.
 * Nur angewendet wenn kein bevorstehender Termin mehr für das Projekt existiert.
 */
export function projectStatusAfterLastAppointmentDeleted(
  current: ProjectStatus,
  revertStatus: ProjectStatus | null | undefined,
): ProjectStatus | null {
  if (current !== "abgemacht") return null;
  if (revertStatus && revertStatus !== "abgemacht") return revertStatus;
  return "offen";
}

/** Büro-Liste «ABGEMACHT»: bei neuem (Folge‑)Termin von diesen Status aus automatisch «abgemacht». */
export const projectStatusesToAbgemachtOnAppointmentBooked = [
  "offen",
  "montagebereit",
  "einsatz_offen",
  "bestellt",
  "werkstatt",
  "garantiefall",
] as const satisfies readonly ProjectStatus[];

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
  if (
    (projectStatusesToAbgemachtOnAppointmentBooked as readonly ProjectStatus[]).includes(
      current,
    )
  ) {
    return "abgemacht";
  }
  return null;
}

/** Status-Optionen nach Rapport "Aufgenommen" beim Erstbesuch (Bestandesaufnahme) */
export const RAPPORT_NEXT_STEPS_AUFGENOMMEN = [
  "offerte_senden",
  "bestellen",
  "montagebereit",
  "werkstatt",       // Werkstatt nötig
] as const satisfies readonly ProjectStatus[];
export type RapportNextStepAufgenommen = (typeof RAPPORT_NEXT_STEPS_AUFGENOMMEN)[number];

/** Status-Optionen nach Rapport "Nicht fertig" beim Montage-/Folgebesuch */
export const RAPPORT_NEXT_STEPS_MONTAGE = [
  "einsatz_offen",   // Weiterer Termin nötig
  "montagebereit",   // Bereit für nächsten Montageeinsatz
  "werkstatt",       // Werkstatt nötig
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

/** Hinweis im Büro-Sheet, wenn «Abgeschlossen» noch nicht wählbar ist. */
export const PROJECT_STATUS_ABGESCHLOSSEN_REQUIRES_ABRECHNEN_MESSAGE =
  "Abschluss nur möglich, wenn der Auftrag auf «Abrechnen» oder «Garantiefall» steht. Bitte zuerst passenden Zwischenstatus setzen.";

/** Darf `to` aus `from` gesetzt werden? (Büro manuell + Server-Validierung) */
export function canSetProjectStatus(from: ProjectStatus, to: ProjectStatus): boolean {
  if (to === from) return true;
  if (to === "abgeschlossen") return from === "abrechnen" || from === "garantiefall";
  return true;
}

export function assertAllowedProjectStatusTransition(from: ProjectStatus, to: ProjectStatus): void {
  if (!canSetProjectStatus(from, to)) {
    throw new Error(PROJECT_STATUS_ABGESCHLOSSEN_REQUIRES_ABRECHNEN_MESSAGE);
  }
}

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
  "dashboard",
  "projekte",
  "kalender",
  "mitarbeiter",
  "bestellformulare",
  "zeiterfassung",
  "zahlungen",
  "kontakte",
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
  statusUpdateSource: ProjectStatusUpdateSource | null;
  /** Vorheriger Status vor automatischem Sprung auf «abgemacht» (Termin-Löschung). */
  statusRevertOnAppointmentClear: ProjectStatus | null;
  /** Grund/Beschreibung des Garantiefalls — gesetzt beim Wechsel auf Status «garantiefall». */
  warrantyNote: string | null;
  warrantyOpenedAt: string | null;
  warrantyOpenedByUserId: string | null;
  warrantyOpenedByDisplayName: string | null;
};

export type Appointment = {
  id: string;
  projectId: string;
  kind: "besichtigung" | "ausfuehrung";
  startsAt: string;
  endsAt: string;
  assignedTechnicianId: string | null;
  /** Anzeigename aus profiles — ohne separate Monteur-Liste im Sheet. */
  assignedTechnicianDisplayName?: string | null;
  /** Optionaler zweiter Monteur am selben Termin. */
  assignedTechnicianId2: string | null;
  assignedTechnicianDisplayName2?: string | null;
  planningNotes: string | null;
  createdAt: string;
};

export const technicianAbsenceKinds = ["ferien", "krank", "blocker"] as const;
export type TechnicianAbsenceKind = (typeof technicianAbsenceKinds)[number];

export const technicianAbsenceKindLabels: Record<TechnicianAbsenceKind, string> = {
  ferien: "Ferien",
  krank: "Krank",
  blocker: "Blocker",
};

/** Eintrag in `technician_absences`: belegt eine Zeit pro Monteur ohne Projektbezug. */
export type TechnicianAbsence = {
  id: string;
  technicianId: string;
  technicianName: string | null;
  startsAt: string;
  endsAt: string;
  kind: TechnicianAbsenceKind;
  note: string | null;
  createdAt: string;
};

/** Eintrag in `time_entries`: manuell erfasste Arbeitszeit eines Mitarbeiters an einem Tag. */
export type TimeEntry = {
  id: string;
  userId: string;
  userDisplayName: string | null;
  entryDate: string;
  startsAt: string | null;
  endsAt: string | null;
  hours: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Nur Felder für die Büro-Liste; Stammdaten-Detail lädt das Sheet separat. */
export type OfficeProjectListItem = {
  id: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
  /** ISO: Erstellung (Sortierung „neueste zuerst“). */
  createdAt: string;
  /** Nächster künftiger Termin (Listen-Spalte; bei ABGEMACHT auch Sortierung). */
  nextAppointmentStartsAt?: string | null;
  /** Monteur des nächsten Termins («Name» bzw. «Name +1» bei zwei Monteuren). */
  nextAppointmentTechnician?: string | null;
  /** Nicht in schlanker Listen-Payload — Sheet / Legacy. */
  displayLabel?: string | null;
  serviceAddressShort?: string | null;
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
  /** Optionaler zweiter Monteur am selben Termin. */
  assignedTechnicianId2: string | null;
  technicianName2: string | null;
  calendarColor2: string | null;
  /** Aus `projects`-Join; vermeidet N+1 `getProjectCore` auf /tag */
  tenantDisplay: string | null;
  serviceAddressShort: string | null;
};

/** IDs aller zugewiesenen Monteure (1 oder 2) — zentrale Stelle statt verstreuter `=== id`-Checks. */
export function taskAssignedTechnicianIds(
  task: Pick<WeekTaskItem, "assignedTechnicianId" | "assignedTechnicianId2">,
): string[] {
  return [task.assignedTechnicianId, task.assignedTechnicianId2].filter(
    (id): id is string => Boolean(id),
  );
}

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
  /** Profil-UUID des Erfaassers; Anzeigename siehe `createdByDisplayName`. */
  createdByProfileId: string | null;
  /** Snapshot von `profiles.display_name` bei Erfassung (für alle sichtbar). */
  createdByDisplayName: string | null;
  /**
   * Kundenunterschrift als data:image/png-URL (Canvas-Export).
   * In Listen-/Bootstrap-Payloads immer `null` — wird on-demand geladen
   * (`getReportSignatureAction`), Indikator ist `hasSignature`.
   */
  signatureDataUrl: string | null;
  /** Signatur vorhanden (generated column, ohne Data-URL-Payload). */
  hasSignature: boolean;
  /** Name der unterzeichnenden Person. */
  signedByName: string | null;
  orderForms: TechnicianReportOrderFormEntry[];
};

export const quoteStatuses = ["draft", "pending_approval", "sent", "approved", "rejected"] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: "ENTWURF",
  pending_approval: "WARTET AUF FREIGABE",
  sent: "GESENDET",
  approved: "ANGENOMMEN",
  rejected: "ABGELEHNT",
};

export const quoteStatusBadgeClassNames: Record<QuoteStatus, string> = {
  draft:
    "border-zinc-500/45 bg-zinc-500/35 text-zinc-950 dark:border-zinc-400/50 dark:bg-zinc-500/40 dark:text-zinc-50",
  pending_approval:
    "border-amber-500/55 bg-amber-500/35 text-amber-950 dark:border-amber-400/55 dark:bg-amber-500/45 dark:text-amber-50",
  sent:
    "border-violet-500/55 bg-violet-500/35 text-violet-950 dark:border-violet-400/55 dark:bg-violet-500/45 dark:text-violet-50",
  approved:
    "border-green-600/60 bg-green-600/40 text-green-950 dark:border-green-400/60 dark:bg-green-600/50 dark:text-green-50",
  rejected:
    "border-rose-600/60 bg-rose-600/45 text-rose-950 dark:border-rose-400/60 dark:bg-rose-600/55 dark:text-rose-50",
};

/**
 * Kopplung Offerten-Status → Projekt-Status.
 * `null` = Projekt-Status nicht anfassen (draft/pending_approval/rejected: Büro entscheidet manuell).
 */
export function projectStatusAfterQuoteStatusChange(quoteStatus: QuoteStatus): ProjectStatus | null {
  if (quoteStatus === "sent") return "offerte_gesendet";
  if (quoteStatus === "approved") return "offerte_genehmigt";
  return null;
}

/**
 * Erlaubte Offerten-Statusübergänge (UI-Buttons UND Server-Validierung —
 * Muster analog `canSetProjectStatus`). Freigabe-Workflow: Entwürfe gehen immer
 * über `pending_approval`, bevor sie gesendet werden dürfen (kein Direktversand
 * aus dem Entwurf) — nur ein Admin darf `pending_approval` → `sent` auslösen
 * (siehe `canDecideQuoteApproval`, serverseitig in den Actions erzwungen).
 * Angenommene Offerten sind final; abgelehnte können zur Überarbeitung zurück
 * in den Entwurf.
 */
export const allowedQuoteStatusTransitions: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ["pending_approval"],
  pending_approval: ["sent", "draft"],
  sent: ["approved", "rejected"],
  approved: [],
  rejected: ["draft"],
};

/** Nur Admins dürfen eine zur Freigabe eingereichte Offerte freigeben (senden) oder zurückweisen. */
export function canDecideQuoteApproval(role: RoleType): boolean {
  return role === "admin";
}

/** Darf `to` aus `from` gesetzt werden? Gleicher Status = erlaubt (z. B. erneuter Versand). */
export function canSetQuoteStatus(from: QuoteStatus, to: QuoteStatus): boolean {
  if (to === from) return true;
  return allowedQuoteStatusTransitions[from].includes(to);
}

export function assertAllowedQuoteStatusTransition(from: QuoteStatus, to: QuoteStatus): void {
  if (!canSetQuoteStatus(from, to)) {
    throw new Error(
      `Statuswechsel «${quoteStatusLabels[from]}» → «${quoteStatusLabels[to]}» ist nicht zulässig.`,
    );
  }
}

export type QuoteLineItem = {
  id: string;
  quoteId: string;
  position: number;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  lineTotal: number;
};

export type Quote = {
  id: string;
  organizationId: string;
  projectId: string;
  /** Per DB-Trigger vergeben (OF-Jahr-Sequenz je Organisation). */
  quoteNumber: string | null;
  status: QuoteStatus;
  validUntil: string | null;
  introText: string | null;
  outroText: string | null;
  vatRate: number;
  totalNet: number;
  totalGross: number;
  sentAt: string | null;
  sentToEmail: string | null;
  /** Snapshot-Muster wie technician_reports. */
  createdByProfileId: string | null;
  createdByDisplayName: string | null;
  /** Zeitpunkt der Einreichung zur internen Freigabe (draft → pending_approval). */
  submittedForApprovalAt: string | null;
  /** Zeitpunkt der Admin-Entscheidung — Freigabe (→ sent) oder Zurückweisung (→ draft). */
  approvalDecidedAt: string | null;
  approvedByProfileId: string | null;
  approvedByDisplayName: string | null;
  /** Kommentar des Admins bei Zurückweisung — fürs Büro sichtbar. */
  approvalNote: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: QuoteLineItem[];
};

/** Eintrag in `price_book_items`: wiederverwendbare Offert-Position je Organisation. */
export type PriceBookItem = {
  id: string;
  organizationId: string;
  name: string;
  /** Längerer Beschreibungstext (optional) — wird als Positions-Beschreibung übernommen. */
  description: string | null;
  /** Kategorie zur Gruppierung im Picker (optional). */
  category: string | null;
  /** Interne/Lieferanten-Artikelnummer (optional). */
  articleNumber: string | null;
  unit: string | null;
  unitPrice: number;
  isActive: boolean;
  sortOrder: number;
};

export const contactKinds = ["privat", "mieter", "verwaltung", "eigentuemer", "lieferant"] as const;
export type ContactKind = (typeof contactKinds)[number];

export const contactKindLabels: Record<ContactKind, string> = {
  privat: "Privatkunde",
  mieter: "Mieter",
  verwaltung: "Verwaltung",
  eigentuemer: "Eigentümer",
  lieferant: "Lieferant",
};

/** Kontaktverzeichnis-Eintrag einer Organisation (Kunde/Mieter/Verwaltung/…). */
export type Contact = {
  id: string;
  organizationId: string;
  kind: ContactKind;
  displayName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  kundenNummer: string | null;
  bexioContactId: number | null;
  isActive: boolean;
  createdAt: string;
};

// ─── Rechnungen (QR-Rechnung) ────────────────────────────────────────────────

export const invoiceStatuses = ["draft", "sent", "paid", "cancelled"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "ENTWURF",
  sent: "GESENDET",
  paid: "BEZAHLT",
  cancelled: "STORNIERT",
};

export const invoiceStatusBadgeClassNames: Record<InvoiceStatus, string> = {
  draft:
    "border-zinc-500/45 bg-zinc-500/35 text-zinc-950 dark:border-zinc-400/50 dark:bg-zinc-500/40 dark:text-zinc-50",
  sent:
    "border-violet-500/55 bg-violet-500/35 text-violet-950 dark:border-violet-400/55 dark:bg-violet-500/45 dark:text-violet-50",
  paid:
    "border-green-600/60 bg-green-600/40 text-green-950 dark:border-green-400/60 dark:bg-green-600/50 dark:text-green-50",
  cancelled:
    "border-stone-500/55 bg-stone-500/35 text-stone-950 dark:border-stone-400/55 dark:bg-stone-500/45 dark:text-stone-50",
};

/**
 * Erlaubte Rechnungs-Statusübergänge (UI + Server, Muster `allowedQuoteStatusTransitions`).
 * Bezahlt und storniert sind final (Buchhaltungs-Integrität) — Entwürfe werden
 * gelöscht statt storniert.
 */
export const allowedInvoiceStatusTransitions: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ["sent"],
  sent: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
};

/** Darf `to` aus `from` gesetzt werden? Gleicher Status = erlaubt (z. B. erneuter Versand). */
export function canSetInvoiceStatus(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (to === from) return true;
  return allowedInvoiceStatusTransitions[from].includes(to);
}

export function assertAllowedInvoiceStatusTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canSetInvoiceStatus(from, to)) {
    throw new Error(
      `Statuswechsel «${invoiceStatusLabels[from]}» → «${invoiceStatusLabels[to]}» ist nicht zulässig.`,
    );
  }
}

/** Referenztyp im Swiss QR Code — abgeleitet aus der IBAN, bei Erstellung eingefroren. */
export const invoiceReferenceTypes = ["QRR", "SCOR", "NON"] as const;
export type InvoiceReferenceType = (typeof invoiceReferenceTypes)[number];

export type InvoiceLineItem = {
  id: string;
  invoiceId: string;
  position: number;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  lineTotal: number;
};

export type Invoice = {
  id: string;
  organizationId: string;
  projectId: string;
  /** Herkunfts-Offerte (Positionen kopiert) — null bei freier Erfassung. */
  quoteId: string | null;
  /** Per DB-Trigger vergeben (RE-Jahr-Sequenz je Organisation). */
  invoiceNumber: string | null;
  status: InvoiceStatus;
  /** Fälligkeit (YYYY-MM-DD), Default +30 Tage bei Erstellung. */
  dueDate: string | null;
  introText: string | null;
  vatRate: number;
  totalNet: number;
  totalGross: number;
  /**
   * QR-Referenz — bei Erstellung aus der Org-IBAN abgeleitet und eingefroren
   * (ändert sich nie mehr, auch wenn die Org-IBAN später wechselt).
   */
  referenceType: InvoiceReferenceType;
  paymentReference: string | null;
  sentAt: string | null;
  sentToEmail: string | null;
  paidAt: string | null;
  createdByProfileId: string | null;
  createdByDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: InvoiceLineItem[];
  /** Bexio-Beleg (Teil B) — kb_invoice-ID nach Push, Idempotenz-Schlüssel. */
  bexioInvoiceId: number | null;
  bexioSyncedAt: string | null;
  bexioSyncError: string | null;
};

/** Protokoll-Zeile eines camt-Zahlungsabgleichs (Datei selbst wird nie gespeichert). */
export type PaymentImport = {
  id: string;
  organizationId: string;
  filename: string;
  importedByProfileId: string | null;
  importedByDisplayName: string | null;
  entriesTotal: number;
  entriesMatched: number;
  entriesAlreadyPaid: number;
  entriesAmountMismatch: number;
  entriesUnmatched: number;
  createdAt: string;
};

/** Zahlungsdaten der Organisation (organizations.billing_*) für QR-Rechnungen. */
export type OrganizationBillingSettings = {
  iban: string | null;
  creditorName: string | null;
  creditorStreet: string | null;
  creditorBuildingNumber: string | null;
  creditorPostalCode: string | null;
  creditorCity: string | null;
  vatNumber: string | null;
};

/** Bexio-Anbindung (Teil B): Verbindungsstatus + Mapping (organizations.bexio_*). Token selbst nie hier. */
export type BexioSettings = {
  connected: boolean;
  connectedAt: string | null;
  taxId: number | null;
  accountId: number | null;
};

/** Dokumenttyp einer Word-Vorlage (document_templates.kind). */
export const documentTemplateKinds = ["offerte", "auftrag", "rapport", "rechnung"] as const;
export type DocumentTemplateKind = (typeof documentTemplateKinds)[number];

/** Word-Vorlage (.docx) einer Organisation, von Bauflip mit Platzhaltern gefüllt. */
export type DocumentTemplate = {
  id: string;
  organizationId: string;
  kind: DocumentTemplateKind;
  name: string;
  storagePath: string;
  outputFormat: "docx" | "pdf";
  isDefault: boolean;
  createdByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
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
  offen: "ABMACHEN",
  abgemacht: "ABGEMACHT",
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
  garantiefall: "GARANTIEFALL",
};

/**
 * Tailwind-Klassen pro Status — jeder Schritt eigene Farbe (Liste, Sheet, Monteur).
 * Werkzeug-Präzision-Stil: schmaler Rahmen in der Statusfarbe, sehr leichte Füllung,
 * Text in der Farbe (nicht fast-schwarz) — wie eine technische Stempel-Markierung.
 * Scharfe Kanten kommen aus der Badge-Basis (`rounded-sm`).
 */
export const projectStatusBadgeClassNames: Record<ProjectStatus, string> = {
  offen: "border-zinc-500/60 bg-zinc-500/10 text-zinc-700 dark:border-zinc-400/50 dark:bg-zinc-400/15 dark:text-zinc-200",
  abgemacht:
    "border-lime-600/60 bg-lime-500/10 text-lime-800 dark:border-lime-400/50 dark:bg-lime-400/15 dark:text-lime-200",
  einsatz_offen:
    "border-blue-600/60 bg-blue-500/10 text-blue-800 dark:border-blue-400/50 dark:bg-blue-400/15 dark:text-blue-200",
  offerte_senden:
    "border-indigo-600/60 bg-indigo-500/10 text-indigo-800 dark:border-indigo-400/50 dark:bg-indigo-400/15 dark:text-indigo-200",
  offerte_gesendet:
    "border-violet-600/60 bg-violet-500/10 text-violet-800 dark:border-violet-400/50 dark:bg-violet-400/15 dark:text-violet-200",
  offerte_genehmigt:
    "border-purple-600/60 bg-purple-500/10 text-purple-800 dark:border-purple-400/50 dark:bg-purple-400/15 dark:text-purple-200",
  bestellen:
    "border-fuchsia-600/60 bg-fuchsia-500/10 text-fuchsia-800 dark:border-fuchsia-400/50 dark:bg-fuchsia-400/15 dark:text-fuchsia-200",
  bestellt:
    "border-pink-600/60 bg-pink-500/10 text-pink-800 dark:border-pink-400/50 dark:bg-pink-400/15 dark:text-pink-200",
  montagebereit:
    "border-emerald-600/60 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/50 dark:bg-emerald-400/15 dark:text-emerald-200",
  abholbereit:
    "border-teal-600/60 bg-teal-500/10 text-teal-800 dark:border-teal-400/50 dark:bg-teal-400/15 dark:text-teal-200",
  werkstatt:
    "border-orange-600/60 bg-orange-500/10 text-orange-800 dark:border-orange-400/50 dark:bg-orange-400/15 dark:text-orange-200",
  abklaeren:
    "border-amber-600/60 bg-amber-500/10 text-amber-800 dark:border-amber-400/50 dark:bg-amber-400/15 dark:text-amber-200",
  abrechnen:
    "border-yellow-600/70 bg-yellow-500/10 text-yellow-800 dark:border-yellow-400/55 dark:bg-yellow-400/15 dark:text-yellow-200",
  subunternehmer:
    "border-stone-500/60 bg-stone-500/10 text-stone-700 dark:border-stone-400/50 dark:bg-stone-400/15 dark:text-stone-200",
  abgeschlossen:
    "border-green-700/55 bg-green-600/10 text-green-800 dark:border-green-400/50 dark:bg-green-400/15 dark:text-green-200",
  garantiefall:
    "border-rose-600/65 bg-rose-600/10 text-rose-800 dark:border-rose-400/55 dark:bg-rose-400/15 dark:text-rose-200",
};

export function projectStatusBadgeClassName(status: string): string {
  if (projectStatuses.includes(status as ProjectStatus)) {
    return projectStatusBadgeClassNames[status as ProjectStatus];
  }
  return "border-transparent bg-muted text-muted-foreground";
}
