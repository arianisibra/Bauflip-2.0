import Link from "next/link";
import { listProjects } from "@/lib/db/repository";
import { Button } from "@/components/ui/button";

export default async function TeamChatPage() {
  const projects = await listProjects();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Team-Chat</h1>
      <p className="text-sm text-muted-foreground">
        Pro Projekt gibt es einen eigenen Chat mit Referenz auf Termine und Anhänge.
      </p>
      <div className="grid gap-3">
        {projects.map((project) => (
          <div key={project.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
            <div>
              <p className="font-medium">{project.title}</p>
              <p className="text-sm text-muted-foreground">Projektchat & Dateien</p>
            </div>
            <Button nativeButton={false} render={<Link href={`/projekte/${project.id}`} />}>
              Chat öffnen
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
