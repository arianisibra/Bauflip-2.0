import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarRange,
  ClipboardList,
  Gauge,
  MessageSquare,
  Package,
  Users,
} from "lucide-react";
import type { RoleType } from "@/lib/domain/types";
import type { WidgetId } from "./types";

export type WidgetMeta = {
  id: WidgetId;
  title: string;
  description: string;
  Icon: LucideIcon;
  /** Leere Liste = alle Rollen */
  roles?: RoleType[];
};

export const WIDGET_REGISTRY: WidgetMeta[] = [
  {
    id: "snapshot_kpis",
    title: "Tagesüberblick",
    description: "Offene Projekte, Termine, Rechnungsreife.",
    Icon: Gauge,
  },
  {
    id: "betrieb_erfolg",
    title: "Betrieb & Erfolg",
    description: "Umsatz und Kennzahlen.",
    Icon: BarChart3,
    roles: ["admin", "office"],
  },
  {
    id: "week_tasks",
    title: "Woche & Termine",
    description: "Montage und Besichtigungen dieser Kalenderwoche.",
    Icon: CalendarRange,
  },
  {
    id: "offers_invoices",
    title: "Offerten & Rechnungen",
    description: "Offert-Erfolg, offene Rechnungen, Kundenstamm.",
    Icon: ClipboardList,
    roles: ["admin", "office"],
  },
  {
    id: "team_compact",
    title: "Team-Leistung",
    description: "Kurzüberblick Montage & Büro.",
    Icon: Users,
    roles: ["admin", "office"],
  },
  {
    id: "chat_module",
    title: "Chat",
    description: "",
    Icon: MessageSquare,
  },
  {
    id: "recent_projects",
    title: "Zuletzt bearbeitet",
    description: "Aktuelle Projekte nach Eingang.",
    Icon: Package,
  },
];

export function widgetMeta(id: WidgetId): WidgetMeta | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id);
}

export function widgetsForRole(role: RoleType): WidgetMeta[] {
  return WIDGET_REGISTRY.filter((w) => !w.roles || w.roles.includes(role));
}

export function isWidgetAllowedForRole(widgetId: WidgetId, role: RoleType): boolean {
  const m = widgetMeta(widgetId);
  if (!m) {
    return false;
  }
  if (!m.roles?.length) {
    return true;
  }
  return m.roles.includes(role);
}
