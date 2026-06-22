import "server-only";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type { RealtimeEvent } from "@/lib/query/realtime";
import { REALTIME_BROADCAST_EVENT, orgChannelName } from "@/lib/realtime/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublishedEvent = RealtimeEvent & { originTabId?: string };

const HTTP_SEND_TIMEOUT_MS = 5_000;

let cachedAdmin: SupabaseClient | null | undefined;

function getPublishAdminClient(): SupabaseClient | null {
  if (cachedAdmin !== undefined) return cachedAdmin;
  cachedAdmin = createSupabaseAdminClient();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (cachedAdmin && serviceRoleKey) {
    cachedAdmin.realtime.setAuth(serviceRoleKey);
  }
  return cachedAdmin;
}

async function publishAsync(orgId: string, event: PublishedEvent): Promise<void> {
  const admin = getPublishAdminClient();
  if (!admin) return;

  const channel: RealtimeChannel = admin.channel(orgChannelName(orgId), {
    config: { broadcast: { self: false } },
  });

  const result = await channel.httpSend(REALTIME_BROADCAST_EVENT, event, {
    timeout: HTTP_SEND_TIMEOUT_MS,
  });
  if (!result.success) {
    throw new Error("[bauflip] realtime httpSend failed");
  }
}

/** Fire-and-forget org broadcast via Supabase Realtime REST (no WebSocket subscribe). */
export function publish(orgId: string, event: PublishedEvent): void {
  void publishAsync(orgId, event).catch((err) => {
    console.warn("[bauflip] realtime publish failed:", err);
  });
}
