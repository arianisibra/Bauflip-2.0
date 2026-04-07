"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OfficeProjectListItem, UserProfile } from "@/lib/domain/types";
import { projectStatusLabels } from "@/lib/domain/types";
import { deleteProjectAction } from "@/app/(app)/projekte/actions";
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

const ProjektSheetEditor = dynamic(
  () => import("@/components/app/projekt-sheet-editor").then((m) => ({ default: m.ProjektSheetEditor })),
  {
    loading: () => <p className="p-4 text-sm text-muted-foreground">Laden…</p>,
  },
);

const IntakeForm = dynamic(() =>
  import("@/components/app/intake-form").then((m) => ({ default: m.IntakeForm })),
);

function normalize(s: string) {
  return s.toLowerCase().trim();
}

type RowProps = {
  p: OfficeProjectListItem;
  deletingId: string | null;
  selectedId: string | null;
  onOpen: (p: OfficeProjectListItem) => void;
  onDelete: (p: OfficeProjectListItem) => void;
};

const ProjectTableRow = memo(function ProjectTableRow({ p, deletingId, selectedId, onOpen, onDelete }: RowProps) {
  return (
    <TableRow
      className="cursor-pointer"
      data-state={selectedId === p.id ? "selected" : undefined}
      onClick={() => onOpen(p)}
    >
      <TableCell className="font-medium">{p.title}</TableCell>
      <TableCell>{p.displayLabel ?? "—"}</TableCell>
      <TableCell className="capitalize">{p.type}</TableCell>
      <TableCell>
        <StatusBadge status={p.status} />
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 border-red-200 text-red-700 hover:bg-red-50"
          disabled={deletingId === p.id}
          onClick={(e) => {
            e.stopPropagation();
            void onDelete(p);
          }}
        >
          Löschen
        </Button>
      </TableCell>
    </TableRow>
  );
});

export function ProjekteListClient({
  projects,
  technicians,
  canEditProjectSheet,
  initialOpenProjectId,
}: {
  projects: OfficeProjectListItem[];
  technicians: UserProfile[];
  canEditProjectSheet: boolean;
  initialOpenProjectId?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<OfficeProjectListItem | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [pendingOpenProjectId, setPendingOpenProjectId] = useState(initialOpenProjectId ?? "");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

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
        normalize(p.displayLabel ?? "").includes(n) ||
        normalize(projectStatusLabels[p.status]).includes(n) ||
        normalize(p.type).includes(n)
      );
    });
  }, [projects, q]);
  const hasSearch = q.trim().length > 0;
  const showEmptyState = filtered.length === 0;

  const handleOpenRow = useCallback(
    (p: OfficeProjectListItem) => {
      setSelected(p);
      setOpen(true);
      router.replace(`/projekte?openProjectId=${encodeURIComponent(p.id)}`, { scroll: false });
    },
    [router],
  );

  const handleDeleteRow = useCallback(
    async (p: OfficeProjectListItem) => {
      const ok = window.confirm(`Projekt "${p.title}" wirklich löschen?`);
      if (!ok) {
        return;
      }
      try {
        setDeletingId(p.id);
        await deleteProjectAction(p.id);
        if (selectedRef.current?.id === p.id) {
          setOpen(false);
          setSelected(null);
        }
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
      } finally {
        setDeletingId(null);
      }
    },
    [router],
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Projekte</h1>
        <div className="flex items-center gap-2">
          <ListPageToolbar value={q} onChange={setQ} placeholder="Suche…" />
          <Button size="sm" onClick={() => setIntakeOpen(true)}>
            + Neue Anfrage
          </Button>
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
                ? "Passen Sie die Suche an."
                : "Erfassen Sie die erste Anfrage, damit sie hier erscheint."}
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
                <TableHead>Mieter / Kontakt</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px] text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <ProjectTableRow
                  key={p.id}
                  p={p}
                  deletingId={deletingId}
                  selectedId={selected?.id ?? null}
                  onOpen={handleOpenRow}
                  onDelete={handleDeleteRow}
                />
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
        description={selected?.displayLabel?.trim() ? selected.displayLabel : undefined}
      >
        {selected ? (
          <ProjektSheetEditor
            projectId={selected.id}
            open={open}
            canEdit={canEditProjectSheet}
            technicians={technicians}
          />
        ) : null}
      </Sheet>

      <Sheet open={intakeOpen} onOpenChange={setIntakeOpen} title="Neue Anfrage" className="max-w-2xl overflow-y-auto">
        <div className="p-4">
          <IntakeForm />
        </div>
      </Sheet>
    </>
  );
}
