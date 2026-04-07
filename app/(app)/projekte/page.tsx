import { TriangleAlert } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { listAssignableProfiles, listProjectsForOffice } from "@/lib/db/repository";
import { hasSupabaseConfig } from "@/lib/supabase/server";
import { ProjekteListClient } from "@/components/app/projekte-list-client";

type Props = {
  searchParams: Promise<{ openProjectId?: string }>;
};

export default async function ProjektePage(props: Props) {
  const session = await getCurrentSession();
  const sp = await props.searchParams;
  const [projects, technicians] = await Promise.all([listProjectsForOffice(), listAssignableProfiles()]);
  const canEditProjectSheet = session?.role === "office" || session?.role === "admin";
  const supabaseConfigured = hasSupabaseConfig();

  return (
    <section className="flex flex-col gap-4">
      {!supabaseConfigured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4 shrink-0" />
            Supabase ist nicht konfiguriert. Es werden Demo-Daten verwendet.
          </div>
        </div>
      ) : null}
      <ProjekteListClient
        projects={projects}
        technicians={technicians}
        canEditProjectSheet={canEditProjectSheet}
        initialOpenProjectId={sp.openProjectId}
      />
    </section>
  );
}
