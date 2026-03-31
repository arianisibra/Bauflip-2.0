import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getProjectBundle } from "@/lib/db/repository";
import { TechnicianRapportTech } from "@/components/app/technician-rapport-tech";

type Params = {
  params: Promise<{ projectId: string }>;
};

export default async function TechnicianRapportPage({ params }: Params) {
  const session = await getCurrentSession();
  if (!session) {
    return null;
  }

  const { projectId } = await params;
  const bundle = await getProjectBundle(projectId);
  if (!bundle) {
    notFound();
  }

  const isAssigned =
    bundle.appointments?.some((a) => a.assignedTechnicianId === session.user.id) ?? false;
  if (!isAssigned) {
    notFound();
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Rapport für
        </p>
        <h1 className="text-lg font-semibold text-slate-900">{bundle.project.title}</h1>
        <p className="text-xs text-slate-600">
          {bundle.project.contactName} · {bundle.project.siteAddressShort}
        </p>
      </header>

      <TechnicianRapportTech projectId={projectId} />
    </section>
  );
}

