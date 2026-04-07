import type { AppPageKey, RoleType, SidebarItem } from "@/lib/domain/types";

export const sidebarItems: SidebarItem[] = [
  { key: "projekte", label: "Projekte", href: "/projekte", section: "navigation" },
  { key: "mitarbeiter", label: "Mitarbeiter", href: "/mitarbeiter", section: "navigation" },
  { key: "einstellungen", label: "Einstellungen", href: "/einstellungen", section: "system" },
];

const roleVisibility: Record<RoleType, AppPageKey[]> = {
  admin: sidebarItems.map((item) => item.key),
  office: ["projekte", "mitarbeiter", "einstellungen"],
  technician: ["projekte", "einstellungen"],
};

export function getVisibleSidebarItems(role: RoleType) {
  const visible = new Set(roleVisibility[role]);
  return sidebarItems.filter((item) => visible.has(item.key));
}
