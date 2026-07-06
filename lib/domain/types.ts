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
  "abholbereit",
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
  "projekte",
  "kalender",
  "mitarbeiter",
  "bestellformulare",
  "zeiterfassung",
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
  /** Nur bei Filter ABGEMACHT (Termin-Sortierung). */
  nextAppointmentStartsAt?: string | null;
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
  orderForms: TechnicianReportOrderFormEntry[];
};

export const quoteStatuses = ["draft", "sent", "approved", "rejected"] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: "ENTWURF",
  sent: "GESENDET",
  approved: "ANGENOMMEN",
  rejected: "ABGELEHNT",
};

export const quoteStatusBadgeClassNames: Record<QuoteStatus, string> = {
  draft:
    "border-zinc-500/45 bg-zinc-500/35 text-zinc-950 dark:border-zinc-400/50 dark:bg-zinc-500/40 dark:text-zinc-50",
  sent:
    "border-violet-500/55 bg-violet-500/35 text-violet-950 dark:border-violet-400/55 dark:bg-violet-500/45 dark:text-violet-50",
  approved:
    "border-green-600/60 bg-green-600/40 text-green-950 dark:border-green-400/60 dark:bg-green-600/50 dark:text-green-50",
  rejected:
    "border-rose-600/60 bg-rose-600/45 text-rose-950 dark:border-rose-400/60 dark:bg-rose-600/55 dark:text-rose-50",
};

/**
 * Kopplung Offerten-Status → Projekt-Status.
 * `null` = Projekt-Status nicht anfassen (draft/rejected: Büro entscheidet manuell).
 */
export function projectStatusAfterQuoteStatusChange(quoteStatus: QuoteStatus): ProjectStatus | null {
  if (quoteStatus === "sent") return "offerte_gesendet";
  if (quoteStatus === "approved") return "offerte_genehmigt";
  return null;
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
  createdAt: string;
  updatedAt: string;
  lineItems: QuoteLineItem[];
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

/** Tailwind-Klassen pro Status — jeder Schritt eigene Farbe (Liste, Sheet, Monteur). */
export const projectStatusBadgeClassNames: Record<ProjectStatus, string> = {
  offen: "border-zinc-500/45 bg-zinc-500/35 text-zinc-950 dark:border-zinc-400/50 dark:bg-zinc-500/40 dark:text-zinc-50",
  abgemacht:
    "border-lime-500/60 bg-lime-500/40 text-lime-950 dark:border-lime-400/60 dark:bg-lime-500/50 dark:text-lime-50",
  einsatz_offen:
    "border-blue-500/55 bg-blue-500/35 text-blue-950 dark:border-blue-400/55 dark:bg-blue-500/45 dark:text-blue-50",
  offerte_senden:
    "border-indigo-500/55 bg-indigo-500/35 text-indigo-950 dark:border-indigo-400/55 dark:bg-indigo-500/45 dark:text-indigo-50",
  offerte_gesendet:
    "border-violet-500/55 bg-violet-500/35 text-violet-950 dark:border-violet-400/55 dark:bg-violet-500/45 dark:text-violet-50",
  offerte_genehmigt:
    "border-purple-500/55 bg-purple-500/35 text-purple-950 dark:border-purple-400/55 dark:bg-purple-500/45 dark:text-purple-50",
  bestellen:
    "border-fuchsia-500/55 bg-fuchsia-500/35 text-fuchsia-950 dark:border-fuchsia-400/55 dark:bg-fuchsia-500/45 dark:text-fuchsia-50",
  bestellt:
    "border-pink-500/55 bg-pink-500/35 text-pink-950 dark:border-pink-400/55 dark:bg-pink-500/45 dark:text-pink-50",
  montagebereit:
    "border-emerald-500/55 bg-emerald-500/35 text-emerald-950 dark:border-emerald-400/55 dark:bg-emerald-500/45 dark:text-emerald-50",
  abholbereit:
    "border-teal-500/55 bg-teal-500/35 text-teal-950 dark:border-teal-400/55 dark:bg-teal-500/45 dark:text-teal-50",
  werkstatt:
    "border-orange-500/55 bg-orange-500/35 text-orange-950 dark:border-orange-400/55 dark:bg-orange-500/45 dark:text-orange-50",
  abklaeren:
    "border-amber-500/55 bg-amber-500/35 text-amber-950 dark:border-amber-400/55 dark:bg-amber-500/45 dark:text-amber-50",
  abrechnen:
    "border-yellow-500/60 bg-yellow-500/45 text-yellow-950 dark:border-yellow-300/60 dark:bg-yellow-500/55 dark:text-yellow-50",
  subunternehmer:
    "border-stone-500/55 bg-stone-500/35 text-stone-950 dark:border-stone-400/55 dark:bg-stone-500/45 dark:text-stone-50",
  abgeschlossen:
    "border-green-600/60 bg-green-600/40 text-green-950 dark:border-green-400/60 dark:bg-green-600/50 dark:text-green-50",
  garantiefall:
    "border-rose-600/60 bg-rose-600/45 text-rose-950 dark:border-rose-400/60 dark:bg-rose-600/55 dark:text-rose-50",
};

export function projectStatusBadgeClassName(status: string): string {
  if (projectStatuses.includes(status as ProjectStatus)) {
    return projectStatusBadgeClassNames[status as ProjectStatus];
  }
  return "border-transparent bg-muted text-muted-foreground";
}
