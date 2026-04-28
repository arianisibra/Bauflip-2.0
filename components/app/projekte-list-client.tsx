"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { OfficeProjectListItem, UserProfile } from "@/lib/domain/types";
import { projectStatusLabels } from "@/lib/domain/types";
import { useDeleteProject, useProjectsList } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { ListPageToolbar } from "@/components/app/list-page-toolbar";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
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
    loading: () => (
      <div className="flex justify-center p-8" role="status" aria-live="polite">
        <BauflipLoading size="sm" label="Projekt wird geladen …" />
      </div>
    ),
  },
);

const IntakeForm = dynamic(() => import("@/components/app/intake-form").then((m) => ({ default: m.IntakeForm })), {
  loading: () => (
    <div className="flex justify-center py-10" role="status" aria-live="polite">
      <BauflipLoading size="sm" label="Formular wird geladen …" />
    </div>
  ),
});

function normalize(s: string) {
  return s.toLowerCase().trim();
}

/** Above this row count, tbody uses windowing to limit DOM nodes. */
const PROJECT_TABLE_VIRTUAL_THRESHOLD = 55;
const PROJECT_TABLE_ROW_ESTIMATE_PX = 49;

type RowProps = {
  p: OfficeProjectListItem;
  deletingId: string | null;
  selectedId: string | null;
  onOpen: (p: OfficeProjectListItem) => void;
  onDelete: (p: OfficeProjectListItem) => void;
  /** Striped row when virtualized table cannot use :nth-child(even). */
  zebraEven?: boolean;
};

