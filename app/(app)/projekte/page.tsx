import { redirect } from "next/navigation";
import { Suspense } from "react";
import { QueryHydrationBoundary } from "@/components/app/query-hydration-boundary";
import { ProjektePageClient } from "@/components/app/projekte-page-client";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { getLayoutSession } from "@/lib/auth/session";
import { parseProjekteListUrlFilter } from "@/lib/navigation/projekte-list-navigation";
import { buildProjekteDehydratedState } from "@/lib/projekte/server-bootstrap";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    q?: string;
    openProjectId?: string;
    sheet?: string;
    from?: string;
    returnTo?: string;
  }>;
};

export default async function ProjektePage({ searchParams }: PageProps) {
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
  const listFilter = parseProjekteListUrlFilter({
    get: (key: string) => (key === "status" ? sp.status ?? null : null),
  });
  const dehydratedState = await buildProjekteDehydratedState(
    session.organizationId,
    listFilter,
    sp.q ?? null,
  );

  return (
    <QueryHydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="flex justify-center py-16" role="status" aria-live="polite">
            <BauflipLoading size="sm" label="Projekte werden geladen …" />
          </div>
        }
      >
        <ProjektePageClient supabaseConfigured={hasSupabaseConfig()} />
      </Suspense>
    </QueryHydrationBoundary>
  );
}
