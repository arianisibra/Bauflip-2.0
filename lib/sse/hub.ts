import "server-only";
import { EventEmitter } from "node:events";

import type { RealtimeEvent } from "@/lib/query/realtime";

/**
 * In-process pub/sub hub for realtime events.
 *
 * Scope: keyed by organization. A publisher emits an event for an orgId; every
 * SSE connection subscribed to that orgId receives it.
 *
 * Multi-instance deployment note: this is an in-memory EventEmitter, so it
 * only fans out within a single Node process. If you horizontally scale (e.g.,
 * multiple Next.js instances behind a load balancer), replace the two functions
 * below with Redis/NATS pub/sub. The rest of the stack (SSE route, client
 * bridge, dispatcher) is unchanged.
 */
export type PublishedEvent = RealtimeEvent & { originTabId?: string };

type GlobalHub = {
  __bauflipSseHub?: EventEmitter;
};

function getHub(): EventEmitter {
  const g = globalThis as unknown as GlobalHub;
  g.__bauflipSseHub ??= (() => {
    const e = new EventEmitter();
    // SSE connections can add up; disable the default max-listeners warning.
    e.setMaxListeners(0);
    return e;
  })();
  return g.__bauflipSseHub;
}

function channel(orgId: string): string {
  return `org:${orgId}`;
}

export function publish(orgId: string, event: PublishedEvent): void {
  getHub().emit(channel(orgId), event);
}

export function subscribe(
  orgId: string,
  listener: (e: PublishedEvent) => void,
): () => void {
  const hub = getHub();
  const ch = channel(orgId);
  hub.on(ch, listener);
  return () => hub.off(ch, listener);
}
