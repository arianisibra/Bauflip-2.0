"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { OfficeProjectListItem, ProjectStatus } from "@/lib/domain/types";
import {
  projectStatusLabels,
  projectStatuses,
  projectStatusesOfficeListFilter,
} from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import {
  buildProjekteListHref,
  parseProjekteListUrlFilter,
  parseProjekteListUrlSearchQuery,
  projekteListQueriesEqual,
} from "@/lib/navigation/projekte-list-navigation";
import {
  isProjectStatus,
  matchesProjekteListFilter,
  parseProjekteListFilter,
  totalProjectsForListFilter,
  type ProjekteListFilter,
} from "@/lib/projekte/list-filter";
import {
  normalizeSearchQuery,
  PROJEKTE_LIST_PAGE_SIZE,
  PROJEKTE_SEARCH_MIN_CHARS,
} from "@/lib/projekte/list-page";
import { compareAbgemachtListOrder } from "@/lib/projekte/list-sort";
import { useDeleteProject, useProjekteBootstrap, useProjekteListInfinite } from "@/lib/query/hooks";
import { fetchOfficeProjectListItemAction } from "@/app/(app)/projekte/actions";
import { OfficeReturnBar } from "@/components/app/office-return-bar";
import { ListPageToolbar } from "@/components/app/list-page-toolbar";
import { sanitizeAppReturnTo } from "@/lib/navigation/app-return-to";
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

/** Remove sheet deep-link params from the URL without triggering an RSC refetch. */
function stripProjekteSheetParamsFromUrl() {
  const params = new URLSearchParams(globalThis.location.search);
  let changed = false;
  for (const key of ["openProjectId", "sheet", "from", "returnTo"]) {
    if (params.has(key)) {
      params.delete(key);
      changed = true;
    }
  }
  if (!changed) return;
  const suffix = params.toString();
  globalThis.history.replaceState(null, "", suffix ? `/projekte?${suffix}` : "/projekte");
}

/** Reihenfolge wie im Workflow (`projectStatuses`); unbekannte Werte ans Ende. */
function statusWorkflowIndex(status: ProjectStatus): number {
  const i = projectStatuses.indexOf(status);
  return i === -1 ? projectStatuses.length + 1 : i;
}

type ProjectsListSort = "default" | "status_asc" | "status_desc";

