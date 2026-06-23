import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TagHydrationBoundary } from "@/components/app/tag-hydration-boundary";
import { TagPageClient } from "@/components/app/tag-page-client";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { getLayoutSession } from "@/lib/auth/session";
import { canAccessTechFieldRoutes } from "@/lib/domain/types";
import { buildTagDehydratedState } from "@/lib/tag/server-bootstrap";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const session = await getLayoutSession();
  if (!session) {
    redirect("/anmeldung");
  }
  if (!canAccessTechFieldRoutes(session.role)) {
    redirect("/");
  }

  const dehydratedState = await buildTagDehydratedState(session);

  return (
    <TagHydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="flex min-h-[min(50vh,24rem)] items-center justify-center py-12" role="status" aria-live="polite">
            <BauflipLoading label="Tagesübersicht wird geladen …" size="md" />
          </div>
        }
      >
        <TagPageClient />
      </Suspense>
    </TagHydrationBoundary>
  );
}
