"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { dispatchRealtimeEvent, type RealtimeEvent } from "./realtime";
import { getTabId } from "./tab-id";

type IncomingEvent = RealtimeEvent & { originTabId?: string };

/**
 * Subscribes this tab to the server-sent event stream at /api/events.
 * On each event: if its `originTabId` matches this tab's ID, skip (we already
 * applied the change locally via the mutation hook). Otherwise, dispatch with
 * `refetchType: "all"` so inactive queries also refetch silently — the user
 * sees fresh data immediately on next navigation.
 */
export function SseBridge(): null {
  const qc = useQueryClient();

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const myTabId = getTabId();
    const source = new EventSource("/api/events");

    source.onmessage = (msg) => {
      let event: IncomingEvent;
      try {
        event = JSON.parse(msg.data) as IncomingEvent;
      } catch {
        return;
      }
      if (event.originTabId && event.originTabId === myTabId) return;
      dispatchRealtimeEvent(qc, event, { refetchType: "all" });
    };

    // EventSource auto-reconnects on `error`; nothing to do here. Log for debugging.
    source.onerror = () => {
      // eslint-disable-next-line no-console
      console.debug("[sse] connection error; browser will reconnect");
    };

    return () => source.close();
  }, [qc]);

  return null;
}
