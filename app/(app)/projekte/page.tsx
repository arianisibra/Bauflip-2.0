import { getCurrentSession } from "@/lib/auth/session";
import { listProjectsWithContactNames } from "@/lib/db/repository";
import { ProjekteListClient } from "@/components/app/projekte-list-client";

export default async function ProjektePage() {
  const session = await getCurrentSession();
  const projects = await listProjectsWithContactNames();
  const canEditProjectSheet = session?.role === "office" || session?.role === "admin";

  return (
    <section className="flex flex-col gap-4">
      <ProjekteListClient projects={projects} canEditProjectSheet={canEditProjectSheet} />
    </section>
  );
}
