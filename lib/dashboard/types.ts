import { z } from "zod";

export const widgetIds = [
  "snapshot_kpis",
  "betrieb_erfolg",
  "week_tasks",
  "offers_invoices",
  "team_compact",
  "chat_module",
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

const relaxedLayoutSchema = z.object({
  version: z.literal(1),
  items: z.array(
    z.object({
      instanceId: z.string().min(1),
      widgetId: z.string(),
    }),
  ),
});

const allowedWidgetIds = new Set<string>(widgetIds);

export function parseDashboardLayout(raw: unknown): DashboardLayout | null {
  const strict = dashboardLayoutSchema.safeParse(raw);
  if (strict.success) {
    return strict.data as DashboardLayout;
  }
  const loose = relaxedLayoutSchema.safeParse(raw);
  if (!loose.success) {
    return null;
  }
  const items = loose.data.items.filter((i) => allowedWidgetIds.has(i.widgetId)) as DashboardWidgetPlacement[];
  if (items.length === 0) {
    return null;
  }
  return { version: 1, items };
}
