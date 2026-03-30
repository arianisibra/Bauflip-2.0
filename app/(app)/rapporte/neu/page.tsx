import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { listProjectsWithContactNames } from "@/lib/db/repository";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { ChevronRight, FolderOpen } from "lucide-react";

export const metadata = { title: "Rapport — Projekt wählen" };

export default async function RapportNeuPickProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const { projectId } = await searchParams;
  if (projectId?.trim()) {
    redirect(`/rapporte/neu/${projectId.trim()}`);
  }

  const projects = await listProjectsWithContactNames();

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 border-b border-border/60 pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rapporte</p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Neuer Rapport</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Wählen Sie das Projekt, für das Sie den Rapport erfassen möchten. Zuerst den Rapport, anschliessend optional
          das Bestellformular.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Keine Projekte</CardTitle>
            <CardDescription>Es sind noch keine Projekte vorhanden.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Projekt wählen</CardTitle>
            <CardDescription>Monteur-Rapport und Lieferantenbestellung werden diesem Projekt zugeordnet.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 p-0">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/rapporte/neu/${p.id}`}
                className="flex items-center justify-between gap-3 border-t border-border/50 px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-muted/40"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{p.title}</span>
                  {p.contactName ? (
                    <span className="mt-0.5 block text-sm text-muted-foreground">{p.contactName}</span>
                  ) : null}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        <Link href="/rapporte" className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1.5 px-0" })}>
          <FolderOpen className="size-4" />
          Zur Rapportliste
        </Link>
      </p>
    </section>
  );
}
