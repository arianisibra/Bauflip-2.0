"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProjectOption = { id: string; title: string };

type Props = {
  projects: ProjectOption[];
};

export function TerminePlanFields({ projects }: Props) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const projectId =
    pickedId != null && projects.some((p) => p.id === pickedId) ? pickedId : (projects[0]?.id ?? "");
  const [kind, setKind] = useState("besichtigung");

  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Projekte vorhanden.</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <Label htmlFor="termine-project">Projekt</Label>
        <Select value={projectId} onValueChange={(v) => setPickedId(String(v))}>
          <SelectTrigger id="termine-project" className="h-9 w-full min-w-0">
            <SelectValue
              placeholder="Projekt wählen"
              resolvedLabel={projectId ? (projects.find((p) => p.id === projectId)?.title ?? "") : ""}
            />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <input type="hidden" name="kind" value={kind} />
        <Label htmlFor="termine-kind">Terminart</Label>
        <Select value={kind} onValueChange={(v) => setKind(String(v))}>
          <SelectTrigger id="termine-kind" className="h-9 w-full min-w-0">
            <SelectValue resolvedLabel={{ besichtigung: "Besichtigung", ausfuehrung: "Ausführung" }[kind] ?? kind} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="besichtigung">Besichtigung</SelectItem>
            <SelectItem value="ausfuehrung">Ausführung</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
