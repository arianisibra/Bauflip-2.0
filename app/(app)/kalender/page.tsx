import { redirect } from "next/navigation";
import { Suspense } from "react";
import { KalenderHydrationBoundary } from "@/components/app/kalender-hydration-boundary";
import { KalenderPageClient } from "@/components/app/kalender-page-client";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { getLayoutSession } from "@/lib/auth/session";
import { buildKalenderDehydratedState } from "@/lib/kalender/server-bootstrap";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    view?: string;
    day?: string;
    tech?: string;
    sort?: string;
  }>;
};

export default async function KalenderPage({ searchParams }: PageProps) {
  const session = await getLayoutSession();
  if (!session) {
    redirect("/anmeldung");
  }
  if (session.role !== "office" && session.role !== "admin") {
    redirect("/");
  }
  if (!session.organizationId) {
    redirect("/onboarding");
  }

  const sp = await searchParams;
  const dehydratedState = await buildKalenderDehydratedState(sp);

  return (
    <KalenderHydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="flex justify-center py-16" role="status" aria-live="polite">
            <BauflipLoading size="sm" label="Kalender wird geladen …" />
          </div>
        }
      >
        <KalenderPageClient />
      </Suspense>
    </KalenderHydrationBoundary>
  );
}
