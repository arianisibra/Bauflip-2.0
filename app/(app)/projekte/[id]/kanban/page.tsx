import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProjectBundle, listKanbanCards, listKanbanColumns } from "@/lib/db/repository";
import { renameKanbanColumnAction } from "@/app/(app)/actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { statusLabels } from "@/lib/workflow/project-workflow";

type Params = {
  params: Promise<{ id: string }>;
};

const colorClasses: Record<string, string> = {
  blue: "border-blue-300 bg-blue-50",
  orange: "border-orange-300 bg-orange-50",
  green: "border-emerald-300 bg-emerald-50",
  violet: "border-violet-300 bg-violet-50",
  slate: "border-slate-300 bg-slate-50",
};

export default async function ProjektKanbanPage({ params }: Params) {
  const { id } = await params;
  const bundle = await getProjectBundle(id);

  if (!bundle) {
    notFound();
  }

  const [kanbanColumns, kanbanCards] = await Promise.all([
    listKanbanColumns(id),
    listKanbanCards(id),
  ]);

  return (
    <section className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/projekte/${id}`} />} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="size-4" />
          Zum Projekt
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{bundle.project.title}</h1>
          <StatusBadge status={bundle.project.status} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Spaltennamen sind frei anpassbar. Karten werden automatisch verschoben wenn der Projektstatus wechselt.
      </p>

      {kanbanColumns.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          Noch keine Kanban-Spalten für dieses Projekt vorhanden.
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div
            className="flex gap-4"
            style={{ minWidth: `${kanbanColumns.length * 240}px` }}
          >
            {kanbanColumns.map((column) => {
              const cards = kanbanCards.filter((card) => card.columnId === column.id);
              return (
                <div
                  key={column.id}
                  className={`flex w-[220px] shrink-0 flex-col rounded-xl border p-3 ${colorClasses[column.color] ?? colorClasses.slate}`}
                >
                  {/* Spalten-Header mit umbenennen */}
                  <form action={renameKanbanColumnAction} className="mb-2 flex items-center gap-1.5">
                    <input type="hidden" name="columnId" value={column.id} />
                    <Input
                      name="title"
                      defaultValue={column.title}
                      className="h-7 border-0 bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:bg-white focus-visible:ring-1"
                    />
                    <Button size="sm" type="submit" variant="ghost" className="h-7 px-2 text-xs">
                      OK
                    </Button>
                  </form>
                  <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {statusLabels[column.status]}
                  </p>

                  {/* Karten */}
                  <div className="flex flex-col gap-2">
                    {cards.length === 0 ? (
                      <p className="rounded-md border border-dashed px-2 py-3 text-center text-xs text-muted-foreground">
                        Keine Karten
                      </p>
                    ) : (
                      cards.map((card) => (
                        <div
                          key={card.id}
                          className="rounded-lg border bg-white px-3 py-2 text-sm shadow-sm"
                        >
                          <p className="font-medium leading-snug">{card.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {statusLabels[card.status]}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
