import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BestellformulareHydrationBoundary } from "@/components/app/bestellformulare-hydration-boundary";
import { BestellformularePageClient } from "@/components/app/bestellformulare-page-client";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { getLayoutSession } from "@/lib/auth/session";
import { buildBestellformulareDehydratedState } from "@/lib/bestellformulare/server-bootstrap";

export const dynamic = "force-dynamic";

export default async function BestellformularePage() {
  const session = await getLayoutSession();
  if (!session || session.role !== "admin") {
    redirect("/projekte");
  }
  if (!session.organizationId) {
    redirect("/onboarding");
  }

  const dehydratedState = await buildBestellformulareDehydratedState(session.organizationId);

  return (
    <BestellformulareHydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="flex justify-center py-16" role="status" aria-live="polite">
            <BauflipLoading size="sm" label="Bestellformulare werden geladen …" />
          </div>
        }
      >
        <BestellformularePageClient />
      </Suspense>
    </BestellformulareHydrationBoundary>
  );
}