const ProjectTableRow = memo(function ProjectTableRow({
  p,
  deletingId,
  selectedId,
  onOpen,
  onDelete,
  zebraEven,
}: RowProps) {
  return (
    <TableRow
      className={`cursor-pointer${zebraEven ? " bg-sky-50/40 dark:bg-muted/25" : ""}`}
      data-state={selectedId === p.id ? "selected" : undefined}
      onClick={() => onOpen(p)}
    >
      <TableCell className="font-medium">{p.title}</TableCell>
      <TableCell>{p.displayLabel ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{p.serviceAddressShort ?? "—"}</TableCell>
      <TableCell className="capitalize">{p.type}</TableCell>
      <TableCell>
        <StatusBadge status={p.status} />
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
          disabled={deletingId === p.id}
          onClick={(e) => {
            e.stopPropagation();
            void onDelete(p);
          }}
        >
          {deletingId === p.id ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
              Löschen …
            </span>
          ) : (
            "Löschen"
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
});

export function ProjekteListClient({
  projects: initialProjects,
  technicians: initialTechnicians,
  canEditProjectSheet,
  initialOpenProjectId,
}: {
  projects: OfficeProjectListItem[];
  technicians: UserProfile[];
  canEditProjectSheet: boolean;
  initialOpenProjectId?: string;
}) {
  const qc = useQueryClient();
  const { data: projects = initialProjects } = useProjectsList(initialProjects);
  // Seed the assignable-profiles cache WITHOUT subscribing — the sheet editor
  // reads it via useAssignableProfiles() when it opens. Avoids a fetch on every
  // /projekte page render.
  useMemo(() => {
    qc.setQueryData(queryKeys.assignableProfiles(), initialTechnicians);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const deleteProject = useDeleteProject();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<OfficeProjectListItem | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [pendingOpenProjectId, setPendingOpenProjectId] = useState(initialOpenProjectId ?? "");
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
        normalize(p.serviceAddressShort ?? "").includes(n) ||
        normalize(projectStatusLabels[p.status]).includes(n) ||
        normalize(p.type).includes(n)
      );
    });
  }, [projects, q]);
  const hasSearch = q.trim().length > 0;
  const showEmptyState = filtered.length === 0;
  const useVirtualTable = filtered.length > PROJECT_TABLE_VIRTUAL_THRESHOLD;
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: useVirtualTable ? filtered.length : 0,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => PROJECT_TABLE_ROW_ESTIMATE_PX,
    overscan: 12,
  });
  const virtualItems = useVirtualTable ? virtualizer.getVirtualItems() : [];
  const paddingTop = useVirtualTable && virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    useVirtualTable && virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  const handleOpenRow = useCallback(
    (p: OfficeProjectListItem) => {
      setSelected(p);
      setOpen(true);
      // Sync URL for deep-linking WITHOUT triggering an RSC refetch of the list.
      const params = new URLSearchParams(globalThis.location.search);
      params.delete("sheet");
      params.set("openProjectId", p.id);
      globalThis.history.replaceState(null, "", `/projekte?${params.toString()}`);
    },
    [],
  );

  const handleDeleteRow = useCallback(
    async (p: OfficeProjectListItem) => {
      const ok = window.confirm(`Projekt "${p.title}" wirklich löschen?`);
      if (!ok) return;
      try {
        await deleteProject.mutateAsync(p.id);
        toast.success("Projekt gelöscht");
        if (selectedRef.current?.id === p.id) {
          setOpen(false);
          setSelected(null);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
      }
    },
    [deleteProject],
  );
  const deletingId = deleteProject.isPending ? (deleteProject.variables as string | undefined) ?? null : null;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Projekte</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:w-auto">
            <ListPageToolbar value={q} onChange={setQ} placeholder="Suche…" />
          </div>
          <Button size="sm" className="w-full sm:w-auto" onClick={() => setIntakeOpen(true)}>
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
          <>
            <div className="flex flex-col divide-y sm:hidden">
              {filtered.map((p) => (
                <div key={p.id} className="space-y-3 px-4 py-4">
                  <button
                    type="button"
                    className="w-full space-y-2 text-left"
                    onClick={() => handleOpenRow(p)}
                  >
                    <p className="text-base font-semibold leading-tight">{p.title}</p>
                    <p className="text-sm text-muted-foreground">{p.displayLabel ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">{p.serviceAddressShort ?? "—"}</p>
                    <div>
                      <StatusBadge status={p.status} />
                    </div>
                  </button>
                  <div className="flex items-center justify-between gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => handleOpenRow(p)}>
                      Öffnen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      disabled={deletingId === p.id}
                      onClick={() => void handleDeleteRow(p)}
                    >
                      {deletingId === p.id ? "Löschen …" : "Löschen"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden sm:block">
              {useVirtualTable ? (
                <div
                  ref={scrollParentRef}
                  className="relative max-h-[min(70vh,32rem)] w-full overflow-auto rounded-lg border border-border bg-card shadow-sm"
                >
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-10 border-b bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Projekt</TableHead>
                        <TableHead>Mieter / Kontakt</TableHead>
                        <TableHead>Adresse</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[120px] text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paddingTop > 0 ? (
                        <tr aria-hidden>
                          <td colSpan={6} className="h-0 border-0 p-0" style={{ height: paddingTop }} />
                        </tr>
                      ) : null}
                      {virtualItems.map((vi) => {
                        const p = filtered[vi.index];
                        return (
                          <ProjectTableRow
                            key={p.id}
                            p={p}
                            deletingId={deletingId}
                            selectedId={selected?.id ?? null}
                            onOpen={handleOpenRow}
                            onDelete={handleDeleteRow}
                            zebraEven={vi.index % 2 === 1}
                          />
                        );
                      })}
                      {paddingBottom > 0 ? (
                        <tr aria-hidden>
                          <td colSpan={6} className="h-0 border-0 p-0" style={{ height: paddingBottom }} />
                        </tr>
                      ) : null}
                    </TableBody>
                  </table>
                </div>
              ) : (
                <Table className="[&_tbody_tr:nth-child(even)]:bg-sky-50/40 dark:[&_tbody_tr:nth-child(even)]:bg-muted/25">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Projekt</TableHead>
                      <TableHead>Mieter / Kontakt</TableHead>
                      <TableHead>Adresse</TableHead>
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
          </div>
        )}
      </div>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setSelected(null);
            // Strip ?openProjectId without triggering an RSC refetch.
            const params = new URLSearchParams(globalThis.location.search);
            let changed = false;
            if (params.has("openProjectId")) {
              params.delete("openProjectId");
              changed = true;
            }
            if (params.has("sheet")) {
              params.delete("sheet");
              changed = true;
            }
            if (changed) {
              const suffix = params.toString();
              globalThis.history.replaceState(null, "", suffix ? `/projekte?${suffix}` : "/projekte");
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
          />
        ) : null}
      </Sheet>

      <Sheet open={intakeOpen} onOpenChange={setIntakeOpen} title="Neue Anfrage" className="max-w-2xl overflow-y-auto">
        <div className="p-4">
          <IntakeForm
            onCreated={(projectId) => {
              // The project is already in the refetched list; surface it in the sheet.
              setIntakeOpen(false);
              setPendingOpenProjectId(projectId);
              const params = new URLSearchParams(globalThis.location.search);
              params.delete("sheet");
              params.set("openProjectId", projectId);
              globalThis.history.pushState(null, "", `/projekte?${params.toString()}`);
            }}
          />
        </div>
      </Sheet>
    </>
  );
}
