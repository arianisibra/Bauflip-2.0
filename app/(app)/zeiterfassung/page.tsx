import { redirect } from "next/navigation";
import { Suspense } from "react";
import { QueryHydrationBoundary } from "@/components/app/query-hydration-boundary";
import { ZeiterfassungPageClient } from "@/components/app/zeiterfassung-page-client";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { ensurePageMfaSatisfied } from "@/lib/auth/organization";
import { getLayoutSession } from "@/lib/auth/session";
import { buildZeiterfassungDehydratedState } from "@/lib/zeiterfassung/server-bootstrap";

export const dynamic = "force-dynamic";

export default async function ZeiterfassungPage() {
  const session = await getLayoutSession();
  if (!session || (session.role !== "admin" && session.role !== "office")) {
    redirect("/projekte");
  }
  if (!session.organizationId) {
    redirect("/onboarding");
  }
  await ensurePageMfaSatisfied(session);

  const dehydratedState = await buildZeiterfassungDehydratedState(session.organizationId);

  return (
    <QueryHydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="flex justify-center py-16" role="status" aria-live="polite">
            <BauflipLoading size="sm" label="Zeiterfassung wird geladen …" />
          </div>
        }
      >
        <ZeiterfassungPageClient />
      </Suspense>
    </QueryHydrationBoundary>
  );
}
