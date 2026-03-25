import type {
  CompanyKpiSnapshot,
  EmployeeStat,
  Project,
  RoleType,
  UserProfile,
  WeekTaskItem,
} from "@/lib/domain/types";

/** Server-seitig gebündelte Daten für alle Dashboard-Bausteine. */
export type DashboardPageData = {
  projects: Project[];
  weekTasks: WeekTaskItem[];
  /** Team für Kalender-Legende (Farbe + Reihenfolge) */
  teamCalendarProfiles: UserProfile[];
  kpis: CompanyKpiSnapshot;
  employeeStats: EmployeeStat[];
  role: RoleType;
  snapshot: {
    openCount: number;
    urgentCount: number;
    invoiceReadyCount: number;
  };
};
