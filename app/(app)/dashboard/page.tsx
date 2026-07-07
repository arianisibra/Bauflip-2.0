import { redirect } from "next/navigation";
import { Suspense } from "react";
import { QueryHydrationBoundary } from "@/components/app/query-hydration-boundary";
import { DashboardPageClient } from "@/components/app/dashboard-page-client";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { getLayoutSession } from "@/lib/auth/session";
import { buildDashboardDehydratedState } from "@/lib/dashboard/server-bootstrap";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getLayoutSession();
  if (!session || (session.role !== "admin" && session.role !== "office")) {
    redirect("/projekte");
  }
  if (!session.organizationId) {
    redirect("/onboarding");
  }

  const dehydratedState = await buildDashboardDehydratedState(session.organizationId);

  return (
    <QueryHydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="flex justify-center py-16" role="status" aria-live="polite">
            <BauflipLoading size="sm" label="Auswertungen werden geladen …" />
          </div>
        }
      >
        <DashboardPageClient />
      </Suspense>
    </QueryHydrationBoundary>
  );
}
