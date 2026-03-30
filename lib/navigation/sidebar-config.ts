import type { AppPageKey, RoleType, SidebarItem } from "@/lib/domain/types";

export const sidebarItems: SidebarItem[] = [
  { key: "uebersicht", label: "Übersicht", href: "/", section: "navigation" },
  { key: "mitarbeiter", label: "Mitarbeiter", href: "/mitarbeiter", section: "navigation" },
  { key: "kontakte", label: "Kontakte", href: "/kontakte", section: "navigation" },
  { key: "termine", label: "Termine", href: "/termine", section: "navigation" },
  { key: "projekte", label: "Projekte", href: "/projekte", section: "navigation" },
  { key: "kanban", label: "Kanban", href: "/kanban", section: "navigation" },
  { key: "artikel", label: "Artikel", href: "/artikel", section: "navigation" },
  { key: "rapporte", label: "Rapporte", href: "/rapporte", section: "einsatz" },
  { key: "team_chat", label: "Team-Chat", href: "/team-chat", section: "einsatz" },
  { key: "zeiterfassung", label: "Zeiterfassung", href: "/zeiterfassung", section: "einsatz" },
  {
    key: "stoffgenerator",
    label: "Stoffgenerator",
    href: "https://www.sonnentuch.ch/produkte-und-informationen/stoffe-und-dessins/stoffgenerator",
    section: "einsatz",
  },
  { key: "bestellformular", label: "Bestellformular CMS", href: "/bestellformular", section: "system" },
  { key: "einstellungen", label: "Einstellungen", href: "/einstellungen", section: "system" },
  { key: "integrationen", label: "Integrationen", href: "/integrationen", section: "system" },
  { key: "import_export", label: "Import / Export", href: "/import-export", section: "system" },
];

const roleVisibility: Record<RoleType, AppPageKey[]> = {
  admin: sidebarItems.map((item) => item.key),
  office: ["uebersicht", "kontakte", "termine", "projekte", "kanban", "artikel", "team_chat", "stoffgenerator", "bestellformular", "import_export", "einstellungen"],
  technician: ["uebersicht", "projekte", "kanban", "termine", "rapporte", "team_chat", "stoffgenerator"],
};

export function getVisibleSidebarItems(role: RoleType) {
  const visible = new Set(roleVisibility[role]);
  return sidebarItems.filter((item) => visible.has(item.key));
}
