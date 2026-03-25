import type { LucideIcon } from "lucide-react";
import {
  AlarmSmoke,
  BarChart3,
  CalendarRange,
  ClipboardList,
  Gauge,
  LayoutGrid,
  Link2,
  Package,
  Truck,
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
    description: "Offene Projekte, Dringlichkeit, Termine, Rechnungsreife.",
    Icon: Gauge,
  },
  {
    id: "betrieb_erfolg",
    title: "Betrieb & Erfolg",
    description: "Umsatz, Deckungsbeitrag, Kennzahlen und Umsatz-Verlauf (Liniendiagramm).",
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
    id: "pipeline_status",
    title: "Projekt-Pipeline",
    description: "Verteilung der Aufträge nach Bearbeitungsstand.",
    Icon: LayoutGrid,
    roles: ["admin", "office"],
  },
  {
    id: "urgent_projects",
    title: "Dringende Fälle",
    description: "Projekte mit Priorität «kritisch».",
    Icon: AlarmSmoke,
  },
  {
    id: "offers_invoices",
    title: "Offerten & Rechnungen",
    description: "Offert-Erfolg, offene Rechnungen, Kundenstamm.",
    Icon: ClipboardList,
    roles: ["admin", "office"],
  },
  {
    id: "logistics_pulse",
    title: "Einkauf & Logistik",
    description: "Bestellungen unterwegs, Termindichte.",
    Icon: Truck,
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
    id: "shortcuts",
    title: "Schnellzugriff",
    description: "Team-Chat, Projekte, Rapporte, Termine.",
    Icon: Link2,
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
