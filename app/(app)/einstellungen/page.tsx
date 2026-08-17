import { redirect } from "next/navigation";
import { Suspense } from "react";
import { QueryHydrationBoundary } from "@/components/app/query-hydration-boundary";
import { EinstellungenPageClient } from "@/components/app/einstellungen-page-client";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { ensurePageMfaSatisfied } from "@/lib/auth/organization";
import { getLayoutSession } from "@/lib/auth/session";
import { buildEinstellungenDehydratedState } from "@/lib/einstellungen/server-bootstrap";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const session = await getLayoutSession();
  if (!session) {
    redirect("/anmeldung");
  }
  await ensurePageMfaSatisfied(session);

  const dehydratedState = await buildEinstellungenDehydratedState(session);

  return (
    <QueryHydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="flex justify-center py-16" role="status" aria-live="polite">
            <BauflipLoading size="sm" label="Einstellungen werden geladen …" />
          </div>
        }
      >
        <EinstellungenPageClient />
      </Suspense>
    </QueryHydrationBoundary>
  );
}
