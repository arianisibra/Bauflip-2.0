/**
 * Central query-key factory. Never use string literals for query keys elsewhere —
 * always go through these helpers so keys stay consistent.
 *
 * Shape convention: ["domain", "scope", ...args] — wide-to-narrow, so `invalidateQueries`
 * can target broader prefixes (e.g. invalidate all project-scoped queries with
 * `{ queryKey: ["projects"] }`).
 */
export const queryKeys = {
  projects: {
    all: () => ["projects"] as const,
    list: () => ["projects", "list"] as const,
    core: (projectId: string) => ["projects", "core", projectId] as const,
    coreHead: (projectId: string) => ["projects", "core-head", projectId] as const,
    coreDetails: (projectId: string) => ["projects", "core-details", projectId] as const,
    /** Auftragsseite Monteur/Admin-Preview: eigener Key wegen anderer Server-Action als Büro-Sheet. */
    auftragCore: (projectId: string) => ["projects", "auftrag-core", projectId] as const,
  },
  /** Deferred Auftrag extras (signed URLs + order-form templates). */
  auftragExtras: (projectId: string, skipOrderFormTemplates = false) =>
    ["auftrag-extras", projectId, skipOrderFormTemplates] as const,
  auftragExtrasPrefix: (projectId: string) => ["auftrag-extras", projectId] as const,
  weekTasks: {
    all: () => ["week-tasks"] as const,
    byDate: (isoDate: string) => ["week-tasks", isoDate] as const,
  },
  monthTasks: {
    all: () => ["month-tasks"] as const,
    byYearMonth: (year: number, month: number) => ["month-tasks", year, month] as const,
  },
  /** Monteur-/Feld-Kalender: ganzer Monat (inkl. Monteur-SQL-Filter). */
  techMonthTasks: {
    all: () => ["tech-month-tasks"] as const,
    byYearMonth: (year: number, month: number) => ["tech-month-tasks", year, month] as const,
  },
  /** Büro-Kalender: beliebiger Zeitraum (Monat / KW / Tag) über starts_at-Bounds. */
  calendarRange: {
    all: () => ["admin-calendar-range"] as const,
    byStartEnd: (rangeStartIso: string, rangeEndIso: string) =>
      ["admin-calendar-range", rangeStartIso, rangeEndIso] as const,
  },
  /** Verfügbarkeit: Termine + Abwesenheiten + Monteure für einen Bereich. */
  availabilityRange: {
    all: () => ["availability-range"] as const,
    byStartEnd: (rangeStartIso: string, rangeEndIso: string) =>
      ["availability-range", rangeStartIso, rangeEndIso] as const,
  },
  /** Abwesenheiten (alle, Mitarbeiter-Drawer). */
  absences: {
    all: () => ["technician-absences"] as const,
  },
  /** Offerten je Projekt (Büro-Sheet). */
  quotes: {
    all: () => ["quotes"] as const,
    byProject: (projectId: string) => ["quotes", projectId] as const,
  },
  /** SMTP konfiguriert? (statisch pro Deployment). */
  quoteMailConfig: () => ["quote-mail-config"] as const,
  /** Preisstamm der Organisation (Offert-Editor + Verwaltung). */
  priceBook: () => ["price-book"] as const,
  /** Kundensignatur eines Rapports — on-demand beim Aufklappen der Karte. */
  reportSignature: (reportId: string) => ["report-signature", reportId] as const,
  /** Auswertungen (Kennzahlen-Übersicht, Admin/Büro). */
  dashboard: () => ["dashboard"] as const,
  /** Zeiterfassung: eigene Einträge + Team-Übersicht (Büro/Admin). */
  timeEntries: {
    all: () => ["time-entries"] as const,
    mine: (startDate: string, endDate: string) => ["time-entries", "mine", startDate, endDate] as const,
    org: (startDate: string, endDate: string) => ["time-entries", "org", startDate, endDate] as const,
  },
  assignableProfiles: () => ["assignable-profiles"] as const,
  projekteBootstrap: (status = "all", search = "") => ["projekte-bootstrap", status, search] as const,
  /** Prefix — invalidates every status-specific bootstrap cache. */
  projekteBootstrapAll: () => ["projekte-bootstrap"] as const,
  projekteList: (status: string, search = "") => ["projekte-list", status, search] as const,
  /** Prefix — invalidates every paginated list cache. */
  projekteListAll: () => ["projekte-list"] as const,
  organizationBranding: () => ["organization-branding"] as const,
  einstellungenPage: () => ["einstellungen-page"] as const,
  teamMembers: () => ["team-members"] as const,
  orderFormTemplates: {
    all: () => ["order-form-templates"] as const,
    byOrg: (orgId: string | null) => ["order-form-templates", orgId] as const,
  },
} as const;
