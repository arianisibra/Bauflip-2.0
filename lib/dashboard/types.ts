import { z } from "zod";

export const widgetIds = [
  "snapshot_kpis",
  "betrieb_erfolg",
  "week_tasks",
  "pipeline_status",
  "urgent_projects",
  "offers_invoices",
  "logistics_pulse",
  "team_compact",
  "chat_module",
  "shortcuts",
  "recent_projects",
] as const;

export type WidgetId = (typeof widgetIds)[number];

export type DashboardWidgetPlacement = {
  instanceId: string;
  widgetId: WidgetId;
};

export type DashboardLayout = {
  version: 1;
  items: DashboardWidgetPlacement[];
};

const widgetIdSchema = z.enum(widgetIds as unknown as [WidgetId, ...WidgetId[]]);

export const dashboardLayoutSchema = z.object({
  version: z.literal(1),
  items: z.array(
    z.object({
      instanceId: z.string().min(1),
      widgetId: widgetIdSchema,
    }),
  ),
});

export function parseDashboardLayout(raw: unknown): DashboardLayout | null {
  const parsed = dashboardLayoutSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data as DashboardLayout;
}
