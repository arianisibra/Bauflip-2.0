"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { moveProjectPhaseAction } from "@/app/(app)/actions";
import { StatusBadge } from "@/components/app/status-badge";
import { PROJECT_WORKFLOW_STEPS, getWorkflowPhaseIndex } from "@/lib/workflow/project-workflow-rail";
import { statusLabels } from "@/lib/workflow/project-workflow";
import type { ProjectListRow } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const columnSurface = [
  "border-sky-200/90 bg-sky-50/70",
  "border-cyan-200/90 bg-cyan-50/60",
  "border-teal-200/90 bg-teal-50/50",
  "border-violet-200/90 bg-violet-50/55",
  "border-amber-200/90 bg-amber-50/50",
  "border-orange-200/90 bg-orange-50/45",
  "border-emerald-200/90 bg-emerald-50/50",
  "border-slate-200/90 bg-slate-50/80",
] as const;

type KanbanHubBoardProps = {
  projects: ProjectListRow[];
};

export function KanbanHubBoard({ projects }: KanbanHubBoardProps) {
  const [rows, setRows] = useState(projects);
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const byColumn = useMemo(() => {
    return PROJECT_WORKFLOW_STEPS.map((_, colIndex) => rows.filter((p) => getWorkflowPhaseIndex(p.status) === colIndex));
  }, [rows]);

  const persistMove = (projectId: string, targetColumnIndex: number, previous: ProjectListRow[]) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("targetPhaseIndex", String(targetColumnIndex));
      try {
        await moveProjectPhaseAction(fd);
      } catch {
        setRows(previous);
      }
    });
  };

  const handleDrop = (targetColumnIndex: number) => {
    if (!dragProjectId) {
      return;
    }
    const previous = rows;
    const next = rows.map((row) =>
      row.id === dragProjectId ? { ...row, status: phaseDefaultStatus(targetColumnIndex) } : row,
    );
    setRows(next);
    setDragProjectId(null);
    setDragOverColumn(null);
    persistMove(dragProjectId, targetColumnIndex, previous);
  };

  return (
    <div className="flex min-h-[min(70vh,42rem)] gap-3 overflow-x-auto pb-4 pt-1 [scrollbar-gutter:stable]">
      {PROJECT_WORKFLOW_STEPS.map((step, colIndex) => {
        const list = byColumn[colIndex] ?? [];
        const surface = columnSurface[colIndex] ?? columnSurface[0];
        const isDropTarget = dragOverColumn === colIndex;
        return (
          <div
            key={step.id}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverColumn(colIndex);
            }}
            onDragLeave={() => setDragOverColumn((prev) => (prev === colIndex ? null : prev))}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(colIndex);
            }}
            className={cn(
              "flex w-[min(100%,17.5rem)] shrink-0 flex-col rounded-xl border shadow-sm transition",
              surface,
              isDropTarget && "ring-2 ring-primary/40",
            )}
          >
            <div className="border-b border-black/5 px-3 py-2.5">
              <h2 className="text-xs font-bold uppercase leading-snug tracking-wide text-slate-800">{step.label}</h2>
              <p className="mt-0.5 line-clamp-2 text-[0.65rem] leading-snug text-muted-foreground">{step.hint}</p>
              <p className="mt-1.5 text-[0.7rem] font-medium tabular-nums text-slate-600">{list.length} Projekt(e)</p>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
              {list.length === 0 ? (
                <p className="rounded-lg border border-dashed border-black/10 bg-white/40 px-2 py-6 text-center text-[0.7rem] text-muted-foreground">
                  —
                </p>
              ) : (
                list.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDragProjectId(p.id)}
                    onDragEnd={() => {
                      setDragProjectId(null);
                      setDragOverColumn(null);
                    }}
                    className={cn(
                      "rounded-lg border border-white/80 bg-white/95 p-2.5 shadow-sm ring-1 ring-black/[0.04] transition",
                      "hover:bg-white hover:shadow-md hover:ring-primary/15",
                      dragProjectId === p.id && "opacity-60",
                      pending && "cursor-progress",
                    )}
                  >
                    <Link href={`/projekte/${p.id}`} className="block">
                      <p className="text-sm font-semibold leading-snug text-foreground">{p.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{p.contactName ?? "—"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="mt-1.5 text-[0.65rem] text-muted-foreground">{statusLabels[p.status]}</p>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function phaseDefaultStatus(phaseIndex: number): ProjectListRow["status"] {
  switch (phaseIndex) {
    case 0:
      return "anfrage";
    case 1:
      return "termin_geplant";
    case 2:
      return "besichtigung";
    case 3:
      return "offerte_in_arbeit";
    case 4:
      return "bestellung";
    case 5:
      return "ausfuehrung_geplant";
    case 6:
      return "ausfuehrung_erledigt";
    case 7:
      return "rechnung";
    default:
      return "anfrage";
  }
}
