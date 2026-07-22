"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  flushOutbox,
  getOutboxServerSnapshot,
  getOutboxSnapshot,
  subscribeOutbox,
  type OutboxItem,
} from "@/lib/offline/outbox";

export function useOutbox(): OutboxItem[] {
  return useSyncExternalStore(subscribeOutbox, getOutboxSnapshot, getOutboxServerSnapshot);
}

/** Mount once per tech-facing layout — retries queued Rapporte/Fotos on reconnect. */
export function useOutboxAutoFlush(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    void flushOutbox(queryClient);
    function onOnline() {
      void flushOutbox(queryClient);
    }
    function onVisible() {
      if (document.visibilityState === "visible" && navigator.onLine) void flushOutbox(queryClient);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient]);
}
