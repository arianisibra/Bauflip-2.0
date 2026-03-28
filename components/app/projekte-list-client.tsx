"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Contact, ProjectListRow } from "@/lib/domain/types";
import { deleteProjectAction } from "@/app/(app)/projekte/actions";
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
  initialOpenProjectId,
}: {
  projects: ProjectListRow[];
  contacts: Contact[];
  canEditProjectSheet: boolean;
  initialOpenProjectId?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProjectListRow | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [pendingOpenProjectId, setPendingOpenProjectId] = useState(initialOpenProjectId ?? "");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setPendingOpenProjectId(initialOpenProjectId ?? "");
  }, [initialOpenProjectId]);

  useEffect(() => {
    if (!pendingOpenProjectId) {
      return;
    }
    const project = projects.find((item) => item.id === pendingOpenProjectId);
    if (!project) {
      setPendingOpenProjectId("");
      return;
    }
    setSelected(project);
    setOpen(true);
    setPendingOpenProjectId("");
  }, [pendingOpenProjectId, projects]);

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
        normalize(p.type).includes(n)
      );
    });
  }, [projects, q]);
  const hasSearch = q.trim().length > 0;
  const showEmptyState = filtered.length === 0;

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
        {showEmptyState ? (
          <div className="flex flex-col items-start gap-3 px-5 py-8 sm:px-8">
            <h2 className="text-base font-semibold">
              {hasSearch ? "Keine passenden Projekte gefunden" : "Noch keine Projekte vorhanden"}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {hasSearch
                ? "Passen Sie die Suche an oder leeren Sie den Suchbegriff, um wieder alle Projekte zu sehen."
                : "Erfassen Sie die erste Anfrage, damit sie hier im Ablauf erscheint und als Sidepage geöffnet werden kann."}
            </p>
            <div className="flex gap-2">
              {hasSearch ? (
                <Button size="sm" variant="outline" onClick={() => setQ("")}>
                  Suche zurücksetzen
                </Button>
              ) : null}
              <Button size="sm" onClick={() => setIntakeOpen(true)}>
                + Erste Anfrage erfassen
              </Button>
            </div>
          </div>
        ) : (
          <Table className="[&_tbody_tr:nth-child(even)]:bg-sky-50/40 dark:[&_tbody_tr:nth-child(even)]:bg-muted/25">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Projekt</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Nächster Schritt</TableHead>
                <TableHead className="w-[120px] text-right">Aktion</TableHead>
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
                    router.replace(`/projekte?openProjectId=${encodeURIComponent(p.id)}`, { scroll: false });
                  }}
                >
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>{p.contactName ?? "—"}</TableCell>
                  <TableCell className="capitalize">{p.type}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.nextOwnerRole}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-red-200 text-red-700 hover:bg-red-50"
                      disabled={deletingId === p.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = window.confirm(`Projekt "${p.title}" wirklich löschen?`);
                        if (!ok) {
                          return;
                        }
                        try {
                          setDeletingId(p.id);
                          await deleteProjectAction(p.id);
                          if (selected?.id === p.id) {
                            setOpen(false);
                            setSelected(null);
                          }
                          router.refresh();
                        } catch (err) {
                          window.alert(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                    >
                      Löschen
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setSelected(null);
            if (typeof window !== "undefined") {
              const params = new URLSearchParams(window.location.search);
              if (params.has("openProjectId")) {
                params.delete("openProjectId");
                const suffix = params.toString();
                router.replace(suffix ? `/projekte?${suffix}` : "/projekte", { scroll: false });
              }
            }
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
        className="max-w-2xl overflow-y-auto"
      >
        <div className="p-4">
          <IntakeForm contacts={contacts} />
        </div>
      </Sheet>
    </>
  );
}
