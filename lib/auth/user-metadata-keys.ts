import type { User } from "@supabase/supabase-js";
import { mapRole } from "@/lib/auth/map-role";
import type { RoleType } from "@/lib/domain/types";

export const AUTH_METADATA_ROLE_KEY = "role";
export const AUTH_METADATA_ORG_KEY = "organization_id";

/**
 * Fast-path für den Proxy: Rolle + Organisation aus `app_metadata`.
 *
 * WICHTIG: Nur `app_metadata` (= raw_app_meta_data) ist ausschliesslich mit der
 * Service-Role beschreibbar. `user_metadata` kann der Nutzer selbst per
 * `supabase.auth.updateUser({ data: … })` setzen — dort darf keine
 * Autorisierungsentscheidung hängen, sonst macht sich ein Monteur zum Admin.
 */
export function readProxyAuthFromAppMetadata(
  user: Pick<User, "app_metadata">,
): { role: RoleType; organizationId: string } | null {
  const meta = user.app_metadata ?? {};
  const roleRaw = meta[AUTH_METADATA_ROLE_KEY];
  const orgRaw = meta[AUTH_METADATA_ORG_KEY];
  if (typeof roleRaw !== "string" || typeof orgRaw !== "string" || !orgRaw.trim()) {
    return null;
  }
  return { role: mapRole(roleRaw), organizationId: orgRaw.trim() };
}

/** Patch für `app_metadata`: bestehende Werte erhalten, Rolle + Org setzen. */
export function buildAuthAppMetadataPatch(
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
