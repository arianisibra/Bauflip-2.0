"use client";

import { useMemo, useState } from "react";
import type { Contact, ProjectListRow } from "@/lib/domain/types";
import { ProjektSheetEditor } from "@/components/app/projekt-sheet-editor";
import { IntakeForm } from "@/components/app/intake-form";
import { ListPageToolbar } from "@/components/app/list-page-toolbar";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { statusLabels } from "@/lib/workflow/project-workflow";

function normalize(s: string) {
  return s.toLowerCase().trim();
}

export function ProjekteListClient({
  projects,
  contacts,
  canEditProjectSheet,
}: {
  projects: ProjectListRow[];
  contacts: Contact[];
  canEditProjectSheet: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProjectListRow | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!q.trim()) {
      return projects;
    }
    const n = normalize(q);
    return projects.filter((p) => {
      return (
        normalize(p.title).includes(n) ||
        normalize(p.contactName ?? "").includes(n) ||
        normalize(statusLabels[p.status]).includes(n) ||
        normalize(p.urgency).includes(n) ||
        normalize(p.type).includes(n)
      );
    });
  }, [projects, q]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Projekte</h1>
        <div className="flex items-center gap-2">
          <ListPageToolbar value={q} onChange={setQ} placeholder="Projekt, Kunde, Status …" />
          <Button size="sm" onClick={() => setIntakeOpen(true)}>+ Neue Anfrage</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table className="[&_tbody_tr:nth-child(even)]:bg-sky-50/40 dark:[&_tbody_tr:nth-child(even)]:bg-muted/25">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Projekt</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dringlichkeit</TableHead>
              <TableHead>Nächster Schritt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelected(p);
                  setOpen(true);
                }}
              >
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell>{p.contactName ?? "—"}</TableCell>
                <TableCell className="capitalize">{p.type}</TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
                <TableCell className="capitalize">{p.urgency}</TableCell>
                <TableCell className="text-muted-foreground">{p.nextOwnerRole}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setSelected(null);
          }
        }}
        className="max-w-6xl w-[min(100vw-1.5rem,80rem)]"
        title={selected?.title ?? "Projekt"}
        description={selected?.contactName?.trim() ? selected.contactName : undefined}
      >
        {selected ? (
          <ProjektSheetEditor projectId={selected.id} open={open} canEdit={canEditProjectSheet} />
        ) : null}
      </Sheet>

      <Sheet
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        title="Neue Anfrage"
        description="Originalinformation vollständig erfassen — nichts geht verloren."
        className="max-w-2xl overflow-y-auto"
      >
        <div className="p-4">
          <IntakeForm contacts={contacts} />
        </div>
      </Sheet>
    </>
  );
}
