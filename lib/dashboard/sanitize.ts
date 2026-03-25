import type { RoleType } from "@/lib/domain/types";
import { defaultDashboardLayout } from "./default-layout";
import { isWidgetAllowedForRole } from "./widget-registry";
import type { DashboardLayout } from "./types";

export function sanitizeLayoutForRole(layout: DashboardLayout, role: RoleType): DashboardLayout {
  const filtered = {
    version: 1 as const,
    items: layout.items.filter((i) => isWidgetAllowedForRole(i.widgetId, role)),
  };
  if (filtered.items.length === 0) {
    return defaultDashboardLayout(role);
  }
  return filtered;
}
