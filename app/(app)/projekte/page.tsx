import Link from "next/link";
import { listProjects } from "@/lib/db/repository";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";

export default async function ProjektePage() {
  const projects = await listProjects();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Projekte</h1>
      <div className="grid gap-4">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{project.title}</CardTitle>
                <StatusBadge status={project.status} />
              </div>
              <CardDescription>
                Typ: {project.type} · Dringlichkeit: {project.urgency} · Nächster Owner:{" "}
                {project.nextOwnerRole}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/projekte/${project.id}`} />}
              >
                Öffnen
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
