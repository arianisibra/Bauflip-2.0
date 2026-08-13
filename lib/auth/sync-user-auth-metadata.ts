import "server-only";

import type { RoleType } from "@/lib/domain/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildAuthAppMetadataPatch } from "@/lib/auth/user-metadata-keys";

/**
 * Rolle + Organisation in `app_metadata` spiegeln, damit der Proxy die
 * Membership-Abfrage überspringen kann. `app_metadata` ist nur mit der
 * Service-Role beschreibbar — deshalb darf der Proxy darauf vertrauen.
 */
export async function syncUserAuthMetadata(
  userId: string,
  role: RoleType,
  organizationId: string,
  existingAppMetadata?: Record<string, unknown>,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: buildAuthAppMetadataPatch(existingAppMetadata, role, organizationId),
  });
  if (error) {
    console.warn("[bauflip] syncUserAuthMetadata failed:", error.message);
  }
}
