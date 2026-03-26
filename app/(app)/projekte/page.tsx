import { getCurrentSession } from "@/lib/auth/session";
import { listContacts, listProjectsWithContactNames } from "@/lib/db/repository";
import { ProjekteListClient } from "@/components/app/projekte-list-client";

export default async function ProjektePage() {
  const session = await getCurrentSession();
  const [projects, contacts] = await Promise.all([listProjectsWithContactNames(), listContacts()]);
  const canEditProjectSheet = session?.role === "office" || session?.role === "admin";

  return (
    <section className="flex flex-col gap-4">
      <ProjekteListClient projects={projects} contacts={contacts} canEditProjectSheet={canEditProjectSheet} />
    </section>
  );
}
