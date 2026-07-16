import type { AppPageKey, RoleType, SidebarItem } from "@/lib/domain/types";

export const sidebarItems: SidebarItem[] = [
  { key: "dashboard", label: "Auswertungen", href: "/dashboard", section: "navigation" },
  { key: "projekte", label: "Projekte", href: "/projekte", section: "navigation" },
  { key: "kalender", label: "Kalender", href: "/kalender", section: "navigation" },
  { key: "mitarbeiter", label: "Mitarbeiter", href: "/mitarbeiter", section: "navigation" },
  {
    key: "bestellformulare",
    label: "Bestellformulare",
    href: "/bestellformulare",
    section: "navigation",
  },
  { key: "zeiterfassung", label: "Zeiterfassung", href: "/zeiterfassung", section: "navigation" },
  { key: "zahlungen", label: "Zahlungen", href: "/zahlungen", section: "navigation" },
  { key: "kontakte", label: "Kontakte", href: "/kontakte", section: "navigation" },
  { key: "einstellungen", label: "Einstellungen", href: "/einstellungen", section: "system" },
  /** Eigener Abschnitt in der Sidebar (zwischen Navigation und System), damit Büro/Admin die Feld-Ansicht finden. */
  { key: "mein_tag", label: "Mein Tag", href: "/tag", section: "einsatz" },
  { key: "monteur_profil", label: "Profil", href: "/profil", section: "system" },
];

const roleVisibility: Record<RoleType, AppPageKey[]> = {
  admin: ["dashboard", "projekte", "kalender", "mitarbeiter", "bestellformulare", "zeiterfassung", "zahlungen", "kontakte", "einstellungen", "mein_tag"],
  office: ["dashboard", "projekte", "kalender", "mitarbeiter", "zeiterfassung", "zahlungen", "kontakte", "einstellungen", "mein_tag"],
  technician: ["mein_tag", "monteur_profil"],
};

export function getVisibleSidebarItems(role: RoleType) {
  const visible = new Set(roleVisibility[role]);
  return sidebarItems.filter((item) => visible.has(item.key));
}
