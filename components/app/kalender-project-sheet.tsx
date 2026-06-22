"use client";

import { ProjektSheetEditor } from "@/components/app/projekt-sheet-editor";
import { useKalenderSheet } from "@/components/app/kalender-sheet-context";
import { Sheet } from "@/components/ui/sheet";
import { useProjectCore } from "@/lib/query/hooks";

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
