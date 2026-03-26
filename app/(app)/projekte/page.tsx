import { getCurrentSession } from "@/lib/auth/session";
import { listContacts, listProjectsWithContactNames } from "@/lib/db/repository";
import { ProjekteListClient } from "@/components/app/projekte-list-client";

type Props = {
  searchParams: Promise<{ openProjectId?: string }>;
};

export default async function ProjektePage(props: Props) {
  const session = await getCurrentSession();
  const sp = await props.searchParams;
  const [projects, contacts] = await Promise.all([listProjectsWithContactNames(), listContacts()]);
  const canEditProjectSheet = session?.role === "office" || session?.role === "admin";

  return (
    <section className="flex flex-col gap-4">
      <ProjekteListClient
        projects={projects}
        contacts={contacts}
        canEditProjectSheet={canEditProjectSheet}
        initialOpenProjectId={sp.openProjectId}
      />
    </section>
  );
}
