"use client";

import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { REALTIME_BROADCAST_EVENT, orgChannelName } from "@/lib/realtime/constants";
import { isRealtimeDataRoute } from "@/lib/realtime/connect-routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { subscribeOtherTabs, type PeerSyncEvent } from "./cross-tab-broadcast";
import { dispatchRealtimeEvent } from "./realtime";
import { getTabId } from "./tab-id";

const REALTIME_ERROR_RECONNECT_MS = 5_000;
/** Obergrenze des Backoffs — bei längerer Offline-Phase nicht dauernd neu versuchen. */
const REALTIME_MAX_RECONNECT_MS = 30_000;
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
  const dedupeRef = useRef({ lastKey: "", lastAt: 0 });

  const dispatchPeerEvent = useCallback((event: PeerSyncEvent) => {
    const myTabId = getTabId();
    if (event.originTabId && event.originTabId === myTabId) return;

    const key = incomingEventKey(event);
    const now = Date.now();
    const dedupe = dedupeRef.current;
    if (key === dedupe.lastKey && now - dedupe.lastAt < INCOMING_EVENT_DEDUPE_MS) {
      return;
    }
    dedupe.lastKey = key;
    dedupe.lastAt = now;

    // Cross-tab / Realtime: refetch inactive caches too (see invalidations.ts).
    // Auch Hintergrund-Tabs müssen still nachladen — der Focus-Refetch greift
    // dort per Definition nicht.
    dispatchRealtimeEvent(qc, event, { refetchType: "all" });
  }, [qc]);

  // Same-origin tabs: always listen so cache invalidation works even when this
  // tab is on /einstellungen or another non-data route (Kalender/Projekte open elsewhere).
  useEffect(() => subscribeOtherTabs(dispatchPeerEvent), [dispatchPeerEvent]);

  // Supabase org channel: only on list/calendar routes to limit WebSocket cost.
  useEffect(() => {
    if (!routeWantsRealtime || !orgId) return;

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let channel: RealtimeChannel | null = null;
    let reconnectTimeoutId: number | null = null;
    let cancelled = false;
    let attempt = 0;
    /** Nach einer Unterbrechung wurden Broadcasts verpasst — beim Wiederverbinden nachziehen. */
    let missedEvents = false;

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

    /** Harter Neuaufbau — nur für echte Fehler, wo der Kanal nicht von selbst zurückkommt. */
    const scheduleReconnect = () => {
      if (cancelled || reconnectTimeoutId) return;
      missedEvents = true;
      disconnect();
      const delay = Math.min(
        REALTIME_ERROR_RECONNECT_MS * 2 ** attempt,
        REALTIME_MAX_RECONNECT_MS,
      );
      attempt += 1;
      reconnectTimeoutId = window.setTimeout(() => {
        reconnectTimeoutId = null;
        void connect();
      }, delay);
    };

    /**
     * Bei `CLOSED` baut der Supabase-Client die Verbindung selbst wieder auf.
     * Deshalb hier NICHT sofort abreissen — das würde den laufenden Wiederaufbau
     * stören und Doppelverbindungen erzeugen. Stattdessen nur vormerken, dass
     * Ereignisse verpasst wurden, und einen Wachhund stellen, der erst eingreift,
     * wenn der Kanal nach der Frist immer noch nicht zurück ist.
     */
    const watchAfterClose = () => {
      if (cancelled || reconnectTimeoutId) return;
      missedEvents = true;
      reconnectTimeoutId = window.setTimeout(() => {
        reconnectTimeoutId = null;
        if (cancelled) return;
        const zurueck = channel?.state === "joined";
        if (!zurueck) scheduleReconnect();
      }, REALTIME_ERROR_RECONNECT_MS);
    };

    /** Tab wieder sichtbar oder Netz zurück: prüfen, ob der Kanal wirklich noch lebt. */
    const checkAlive = () => {
      if (cancelled) return;
      if (!channel) {
        clearReconnectTimeout();
        attempt = 0;
        void connect();
        return;
      }
      if (channel.state !== "joined") watchAfterClose();
    };

    const connect = async () => {
      if (cancelled || channel) return;

      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;
      const token = sessionData.session?.access_token;
      if (token) {
        await supabase.realtime.setAuth(token);
      }
      if (cancelled) return;

      channel = supabase.channel(orgChannelName(orgId), {
        config: { broadcast: { self: false }, private: true },
      });

      channel.on("broadcast", { event: REALTIME_BROADCAST_EVENT }, (msg) => {
        const payload = parseBroadcastPayload(msg);
        if (!payload) return;
        dispatchPeerEvent(payload);
      });

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          attempt = 0;
          clearReconnectTimeout();
          if (missedEvents) {
            // Während der Unterbrechung geänderte Daten sind im Cache noch alt.
            // Der Broadcast dieser Änderungen ist unwiederbringlich verpasst —
            // ohne dieses Nachladen bliebe der Stand veraltet, bis zufällig ein
            // neues Ereignis kommt oder der Nutzer neu lädt.
            missedEvents = false;
            void qc.invalidateQueries({ refetchType: "all" });
          }
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          scheduleReconnect();
          return;
        }
        // CLOSED wurde bisher gar nicht behandelt. Der Socket kommt zwar meist
        // von selbst zurück, aber die währenddessen verpassten Änderungen holt
        // niemand nach — genau das lässt die App still veralten.
        if (status === "CLOSED") {
          watchAfterClose();
        }
      });
    };

    const onOnline = () => checkAlive();
    const onVisible = () => {
      if (document.visibilityState === "visible") checkAlive();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    void connect();

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearReconnectTimeout();
      disconnect();
    };
  }, [dispatchPeerEvent, routeWantsRealtime, orgId, qc]);

  return null;
}
