import Link from "next/link";
import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomizableDashboard } from "@/components/dashboard/customizable-dashboard";
import { saveDashboardLayoutAction } from "@/app/(app)/dashboard-actions";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getCompanyKpis,
  getDashboardLayout,
  listAssignableProfiles,
  listEmployeeStats,
  listProjects,
  listWeekTasks,
} from "@/lib/db/repository";
import { defaultDashboardLayout } from "@/lib/dashboard/default-layout";
import { sanitizeLayoutForRole } from "@/lib/dashboard/sanitize";
import type { DashboardPageData } from "@/lib/dashboard/page-data";
import type { DashboardLayout } from "@/lib/dashboard/types";
import { hasSupabaseConfig } from "@/lib/supabase/server";

function ensureChatModule(layout: DashboardLayout): DashboardLayout {
  const hasChat = layout.items.some((item) => item.widgetId === "chat_module");
  if (hasChat) {
    return layout;
  }
  return {
    ...layout,
    items: [...layout.items, { instanceId: crypto.randomUUID(), widgetId: "chat_module" }],
  };
}

export default async function ArbeitspoolPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/anmeldung");
  }

  const supabaseConfigured = hasSupabaseConfig();

  const [projects, weekTasks, teamCalendarProfiles, kpis, employeeStats, storedLayout] = await Promise.all([
    listProjects(),
    listWeekTasks(),
    listAssignableProfiles(),
    getCompanyKpis(),
    listEmployeeStats(),
    getDashboardLayout(session.profile.id),
  ]);

  const openCount = projects.filter((project) => project.status !== "abgeschlossen").length;
  const invoiceReadyCount = projects.filter((project) => project.status === "rechnung").length;

  const dashboardData: DashboardPageData = {
    projects,
    weekTasks,
    teamCalendarProfiles,
    kpis,
    employeeStats,
    role: session.role,
    snapshot: {
      openCount,
      invoiceReadyCount,
    },
  };

  const layout = ensureChatModule(
    sanitizeLayoutForRole(storedLayout ?? defaultDashboardLayout(session.role), session.role),
  );

  return (
    <section className="flex flex-col gap-5">
      {!supabaseConfigured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4" />
            Supabase ist nicht konfiguriert. Es werden Mock-Daten verwendet.
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Übersicht</h1>
          <p className="text-sm text-muted-foreground">
            Persönliches Dashboard — Bausteine anordnen, hinzufügen oder ausblenden.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/projekte" />} variant="outline" size="sm">
          Alle Projekte
        </Button>
      </div>

      <CustomizableDashboard initialLayout={layout} data={dashboardData} saveAction={saveDashboardLayoutAction} />
    </section>
  );
}
