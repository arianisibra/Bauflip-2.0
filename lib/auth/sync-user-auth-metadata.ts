import "server-only";

import type { RoleType } from "@/lib/domain/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildAuthUserMetadataPatch } from "@/lib/auth/user-metadata-keys";

/** Mirror membership into JWT user_metadata for proxy fast-path. */
export async function syncUserAuthMetadata(
  userId: string,
  role: RoleType,
  organizationId: string,
  existingMetadata?: Record<string, unknown>,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: buildAuthUserMetadataPatch(existingMetadata, role, organizationId),
  });
  if (error) {
    console.warn("[bauflip] syncUserAuthMetadata failed:", error.message);
  }
}
