import { redirect } from "next/navigation";
import { Suspense } from "react";
import { KontaktePageClient } from "@/components/app/kontakte-page-client";
import { QueryHydrationBoundary } from "@/components/app/query-hydration-boundary";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { getLayoutSession } from "@/lib/auth/session";
import { buildKontakteDehydratedState } from "@/lib/kontakte/server-bootstrap";

export const dynamic = "force-dynamic";

export default async function KontaktePage() {
  const session = await getLayoutSession();
  if (!session || (session.role !== "admin" && session.role !== "office")) {
    redirect("/projekte");
  }
  if (!session.organizationId) {
    redirect("/onboarding");
  }

  const dehydratedState = await buildKontakteDehydratedState(session.organizationId);

  return (
    <QueryHydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="flex justify-center py-16" role="status" aria-live="polite">
            <BauflipLoading size="sm" label="Kontakte werden geladen …" />
          </div>
        }
      >
        <KontaktePageClient />
      </Suspense>
    </QueryHydrationBoundary>
  );
}
