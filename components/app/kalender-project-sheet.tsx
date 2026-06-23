"use client";

import dynamic from "next/dynamic";
import { useKalenderSheet } from "@/components/app/kalender-sheet-context";
import { Sheet } from "@/components/ui/sheet";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { useProjectCore } from "@/lib/query/hooks";

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

export function KalenderProjectSheet() {
  const { sheetProjectId, closeProjectSheet } = useKalenderSheet();
  const open = Boolean(sheetProjectId);

  const coreQuery = useProjectCore(sheetProjectId, open);
  const title =
    coreQuery.data?.project.tenantName?.trim() ||
    coreQuery.data?.project.title?.trim() ||
    "Projekt";

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeProjectSheet();
      }}
      className="max-w-6xl w-[min(100vw-1.5rem,80rem)]"
      title={title}
      description={title !== "Projekt" ? title : undefined}
    >
      {sheetProjectId ? (
        <ProjektSheetEditor projectId={sheetProjectId} open={open} canEdit />
      ) : null}
    </Sheet>
  );
}
