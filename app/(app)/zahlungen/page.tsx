import { redirect } from "next/navigation";
import { Suspense } from "react";
import { QueryHydrationBoundary } from "@/components/app/query-hydration-boundary";
import { ZahlungenPageClient } from "@/components/app/zahlungen-page-client";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { getLayoutSession } from "@/lib/auth/session";
import { buildZahlungenDehydratedState } from "@/lib/zahlungen/server-bootstrap";

export const dynamic = "force-dynamic";

export default async function ZahlungenPage() {
  const session = await getLayoutSession();
  if (!session || (session.role !== "admin" && session.role !== "office")) {
    redirect("/projekte");
  }
  if (!session.organizationId) {
    redirect("/onboarding");
  }

  const dehydratedState = await buildZahlungenDehydratedState(session.organizationId);

  return (
    <QueryHydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="flex justify-center py-16" role="status" aria-live="polite">
            <BauflipLoading size="sm" label="Zahlungen werden geladen …" />
          </div>
        }
      >
        <ZahlungenPageClient />
      </Suspense>
    </QueryHydrationBoundary>
  );
}
