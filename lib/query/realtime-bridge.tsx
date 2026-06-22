"use client";

import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { REALTIME_BROADCAST_EVENT, orgChannelName } from "@/lib/realtime/constants";
import { isRealtimeDataRoute } from "@/lib/realtime/connect-routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { subscribeOtherTabs, type PeerSyncEvent } from "./cross-tab-broadcast";
import { dispatchRealtimeEvent } from "./realtime";
import { getTabId } from "./tab-id";

const REALTIME_ERROR_RECONNECT_MS = 5_000;
/** Collapse duplicate BroadcastChannel + Supabase deliveries of the same event. */
const INCOMING_EVENT_DEDUPE_MS = 1_500;

function incomingEventKey(event: PeerSyncEvent): string {
  if ("projectId" in event && event.projectId) {
    return `${event.type}:${event.projectId}`;
  }
  return event.type;
}

function parseBroadcastPayload(msg: unknown): PeerSyncEvent | null {
  if (!msg || typeof msg !== "object") return null;
  const record = msg as Record<string, unknown>;
  const inner =
    record.payload && typeof record.payload === "object"
      ? (record.payload as PeerSyncEvent)
      : (record as PeerSyncEvent);
  return inner?.type ? inner : null;
}

/**
 * Subscribes this tab to Supabase Realtime broadcast + same-origin BroadcastChannel.
 * Replaces the former Netlify SSE `/api/events` stream.
 */
export function RealtimeBridge({ orgId }: { orgId: string | null }): null {
  const qc = useQueryClient();
  const pathname = usePathname();
  const routeWantsRealtime = isRealtimeDataRoute(pathname);

  useEffect(() => {
    if (!routeWantsRealtime) return;

    const myTabId = getTabId();
    let lastIncomingKey = "";
    let lastIncomingAt = 0;

    const handleIncoming = (event: PeerSyncEvent) => {
      if (event.originTabId && event.originTabId === myTabId) return;
      const key = incomingEventKey(event);
      const now = Date.now();
      if (key === lastIncomingKey && now - lastIncomingAt < INCOMING_EVENT_DEDUPE_MS) {
        return;
      }
      lastIncomingKey = key;
      lastIncomingAt = now;
      dispatchRealtimeEvent(qc, event, { refetchType: "active" });
    };

    const unsubscribePeers = subscribeOtherTabs(handleIncoming);

    if (!orgId) {
      return unsubscribePeers;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return unsubscribePeers;
    }

    let channel: RealtimeChannel | null = null;
    let reconnectTimeoutId: number | null = null;
    let cancelled = false;

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutId) {
        window.clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
    };

    const disconnect = () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };

    const connect = async () => {
      if (cancelled || channel) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        await supabase.realtime.setAuth(token);
      }

      channel = supabase.channel(orgChannelName(orgId), {
        config: { broadcast: { self: false } },
      });

      channel.on("broadcast", { event: REALTIME_BROADCAST_EVENT }, (msg) => {
        const payload = parseBroadcastPayload(msg);
        if (!payload) return;
        handleIncoming(payload);
      });

      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          disconnect();
          clearReconnectTimeout();
          reconnectTimeoutId = window.setTimeout(() => {
            reconnectTimeoutId = null;
            void connect();
          }, REALTIME_ERROR_RECONNECT_MS);
        }
      });
    };

    void connect();

    return () => {
      cancelled = true;
      clearReconnectTimeout();
      disconnect();
      unsubscribePeers();
    };
  }, [qc, routeWantsRealtime, orgId]);

  return null;
}
