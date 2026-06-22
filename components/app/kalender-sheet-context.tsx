"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";

type KalenderSheetContextValue = {
  sheetProjectId: string | null;
  openProjectSheet: (projectId: string) => void;
  closeProjectSheet: () => void;
};

const KalenderSheetContext = createContext<KalenderSheetContextValue | null>(null);

export function useKalenderSheet(): KalenderSheetContextValue {
  const ctx = useContext(KalenderSheetContext);
  if (!ctx) {
    throw new Error("useKalenderSheet must be used within KalenderSheetProvider");
  }
  return ctx;
}

/** Sheet-URL sync ohne Next.js-Navigation — vermeidet RSC-Reload + weekTasksFromAppointmentRange. */
function syncKalenderSheetInUrl(projectId: string | null): void {
  const params = new URLSearchParams(globalThis.location.search);
  if (projectId) params.set("sheet", projectId);
  else params.delete("sheet");
  const qs = params.toString();
  globalThis.history.replaceState(null, "", qs ? `/kalender?${qs}` : "/kalender");
}

export function KalenderSheetProvider({
  initialSheetProjectId,
  children,
}: {
  initialSheetProjectId: string | null;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const [sheetProjectId, setSheetProjectId] = useState(initialSheetProjectId);

  // Kalender-Navigation per router.replace entfernt ?sheet aus der URL — Sheet schliessen.
  useEffect(() => {
    const urlSheet = (searchParams.get("sheet") ?? "").trim() || null;
    if (!urlSheet) {
      setSheetProjectId(null);
    } else {
      setSheetProjectId(urlSheet);
    }
  }, [searchParams]);

  const openProjectSheet = useCallback((projectId: string) => {
    setSheetProjectId(projectId);
    syncKalenderSheetInUrl(projectId);
  }, []);

  const closeProjectSheet = useCallback(() => {
    setSheetProjectId(null);
    syncKalenderSheetInUrl(null);
  }, []);

  const value = useMemo(
    () => ({ sheetProjectId, openProjectSheet, closeProjectSheet }),
    [sheetProjectId, openProjectSheet, closeProjectSheet],
  );

  return <KalenderSheetContext.Provider value={value}>{children}</KalenderSheetContext.Provider>;
}
