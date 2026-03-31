import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getProjectBundle } from "@/lib/db/repository";
import { statusLabels } from "@/lib/workflow/project-workflow";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function TechnicianAppointmentPage({ params }: Params) {
  const session = await getCurrentSession();
  if (!session) {
    return null;
  }

  const { id } = await params;
  const bundle = await getProjectBundle(id);
  if (!bundle) {
    notFound();
  }

  const project = bundle.project;
  const isAssigned =
    bundle.appointments?.some((a) => a.assignedTechnicianId === session.user.id) ?? false;
  if (!isAssigned) {
    notFound();
  }

  return (
    <section className="flex flex-col gap-5 pb-4">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Projekt
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">{project.title}</h1>
        <p className="text-xs text-slate-600">
          {project.contactName} · {project.siteAddressShort}
        </p>
        <p className="text-xs text-slate-500">
          Status: <span className="font-medium text-slate-800">{statusLabels[project.status]}</span>
        </p>
      </header>

      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Adresse</p>
        <p className="text-slate-800">{project.siteAddressFull}</p>
        {project.mapsUrl ? (
          <Link
            href={project.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-xs font-medium text-sky-700 underline"
          >
            Route in Maps öffnen
          </Link>
        ) : null}
      </div>

      <div className="space-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auftrag</p>
        <p className="whitespace-pre-line text-slate-800">
          {project.technicianNotes ||
            project.intakeOriginalText ||
            "Keine spezifischen Hinweise hinterlegt. Bei Unsicherheit bitte Büro kontaktieren."}
        </p>
      </div>

      {bundle.property || bundle.workType ? (
        <div className="space-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anlage</p>
          {bundle.property ? (
            <p className="text-sm text-slate-800">
              {bundle.property.name}
              {bundle.property.street ? ` · ${bundle.property.street}` : ""}
            </p>
          ) : null}
          {bundle.workType ? (
            <p className="text-xs text-slate-600">Arbeitsart: {bundle.workType.name}</p>
          ) : null}
        </div>
      ) : null}

      <Link
        href={`/rapport/${project.id}`}
        className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
      >
        Rapport ausfüllen
      </Link>
      <Link
        href="/tag"
        className="inline-flex items-center justify-center text-xs font-medium text-slate-600 underline"
      >
        Zurück zu heute
      </Link>
    </section>
  );
}

