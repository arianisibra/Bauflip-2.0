import type { AppPageKey, RoleType, SidebarItem } from "@/lib/domain/types";

export const sidebarItems: SidebarItem[] = [
  { key: "projekte", label: "Projekte", href: "/projekte", section: "navigation" },
  { key: "kalender", label: "Kalender", href: "/kalender", section: "navigation" },
  { key: "mitarbeiter", label: "Mitarbeiter", href: "/mitarbeiter", section: "navigation" },
  {
    key: "bestellformulare",
    label: "Bestellformulare",
    href: "/bestellformulare",
    section: "navigation",
  },
  { key: "einstellungen", label: "Einstellungen", href: "/einstellungen", section: "system" },
  { key: "mein_tag", label: "Mein Tag", href: "/tag", section: "navigation" },
  { key: "monteur_profil", label: "Profil", href: "/profil", section: "system" },
];

const roleVisibility: Record<RoleType, AppPageKey[]> = {
  admin: ["projekte", "kalender", "mitarbeiter", "bestellformulare", "einstellungen"],
  office: ["projekte", "kalender", "mitarbeiter", "einstellungen"],
  technician: ["mein_tag", "monteur_profil"],
};

export function getVisibleSidebarItems(role: RoleType) {
  const visible = new Set(roleVisibility[role]);
  return sidebarItems.filter((item) => visible.has(item.key));
}