/** Abgeschlossen zuletzt; bei Status-Sortierung zuerst Workflow-Index; bei Filter ABGEMACHT: nächster Termin zuerst, sonst neu → Termin → Titel. */
function compareOfficeListRows(
  a: OfficeProjectListItem,
  b: OfficeProjectListItem,
  listSort: ProjectsListSort,
  statusFilter: ProjekteListFilter,
): number {
  const aDone = a.status === "abgeschlossen";
  const bDone = b.status === "abgeschlossen";
  if (aDone !== bDone) return aDone ? 1 : -1;

  if (listSort === "status_asc" || listSort === "status_desc") {
    const ai = statusWorkflowIndex(a.status);
    const bi = statusWorkflowIndex(b.status);
    if (ai !== bi) return listSort === "status_asc" ? ai - bi : bi - ai;
  }

  if (statusFilter === "abgemacht") {
    return compareAbgemachtListOrder(a, b);
  }

  const byCreated = b.createdAt.localeCompare(a.createdAt);
  if (byCreated !== 0) return byCreated;

  const ta = a.nextAppointmentStartsAt;
  const tb = b.nextAppointmentStartsAt;
  if (ta && tb) {
    const byAppt = ta.localeCompare(tb);
    if (byAppt !== 0) return byAppt;
  } else if (ta && !tb) return -1;
  else if (!ta && tb) return 1;

  return a.title.localeCompare(b.title, "de", { sensitivity: "base" });
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
  canEditProjectSheet,
  initialOpenProjectId,
  initialOpenSource,
  initialReturnTo = null,
}: {
  canEditProjectSheet: boolean;
  initialOpenProjectId?: string;
  initialOpenSource?: "kalender";
  initialReturnTo?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = parseProjekteListUrlFilter(searchParams);
  const urlSearchQuery = parseProjekteListUrlSearchQuery(searchParams);
  const { data: bootstrap, isLoading: metaLoading } = useProjekteBootstrap(statusFilter, urlSearchQuery);
  const {
    data: listData,
    isLoading: listLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useProjekteListInfinite(statusFilter, urlSearchQuery);
  const statusCountsSnapshot = bootstrap?.statusCounts;
  const listMeta = bootstrap?.listMeta;
  const deleteProject = useDeleteProject();
  const [listSort, setListSort] = useState<ProjectsListSort>("default");
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  /** Letzter von diesem Tab selbst geschriebener `q`-Wert — unterscheidet ein Echo unseres
   * eigenen debounced router.replace() von einer echten externen Änderung (z. B. Zurück/Vor). */
  const lastPushedQRef = useRef(q);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<OfficeProjectListItem | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [pendingOpenProjectId, setPendingOpenProjectId] = useState(initialOpenProjectId ?? "");
  const [prefetchedOpenProject, setPrefetchedOpenProject] = useState<OfficeProjectListItem | null>(null);
  const [openSource, setOpenSource] = useState<"kalender" | null>(initialOpenSource ?? null);
  const [returnTo, setReturnTo] = useState<string | null>(initialReturnTo);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    const urlQ = searchParams.get("q") ?? "";
    // Nur übernehmen, wenn die URL nicht schon unser eigener letzter Push ist — sonst
    // überschreibt ein verzögert ankommendes router.replace() frischer getippten Text
    // (Race, besonders sichtbar bei zusammengesetzten Zeichen wie „ü", die länger zum
    // Tippen brauchen als das 300ms-Debounce-Fenster).
    if (urlQ !== lastPushedQRef.current) {
      lastPushedQRef.current = urlQ;
      setQ(urlQ);
    }
  }, [searchParams]);

  useEffect(() => {
    const normalized = normalizeSearchQuery(q);
    if (normalized.length === 1) return;

    const timer = globalThis.setTimeout(() => {
      const href = buildProjekteListHref(statusFilter, searchParams, normalized);
      if (!projekteListQueriesEqual(searchParams.toString(), href)) {
        lastPushedQRef.current = normalized;
        router.replace(href, { scroll: false });
      }
    }, 300);
    return () => globalThis.clearTimeout(timer);
  }, [q, statusFilter, router, searchParams]);

  const handleStatusFilterChange = useCallback(
    (next: ProjekteListFilter) => {
      const href = buildProjekteListHref(next, searchParams);
      if (!projekteListQueriesEqual(searchParams.toString(), href)) {
        lastPushedQRef.current = normalizeSearchQuery(searchParams.get("q"));
        router.replace(href, { scroll: false });
      }
    },
    [router, searchParams],
  );

  const handleClearSearch = useCallback(() => {
    setQ("");
    lastPushedQRef.current = "";
    const href = buildProjekteListHref(statusFilter, searchParams, "");
    if (!projekteListQueriesEqual(searchParams.toString(), href)) {
      router.replace(href, { scroll: false });
    }
  }, [router, searchParams, statusFilter]);

  useEffect(() => {
    setPendingOpenProjectId(initialOpenProjectId ?? "");
    setOpenSource(initialOpenSource ?? null);
    setReturnTo(initialReturnTo ?? null);
  }, [initialOpenProjectId, initialOpenSource, initialReturnTo]);

  const loadedProjects = useMemo(
    () => listData?.pages.flatMap((page) => page.projects) ?? [],
    [listData],
  );

  useEffect(() => {
    setPrefetchedOpenProject(null);
  }, [statusFilter]);

  const projects = useMemo(() => {
    // Bei aktiver Suche liefert der Server bereits die org-weite (statusweite) Trefferliste —
    // dann NICHT nochmal clientseitig auf den Status-Filter einschränken, sonst verschwinden
    // Treffer mit anderem Status (das war der gemeldete Bug).
    const searching = urlSearchQuery.trim().length > 0;
    const base = searching
      ? loadedProjects
      : loadedProjects.filter((item) => matchesProjekteListFilter(item.status, statusFilter));
    if (!prefetchedOpenProject) return base;
    if (base.some((item) => item.id === prefetchedOpenProject.id)) return base;
    if (!searching && !matchesProjekteListFilter(prefetchedOpenProject.status, statusFilter)) return base;
    return [prefetchedOpenProject, ...base];
  }, [loadedProjects, prefetchedOpenProject, statusFilter, urlSearchQuery]);

  useEffect(() => {
    if (!pendingOpenProjectId) {
      return;
    }
    const project = loadedProjects.find((item) => item.id === pendingOpenProjectId);
    if (project) {
      setSelected(project);
      setOpen(true);
      setPendingOpenProjectId("");
      return;
    }
    let cancelled = false;
    void fetchOfficeProjectListItemAction(pendingOpenProjectId)
      .then((item) => {
        if (cancelled) return;
        setPrefetchedOpenProject(item);
        setSelected(item);
        setOpen(true);
        setPendingOpenProjectId("");
      })
      .catch(() => {
        if (!cancelled) setPendingOpenProjectId("");
      });
    return () => {
      cancelled = true;
    };
  }, [pendingOpenProjectId, loadedProjects]);

  useEffect(() => {
    if (open) stripProjekteSheetParamsFromUrl();
  }, [open]);

  const sorted = useMemo(() => {
    const copy = [...projects];
    copy.sort((a, b) => compareOfficeListRows(a, b, listSort, statusFilter));
    return copy;
  }, [projects, listSort, statusFilter]);

  const statusCountsForSheet = useMemo(() => {
    const m = new Map<ProjectStatus, number>();
    if (statusCountsSnapshot?.byStatus) {
      for (const [status, count] of Object.entries(statusCountsSnapshot.byStatus)) {
        if (isProjectStatus(status) && typeof count === "number") {
          m.set(status, count);
        }
      }
    }
    return m;
  }, [statusCountsSnapshot]);

  const hasSearch = urlSearchQuery.length > 0;
  const searchDraftTooShort =
    normalizeSearchQuery(q).length > 0 && normalizeSearchQuery(q).length < PROJEKTE_SEARCH_MIN_CHARS;
  const isConcreteStatusFilter = isProjectStatus(statusFilter);
  const hasNoMatchesForStatus = isConcreteStatusFilter && !hasSearch && projects.length === 0;
  const hasNoActiveProjects = statusFilter === "active" && !hasSearch && projects.length === 0;
  const showEmptyState = sorted.length === 0;
  const projectsLoading = metaLoading || listLoading;
  const totalForFilter = useMemo(() => {
    if (hasSearch) {
      return hasNextPage ? null : projects.length;
    }
    if (statusCountsSnapshot) {
      return totalProjectsForListFilter(statusCountsSnapshot, statusFilter);
    }
    return listMeta?.totalForFilter ?? projects.length;
  }, [hasSearch, hasNextPage, projects.length, statusCountsSnapshot, statusFilter, listMeta?.totalForFilter]);
  const useVirtualTable = sorted.length > PROJECT_TABLE_VIRTUAL_THRESHOLD;
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: useVirtualTable ? sorted.length : 0,
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
      setOpenSource(null);
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
  const loadMoreLabel = totalForFilter == null ? `${projects.length}+` : String(totalForFilter);

  return (
    <>
      {projectsLoading && projects.length === 0 ? (
        <div className="flex justify-center py-16" role="status" aria-live="polite">
          <BauflipLoading size="sm" label="Projekte werden geladen …" />
        </div>
      ) : null}
      <div className={projectsLoading && projects.length === 0 ? "hidden" : undefined}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Projekte</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:w-auto">
            <ListPageToolbar value={q} onChange={setQ} placeholder="Suche…" />
          </div>
          {searchDraftTooShort ? (
            <p className="text-[11px] text-muted-foreground sm:order-last sm:basis-full">
              Mindestens {PROJEKTE_SEARCH_MIN_CHARS} Zeichen für die org-weite Suche.
            </p>
          ) : null}
          {hasSearch ? (
            <p className="text-[11px] text-muted-foreground sm:order-last sm:basis-full">
              Suche durchsucht alle Projekte in Ihrer Organisation.
            </p>
          ) : null}
          <Button size="sm" className="h-11 w-full rounded-lg sm:h-9 sm:w-auto" onClick={() => setIntakeOpen(true)}>
            + Neue Anfrage
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
        <div className="space-y-2">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Nach Status anzeigen
          </span>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(parseProjekteListFilter(e.target.value))}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs font-bold sm:max-w-sm"
            aria-label="Statusfilter für Projekte"
          >
            <option value="active" className="font-bold">
              Aktiv (ohne Abgeschlossen) ({statusCountsSnapshot?.totalActive ?? projects.length})
            </option>
            <option value="all" className="font-bold">
              Alle ({statusCountsSnapshot?.totalAll ?? projects.length})
            </option>
            {projectStatusesOfficeListFilter.map((s) => (
              <option key={s} value={s} className="font-bold">
                {projectStatusLabels[s]} ({statusCountsSnapshot?.byStatus[s] ?? 0})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Standard: aktive Projekte ohne «Abgeschlossen». «Alle» schliesst auch abgeschlossene Projekte ein.
            Einzelstatus filtert serverseitig (zusätzlich zur Suche).
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/60 pt-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sortierung
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setListSort("default")}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                listSort === "default"
                  ? "border-zinc-400 bg-zinc-500/15 text-zinc-900 dark:border-zinc-500 dark:bg-zinc-500/25 dark:text-zinc-100"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setListSort("status_asc")}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                listSort === "status_asc"
                  ? "border-sky-500/50 bg-sky-500/20 text-sky-950 dark:border-sky-400/40 dark:bg-sky-500/25 dark:text-sky-50"
                  : "border-sky-500/25 bg-sky-500/5 text-sky-900/80 hover:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-100/90",
              )}
            >
              Status A→Z
            </button>
            <button
              type="button"
              onClick={() => setListSort("status_desc")}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                listSort === "status_desc"
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-950 dark:border-emerald-400/40 dark:bg-emerald-500/25 dark:text-emerald-50"
                  : "border-emerald-500/25 bg-emerald-500/5 text-emerald-900/80 hover:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-100/90",
              )}
            >
              Status Z→A
            </button>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Bei gleichem Status: zuerst neuere Projekte (Erstellungsdatum). Ausnahme: Filter «ABGEMACHT» — dort zuerst der nächste Termin.
            Adresse und weitere Details beim Öffnen des Projekts.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        {showEmptyState ? (
          <div className="flex flex-col items-start gap-3 px-5 py-8 sm:px-8">
            <h2 className="text-base font-semibold">
              {hasNoMatchesForStatus
                ? `Keine Projekte mit Status „${projectStatusLabels[statusFilter]}“`
                : hasNoActiveProjects
                  ? "Keine aktiven Projekte"
                : hasSearch
                  ? "Keine passenden Projekte gefunden"
                  : "Noch keine Projekte vorhanden"}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {hasNoMatchesForStatus
                ? "Wählen Sie einen anderen Status oder zeigen Sie alle Projekte an."
                : hasNoActiveProjects
                  ? "Alle Projekte sind abgeschlossen — wählen Sie «Alle» oder «Abgeschlossen»."
                : hasSearch
                  ? "Passen Sie die Suche oder den Status-Filter an."
                  : "Erfassen Sie die erste Anfrage, damit sie hier erscheint."}
            </p>
            <div className="flex flex-wrap gap-2">
              {hasNoMatchesForStatus || hasNoActiveProjects ? (
                <Button size="sm" variant="outline" onClick={() => handleStatusFilterChange("all")}>
                  Alle Projekte anzeigen
                </Button>
              ) : null}
              {hasNoMatchesForStatus ? (
                <Button size="sm" variant="outline" onClick={() => handleStatusFilterChange("active")}>
                  Nur aktive anzeigen
                </Button>
              ) : null}
              {hasSearch ? (
                <Button size="sm" variant="outline" onClick={handleClearSearch}>
                  Suche zurücksetzen
                </Button>
              ) : null}
              {!hasSearch && !hasNoMatchesForStatus ? (
                <Button size="sm" onClick={() => setIntakeOpen(true)}>
                  + Erste Anfrage erfassen
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col divide-y sm:hidden">
              {sorted.map((p) => (
                <div key={p.id} className="space-y-3 px-4 py-4 first:pt-5 last:pb-5">
                  <button
                    type="button"
                    className="w-full space-y-2 text-left"
                    onClick={() => handleOpenRow(p)}
                  >
                    <p className="text-base font-semibold leading-tight">{p.title}</p>
                    <div>
                      <StatusBadge status={p.status} />
                    </div>
                  </button>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => handleOpenRow(p)}>
                      Öffnen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10"
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
                        <TableHead>Mieter / Kontakt</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[120px] text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paddingTop > 0 ? (
                        <tr aria-hidden>
                          <td colSpan={4} className="h-0 border-0 p-0" style={{ height: paddingTop }} />
                        </tr>
                      ) : null}
                      {virtualItems.map((vi) => {
                        const p = sorted[vi.index];
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
                          <td colSpan={4} className="h-0 border-0 p-0" style={{ height: paddingBottom }} />
                        </tr>
                      ) : null}
                    </TableBody>
                  </table>
                </div>
              ) : (
                <Table className="[&_tbody_tr:nth-child(even)]:bg-sky-50/40 dark:[&_tbody_tr:nth-child(even)]:bg-muted/25">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Mieter / Kontakt</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[120px] text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((p) => (
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
            {hasNextPage ? (
              <div className="border-t border-border/70 px-4 py-4 sm:px-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={isFetchingNextPage}
                  onClick={() => void fetchNextPage()}
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Wird geladen …
                    </>
                  ) : (
                    `Weitere laden (${projects.length} von ${loadMoreLabel})`
                  )}
                </Button>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Es werden jeweils {PROJEKTE_LIST_PAGE_SIZE} Projekte geladen.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            const safeReturn = sanitizeAppReturnTo(returnTo);
            const returnToCalendar = openSource === "kalender";
            setSelected(null);
            setOpenSource(null);
            setReturnTo(null);
            if (safeReturn) {
              router.push(safeReturn);
              return;
            }
            if (returnToCalendar) {
              router.push("/kalender");
              return;
            }
            stripProjekteSheetParamsFromUrl();
          }
        }}
        className="max-w-6xl w-[min(100vw-1.5rem,80rem)]"
        title={selected?.title ?? "Projekt"}
        description={selected?.title?.trim() ? selected.title : undefined}
      >
        {selected ? (
          <>
            <OfficeReturnBar
              returnTo={returnTo}
              label={openSource === "kalender" ? "Zurück zum Kalender" : "Zurück"}
            />
            <ProjektSheetEditor
              projectId={selected.id}
              open={open}
              canEdit={canEditProjectSheet}
              statusCounts={statusCountsForSheet}
            />
          </>
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
              globalThis.history.replaceState(null, "", `/projekte?${params.toString()}`);
            }}
          />
        </div>
      </Sheet>
      </div>
    </>
  );
}
