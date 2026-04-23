"use client";

/**
 * Unique per-tab identifier. One UUID per browser tab session.
 * Used for SSE echo suppression — an event whose `originTabId` matches this
 * tab's ID is ignored (we already handled it locally).
 */
let cached: string | null = null;

export function getTabId(): string {
  if (cached) return cached;
  cached = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return cached;
}
