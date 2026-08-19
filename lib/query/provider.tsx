"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * One QueryClient per browser session. `useState` gives each component tree
 * a stable instance across re-renders while still being per-request on SSR.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        // An: Ohne Focus-Refetch hatte die App ausser Realtime keinen einzigen
        // Auslöser, um veraltete Daten nachzuladen — wer nach einer Pause
        // zurückkam, sah den alten Stand und half sich mit F5 (der langsamste
        // Weg durch die App). `staleTime` bremst das: nur wirklich veraltete
        // Abfragen laden nach, kein Request-Sturm bei jedem Fensterwechsel.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export function QueryProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}
