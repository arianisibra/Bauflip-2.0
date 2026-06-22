/** Shared Supabase Realtime broadcast channel naming (client + server). */
export const REALTIME_BROADCAST_EVENT = "bauflip";

export function orgChannelName(orgId: string): string {
  return `org:${orgId}`;
}
