import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProjekteHydrationBoundary } from "@/components/app/projekte-hydration-boundary";
import { ProjektePageClient } from "@/components/app/projekte-page-client";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { getLayoutSession } from "@/lib/auth/session";
import { buildProjekteDehydratedState } from "@/lib/projekte/server-bootstrap";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function ProjektePage() {
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

  const dehydratedState = await buildProjekteDehydratedState(session.organizationId);

  return (
    <ProjekteHydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="flex justify-center py-16" role="status" aria-live="polite">
            <BauflipLoading size="sm" label="Projekte werden geladen …" />
          </div>
        }
      >
        <ProjektePageClient supabaseConfigured={hasSupabaseConfig()} />
      </Suspense>
    </ProjekteHydrationBoundary>
  );
}
