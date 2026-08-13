"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  type Query,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState, type ReactNode } from "react";
import { checkDeploymentVersion } from "@/lib/version/stale-deployment";

/**
 * One QueryClient per browser session. `useState` gives each component tree
 * a stable instance across re-renders while still being per-request on SSR.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    // Nach einem Deploy kennt der Server die Server-Action-IDs des alten Bundles
    // nicht mehr — jede Aktion schlägt fehl, der Knopf wirkt tot. Ein Fehler ist
    // deshalb der beste Moment, die Version zu prüfen: schneller als das
    // Intervall im VersionBanner und genau dann, wenn es den Nutzer betrifft.
    // Die Prüfung läuft nebenher und ändert am Fehler selbst nichts.
    mutationCache: new MutationCache({
      onError: () => void checkDeploymentVersion(),
    }),
    queryCache: new QueryCache({
      onError: () => void checkDeploymentVersion(),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/**
 * Offline-Lesen (Phase 1 "PWA für Monteure"): nur die Feld-relevanten Daten landen in
 * localStorage — Tagesliste, Wochenplan, geöffneter Auftrag. Die breitere Büro-Projektliste
 * (Kunden-/Preisdaten über die ganze Organisation) bleibt bewusst reines In-Memory, um die
 * Offline-Ablage nicht unnötig mit Daten zu füllen, die der Monteur gar nicht braucht.
 */
function isFieldOfflineQuery(query: Query): boolean {
  const key = query.queryKey;
  if (!Array.isArray(key)) return false;
  const [namespace, sub] = key;
  if (namespace === "auftrag-extras") return true;
  if (namespace === "week-tasks") return true;
  if (namespace === "tech-month-tasks") return true;
  if (namespace === "projects" && sub === "auftrag-core") return true;
  return false;
}

export function QueryProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [client] = useState(makeQueryClient);
  const [persister] = useState(() =>
    typeof window === "undefined"
      ? null
      : createSyncStoragePersister({ storage: window.localStorage, key: "bauflip-offline-cache" }),
  );

  if (!persister) {
    // SSR-Durchlauf (kein window) — Persistenz übernimmt nach Hydration der zweite Render.
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        dehydrateOptions: { shouldDehydrateQuery: isFieldOfflineQuery },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
