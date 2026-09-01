import "server-only";

import type { RoleType } from "@/lib/domain/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildAuthUserMetadataPatch } from "@/lib/auth/user-metadata-keys";

/**
 * Spiegelt die Mitgliedschaft in die Auth-Metadaten, damit der Proxy-Schnellweg
 * greift (keine Abfrage auf organization_memberships pro Anfrage).
 *
 * Massgeblich ist `app_metadata` — dieselbe Quelle, die die RLS-Regeln lesen,
 * und vom Nutzer selbst nicht beschreibbar. `user_metadata` wird übergangsweise
 * mitgeschrieben, damit ein noch laufender alter Serverprozess während eines
 * Deploys weiterhin fündig wird; kann nach ein paar Releases entfallen.
 */
export async function syncUserAuthMetadata(
  userId: string,
  role: RoleType,
  organizationId: string,
  existingMetadata?: Record<string, unknown>,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: buildAuthUserMetadataPatch(undefined, role, organizationId),
    user_metadata: buildAuthUserMetadataPatch(existingMetadata, role, organizationId),
  });
  if (error) {
    console.warn("[bauflip] syncUserAuthMetadata failed:", error.message);
  }
}
