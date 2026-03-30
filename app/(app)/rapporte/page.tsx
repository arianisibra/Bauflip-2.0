import Link from "next/link";
import { listTechnicianReports } from "@/lib/db/repository";
import { statusLabels } from "@/lib/workflow/project-workflow";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { CalendarDays, Download, FileText, FolderOpen, Plus, UserRound } from "lucide-react";

const outcomeLabel: Record<string, string> = {
  direkt_geloest: "Direkt gelöst",
  ersatzteil_noetig: "Ersatzteil nötig",
  werkstatt_noetig: "Werkstatt nötig",
  vollersatz_noetig: "Vollersatz nötig",
};

function shortDateTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function RapportePage() {
  const reports = await listTechnicianReports();

  const byProject = new Map<
    string,
    {
      projectId: string;
      projectTitle: string;
      projectStatus: string;
      contactName: string | null;
      items: typeof reports;
    }
  >();

  for (const report of reports) {
    const existing = byProject.get(report.projectId);
    if (existing) {
      existing.items.push(report);
      continue;
    }
    byProject.set(report.projectId, {
      projectId: report.projectId,
      projectTitle: report.projectTitle,
      projectStatus: report.projectStatus,
      contactName: report.contactName,
      items: [report],
    });
  }

  const grouped = [...byProject.values()].sort((a, b) => {
    const ta = a.items[0]?.createdAt ?? "";
    const tb = b.items[0]?.createdAt ?? "";
    return tb.localeCompare(ta);
  });

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Rapporte</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Monteur-Rapporte aus dem Feld erscheinen hier automatisch pro Projekt. Jeder Eintrag enthält die
            Rapport-Details und kann als PDF heruntergeladen werden.
          </p>
        </div>
        <Link href="/rapporte/neu" className={cn(buttonVariants({ variant: "default", size: "sm" }), "shrink-0 gap-2")}>
          <Plus className="size-4" />
          Neuer Rapport
        </Link>
      </div>

      {grouped.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Noch keine Rapporte vorhanden</CardTitle>
            <CardDescription>
              Sobald ein Monteur im Projekt einen Rapport erstellt, erscheint er hier automatisch.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map((group) => (
            <Card key={group.projectId} size="sm" className="overflow-hidden border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
              <CardHeader className="border-b border-border/50 bg-muted/20">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm font-semibold tracking-tight">{group.projectTitle}</CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="size-3.5" />
                        {group.contactName ?? "—"}
                      </span>
                      <span className="hidden sm:inline">·</span>
                      <span>{statusLabels[group.projectStatus as keyof typeof statusLabels] ?? group.projectStatus}</span>
                    </CardDescription>
                  </div>
                  <Link href={`/projekte/${group.projectId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <FolderOpen className="size-4" />
                    Projekt öffnen
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-3">
                {group.items.map((report) => (
                  <article
                    key={report.id}
                    className="rounded-lg border border-border/60 bg-card p-3 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{report.summary || "Rapport"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{report.workDescription || "—"}</p>
                      </div>
                      <Badge variant="outline" className="font-medium">
                        {outcomeLabel[report.outcome] ?? report.outcome}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        {shortDateTime(report.createdAt)}
                      </span>
                      <span className="hidden sm:inline">·</span>
                      <span>
                        Zeit vor Ort:{" "}
                        <span className="font-medium text-foreground">
                          {report.timeSpentMinutes != null ? `${report.timeSpentMinutes} min` : "—"}
                        </span>
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/rapporte/${report.id}/pdf`}
                        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "inline-flex items-center gap-2")}
                      >
                        <Download className="size-4" />
                        PDF herunterladen
                      </Link>
                      <Link
                        href={`/projekte/${group.projectId}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex items-center gap-2")}
                      >
                        <FileText className="size-4" />
                        Zum Projekt
                      </Link>
                    </div>
                  </article>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
