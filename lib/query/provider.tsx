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
        // 2 Wiederholungen mit Abstand statt 1 sofortige: Beim Ausfall vom
        // 31.08. (Disk-IO-Drosselung) scheiterte der sofortige zweite Versuch
        // genauso, weil die Datenbank noch gedrosselt war — mit 2 s und 6 s
        // Abstand wäre ein Teil der Abbrüche beim Kunden nie sichtbar geworden.
        // Nur Lese-Abfragen (idempotent); Mutationen bleiben bei retry: 0.
        // Ehrlich: Gegen minutenlange Drosselung hilft auch das nicht — dann
        // greift die Fehlermeldung mit "Erneut versuchen".
        retry: 2,
        retryDelay: (attemptIndex) => (attemptIndex === 0 ? 2_000 : 6_000),
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
