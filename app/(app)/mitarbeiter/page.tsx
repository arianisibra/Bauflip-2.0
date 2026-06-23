import { redirect } from "next/navigation";
import { Suspense } from "react";
import { QueryHydrationBoundary } from "@/components/app/query-hydration-boundary";
import { MitarbeiterPageClient } from "@/components/app/mitarbeiter-page-client";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { getLayoutSession } from "@/lib/auth/session";
import { buildMitarbeiterDehydratedState } from "@/lib/mitarbeiter/server-bootstrap";

export const dynamic = "force-dynamic";

export default async function MitarbeiterPage() {
  const session = await getLayoutSession();
  if (!session || session.role !== "admin") {
    redirect("/projekte");
  }
  if (!session.organizationId) {
    redirect("/onboarding");
  }

  const dehydratedState = await buildMitarbeiterDehydratedState(session.organizationId);

  return (
    <QueryHydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="flex justify-center py-16" role="status" aria-live="polite">
            <BauflipLoading size="sm" label="Mitarbeiter werden geladen …" />
          </div>
        }
      >
        <MitarbeiterPageClient />
      </Suspense>
    </QueryHydrationBoundary>
  );
}
