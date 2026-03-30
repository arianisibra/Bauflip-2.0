import Link from "next/link";
import { listProjects } from "@/lib/db/repository";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { MessageSquare, ArrowRight, FolderOpen, Clock3 } from "lucide-react";

export default async function TeamChatPage() {
  const projects = await listProjects();
  const openCount = projects.filter((p) => p.status !== "abgeschlossen").length;
  const closedCount = projects.length - openCount;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Team-Chat</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Jeder Projekt-Chat ist zentral mit Aufgaben, Terminen und Dateien verbunden. Oeffnen Sie ein Projekt und
          steigen Sie direkt in den Verlauf ein.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Card size="sm" className="border-border/60 bg-muted/20 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
          <CardContent className="flex items-center gap-3 pt-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-background ring-1 ring-border/60">
              <FolderOpen className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Projekte gesamt</p>
              <p className="text-lg font-semibold tabular-nums tracking-tight">{projects.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm" className="border-border/60 bg-muted/20 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
          <CardContent className="flex items-center gap-3 pt-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-background ring-1 ring-border/60">
              <MessageSquare className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aktiv im Ablauf</p>
              <p className="text-lg font-semibold tabular-nums tracking-tight">{openCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm" className="border-border/60 bg-muted/20 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
          <CardContent className="flex items-center gap-3 pt-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-background ring-1 ring-border/60">
              <Clock3 className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Abgeschlossen</p>
              <p className="text-lg font-semibold tabular-nums tracking-tight">{closedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Noch keine Projekte vorhanden</CardTitle>
            <CardDescription>
              Sobald Projekte erstellt werden, erscheinen sie hier als direkte Chat-Einstiege.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => (
            <Card key={project.id} size="sm" className="border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{project.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={project.status} />
                    <span className="text-xs text-muted-foreground">Projektchat & Dateien</span>
                  </div>
                </div>
                <Button size="sm" nativeButton={false} render={<Link href={`/projekte/${project.id}#team-chat`} />}>
                  Chat öffnen
                  <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
