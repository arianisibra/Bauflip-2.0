import Link from "next/link";
import { listProjectsWithContactNames } from "@/lib/db/repository";
import { StatusBadge } from "@/components/app/status-badge";
import { PROJECT_WORKFLOW_STEPS, getWorkflowPhaseIndex } from "@/lib/workflow/project-workflow-rail";
import { statusLabels } from "@/lib/workflow/project-workflow";
import { cn } from "@/lib/utils";

const columnSurface = [
  "border-sky-200/90 bg-sky-50/70",
  "border-cyan-200/90 bg-cyan-50/60",
  "border-teal-200/90 bg-teal-50/50",
  "border-violet-200/90 bg-violet-50/55",
  "border-amber-200/90 bg-amber-50/50",
  "border-orange-200/90 bg-orange-50/45",
  "border-emerald-200/90 bg-emerald-50/50",
  "border-slate-200/90 bg-slate-50/80",
] as const;

export default async function KanbanHubPage() {
  const projects = await listProjectsWithContactNames();

  const byColumn = PROJECT_WORKFLOW_STEPS.map((_, colIndex) =>
    projects.filter((p) => getWorkflowPhaseIndex(p.status) === colIndex),
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Kanban</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle Projekte nach Ablaufsphase — wie ein Team-Board. Karte anklicken öffnet das Projekt.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-16 text-center text-sm text-muted-foreground">
          Noch keine Projekte — neue Anfragen erscheinen hier automatisch in der passenden Spalte.
        </div>
      ) : (
        <div className="flex min-h-[min(70vh,42rem)] gap-3 overflow-x-auto pb-4 pt-1 [scrollbar-gutter:stable]">
          {PROJECT_WORKFLOW_STEPS.map((step, colIndex) => {
            const list = byColumn[colIndex] ?? [];
            const surface = columnSurface[colIndex] ?? columnSurface[0];
            return (
              <div
                key={step.id}
                className={cn(
                  "flex w-[min(100%,17.5rem)] shrink-0 flex-col rounded-xl border shadow-sm",
                  surface,
                )}
              >
                <div className="border-b border-black/5 px-3 py-2.5">
                  <h2 className="text-xs font-bold uppercase leading-snug tracking-wide text-slate-800">
                    {step.label}
                  </h2>
                  <p className="mt-0.5 line-clamp-2 text-[0.65rem] leading-snug text-muted-foreground">{step.hint}</p>
                  <p className="mt-1.5 text-[0.7rem] font-medium tabular-nums text-slate-600">{list.length} Projekt(e)</p>
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
                  {list.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-black/10 bg-white/40 px-2 py-6 text-center text-[0.7rem] text-muted-foreground">
                      —
                    </p>
                  ) : (
                    list.map((p) => (
                      <Link
                        key={p.id}
                        href={`/projekte/${p.id}`}
                        className="block rounded-lg border border-white/80 bg-white/95 p-2.5 shadow-sm ring-1 ring-black/[0.04] transition hover:bg-white hover:shadow-md hover:ring-primary/15"
                      >
                        <p className="text-sm font-semibold leading-snug text-foreground">{p.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{p.contactName ?? "—"}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={p.status} />
                          <span className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[0.65rem] capitalize text-muted-foreground">
                            {p.urgency}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[0.65rem] text-muted-foreground">{statusLabels[p.status]}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Detailliertes Projekt-Board (Spalten pro Status):{" "}
        <Link href="/projekte" className="font-medium text-primary underline-offset-4 hover:underline">
          Projekt öffnen → Projekt-Kanban
        </Link>
      </p>
    </section>
  );
}
