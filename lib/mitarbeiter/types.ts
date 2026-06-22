import type { TechnicianAbsence } from "@/lib/domain/types";

export type TeamMemberListItem = {
  key: string;
  /** Nur bei aktiven Mitgliedern — für Avatar-Link zum eigenen Profil. */
  userId: string | null;
  displayName: string;
  email: string;
  role: "admin" | "office" | "technician";
  status: "aktiv" | "eingeladen";
  createdAt: string | null;
  avatarUrl: string | null;
};

export type MitarbeiterBootstrapData = {
  team: TeamMemberListItem[];
  absences: TechnicianAbsence[];
};
