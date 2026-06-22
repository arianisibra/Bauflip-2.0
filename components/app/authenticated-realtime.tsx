"use client";

import { RealtimeBridge } from "@/lib/query/realtime-bridge";

/** Supabase Realtime nur in eingeloggten App-/Tech-Layouts — nicht auf öffentlichen Seiten. */
export function AuthenticatedRealtime({ orgId }: { orgId: string | null }) {
  return <RealtimeBridge orgId={orgId} />;
}
