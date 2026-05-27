import { TriangleAlert } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { listAssignableProfiles, listProjectsForOffice } from "@/lib/db/repository";
import { hasSupabaseConfig } from "@/lib/supabase/server";
import { sanitizeAppReturnTo } from "@/lib/navigation/app-return-to";
import { ProjekteListClient } from "@/components/app/projekte-list-client";

type Props = {
  /** `sheet` wird vom Kalender verwendet — gleiche Bedeutung wie `openProjectId`. */
  searchParams: Promise<{ openProjectId?: string; sheet?: string; from?: string; returnTo?: string }>;
};

export default async function ProjektePage(props: Props) {
  const searchParams = (await props.searchParams) ?? {};
  const [session, projects, technicians] = await Promise.all([
    getCurrentSession(),
    listProjectsForOffice(),
    listAssignableProfiles(),
  ]);
  const rawOpen =
    typeof searchParams.openProjectId === "string" ? searchParams.openProjectId.trim() : "";
  const rawSheet = typeof searchParams.sheet === "string" ? searchParams.sheet.trim() : "";
  const openSource = searchParams.from === "kalender" ? "kalender" : undefined;
  const returnTo = sanitizeAppReturnTo(
    typeof searchParams.returnTo === "string" ? searchParams.returnTo : null,
  );
  const openProjectId = rawOpen || rawSheet || undefined;
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
        initialOpenProjectId={openProjectId}
        initialOpenSource={openSource}
        initialReturnTo={returnTo}
      />
    </section>
  );
}
