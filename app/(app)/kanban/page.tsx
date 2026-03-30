import Link from "next/link";
import { listProjectsWithContactNames } from "@/lib/db/repository";
import { KanbanHubBoard } from "@/components/app/kanban-hub-board";

export default async function KanbanHubPage() {
  const projects = await listProjectsWithContactNames();

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Kanban</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle Projekte nach Ablaufsphase.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-16 text-center text-sm text-muted-foreground">
          Noch keine Projekte — neue Anfragen erscheinen hier automatisch in der passenden Spalte.
        </div>
      ) : (
        <KanbanHubBoard projects={projects} />
      )}
    </section>
  );
}
