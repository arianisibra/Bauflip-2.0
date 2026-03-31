import Link from "next/link";
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
    <section className="flex flex-col gap-5 pb-4">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Rapport für
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">{bundle.project.title}</h1>
        <p className="text-xs text-slate-600">
          {bundle.project.contactName} · {bundle.project.siteAddressShort}
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-xs text-slate-600 shadow-sm">
        Bitte Rapport vollständig ausfüllen. Bei Unsicherheit kurz im Büro nachfragen – danach hier
        speichern.
      </div>

      <TechnicianRapportTech projectId={projectId} />

      <Link
        href="/tag"
        className="mt-2 inline-flex items-center justify-center text-xs font-medium text-slate-600 underline"
      >
        Zurück zu heute
      </Link>
    </section>
  );
}

