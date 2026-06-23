import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WochenplanHydrationBoundary } from "@/components/app/wochenplan-hydration-boundary";
import { WochenplanPageClient } from "@/components/app/wochenplan-page-client";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { getLayoutSession } from "@/lib/auth/session";
import { todayKeySwiss } from "@/lib/date/swiss";
import { canAccessTechFieldRoutes } from "@/lib/domain/types";
import { parseTechCalendarUrlStateFromRecord } from "@/lib/navigation/tech-field-navigation";
import { buildWochenplanDehydratedState } from "@/lib/tech/server-bootstrap";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TechKalenderPage({ searchParams }: PageProps) {
  const session = await getLayoutSession();
  if (!session) {
    redirect("/anmeldung");
  }
  if (!canAccessTechFieldRoutes(session.role)) {
    redirect("/");
  }

  const sp = await searchParams;
  const urlState = parseTechCalendarUrlStateFromRecord(sp, todayKeySwiss());
  const dehydratedState = await buildWochenplanDehydratedState(session, urlState);

  return (
    <WochenplanHydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="flex min-h-[min(50vh,24rem)] items-center justify-center py-12" role="status" aria-live="polite">
            <BauflipLoading label="Kalender wird geladen …" size="md" />
          </div>
        }
      >
        <WochenplanPageClient />
      </Suspense>
    </WochenplanHydrationBoundary>
  );
}
