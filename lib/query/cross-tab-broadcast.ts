"use client";

import type { RealtimeEvent } from "./realtime";
import { getTabId } from "./tab-id";

export type PeerSyncEvent = RealtimeEvent & { originTabId?: string };

const CHANNEL_NAME = "bauflip-sync";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  channel ??= new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/** Notify other browser tabs on the same origin (works even when tab is in background). */
export function notifyOtherTabs(event: RealtimeEvent): void {
  const payload: PeerSyncEvent = { ...event, originTabId: getTabId() };
  getChannel()?.postMessage(payload);
}

export function subscribeOtherTabs(
  onEvent: (event: PeerSyncEvent) => void,
): () => void {
  const bc = getChannel();
  if (!bc) return () => undefined;

  const handler = (message: MessageEvent<PeerSyncEvent>) => {
    if (!message.data?.type) return;
    onEvent(message.data);
  };
  bc.addEventListener("message", handler);
  return () => bc.removeEventListener("message", handler);
}
