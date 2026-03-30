import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import {
  listReportOutcomeOptions,
  listReportSelectOptions,
  listSupplierTemplates,
  listArticles,
  getProjectBundle,
} from "@/lib/db/repository";
import { RapportCreateClient } from "@/components/app/rapport-create-client";
import { buttonVariants } from "@/components/ui/button-variants";

export const metadata = { title: "Neuer Rapport" };

export default async function RapportNeuForProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const { projectId } = await params;
  const bundle = await getProjectBundle(projectId);
  if (!bundle) notFound();

  const [outcomeOptions, locationOptions, supplierTemplates, articles] = await Promise.all([
    listReportOutcomeOptions(),
    listReportSelectOptions("ort"),
    listSupplierTemplates(),
    listArticles(),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rapporte</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Neuer Rapport</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {bundle.project.title}
              {bundle.contact?.name ? ` · ${bundle.contact.name}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/rapporte" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Zur Rapportliste
            </Link>
            <Link href={`/projekte/${projectId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Zum Projekt
            </Link>
          </div>
        </div>
      </div>

      <RapportCreateClient
        projectId={bundle.project.id}
        outcomeOptions={outcomeOptions}
        locationOptions={locationOptions}
        supplierTemplates={supplierTemplates}
        articles={articles}
        actorRole={session.role}
      />
    </section>
  );
}
