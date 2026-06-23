import type { User } from "@supabase/supabase-js";
import { mapRole } from "@/lib/auth/map-role";
import type { RoleType } from "@/lib/domain/types";

export const AUTH_METADATA_ROLE_KEY = "role";
export const AUTH_METADATA_ORG_KEY = "organization_id";

/** Fast-path for proxy when invite/bootstrap synced auth metadata. */
export function readProxyAuthFromUserMetadata(
  user: Pick<User, "user_metadata">,
): { role: RoleType; organizationId: string } | null {
  const meta = user.user_metadata ?? {};
  const roleRaw = meta[AUTH_METADATA_ROLE_KEY];
  const orgRaw = meta[AUTH_METADATA_ORG_KEY];
  if (typeof roleRaw !== "string" || typeof orgRaw !== "string" || !orgRaw.trim()) {
    return null;
  }
  return { role: mapRole(roleRaw), organizationId: orgRaw.trim() };
}

export function buildAuthUserMetadataPatch(
  existing: Record<string, unknown> | undefined,
  role: RoleType,
  organizationId: string,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    [AUTH_METADATA_ROLE_KEY]: role,
    [AUTH_METADATA_ORG_KEY]: organizationId,
  };
}
