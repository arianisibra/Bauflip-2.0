"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { subscribeToBroadcast } from "./realtime";

/**
 * One QueryClient per browser session. `useState` gives each component tree
 * a stable instance across re-renders while still being per-request on SSR.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 30s — within that window, remounting a
        // component that uses the same key doesn't refetch.
        staleTime: 30 * 1000,
        // Keep cached data around for 5 min after last use, then drop it.
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

export function QueryProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <BroadcastBridge />
      {children}
    </QueryClientProvider>
  );
}

/**
 * Subscribes this tab's QueryClient to the cross-tab BroadcastChannel so that
 * a mutation in tab A invalidates the matching queries in tab B without any
 * server round-trip. The wire is already in place for SSE/Realtime later —
 * same `dispatchRealtimeEvent` entry point.
 */
function BroadcastBridge() {
  const qc = useQueryClient();
  useEffect(() => subscribeToBroadcast(qc), [qc]);
  return null;
}
