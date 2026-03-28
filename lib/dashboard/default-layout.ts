import type { RoleType } from "@/lib/domain/types";
import type { DashboardLayout, WidgetId } from "./types";

/** Feste Instanz-IDs für die Standard-Anordnung (nur Defaults, neue Blöcke erhalten frische UUIDs). */
const I = {
  a: "10000000-0000-4000-8000-000000000001",
  b: "10000000-0000-4000-8000-000000000002",
  c: "10000000-0000-4000-8000-000000000003",
  d: "10000000-0000-4000-8000-000000000004",
  e: "10000000-0000-4000-8000-000000000005",
  f: "10000000-0000-4000-8000-000000000006",
  g: "10000000-0000-4000-8000-000000000007",
  h: "10000000-0000-4000-8000-000000000008",
  i: "10000000-0000-4000-8000-000000000009",
  j: "10000000-0000-4000-8000-00000000000a",
  k: "10000000-0000-4000-8000-00000000000b",
} as const;

const managerOrder: { instanceId: string; widgetId: WidgetId }[] = [
  { instanceId: I.a, widgetId: "snapshot_kpis" },
  { instanceId: I.b, widgetId: "week_tasks" },
  { instanceId: I.d, widgetId: "betrieb_erfolg" },
  { instanceId: I.e, widgetId: "pipeline_status" },
  { instanceId: I.f, widgetId: "offers_invoices" },
  { instanceId: I.g, widgetId: "logistics_pulse" },
  { instanceId: I.h, widgetId: "team_compact" },
  { instanceId: I.i, widgetId: "chat_module" },
  { instanceId: I.j, widgetId: "recent_projects" },
  { instanceId: I.k, widgetId: "shortcuts" },
];

const fieldOrder: { instanceId: string; widgetId: WidgetId }[] = [
  { instanceId: I.a, widgetId: "snapshot_kpis" },
  { instanceId: I.b, widgetId: "week_tasks" },
  { instanceId: I.d, widgetId: "chat_module" },
  { instanceId: I.e, widgetId: "recent_projects" },
  { instanceId: I.f, widgetId: "shortcuts" },
];

export function defaultDashboardLayout(role: RoleType): DashboardLayout {
  const items = role === "technician" ? fieldOrder : managerOrder;
  return { version: 1, items };
}
