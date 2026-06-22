import { Suspense } from "react";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { ProjektePageClient } from "@/components/app/projekte-page-client";
import { BauflipLoading } from "@/components/ui/bauflip-loading";

export default function ProjektePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16" role="status" aria-live="polite">
          <BauflipLoading size="sm" label="Projekte werden geladen …" />
        </div>
      }
    >
      <ProjektePageClient supabaseConfigured={hasSupabaseConfig()} />
    </Suspense>
  );
}
