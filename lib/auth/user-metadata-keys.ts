import type { User } from "@supabase/supabase-js";
import { mapRole } from "@/lib/auth/map-role";
import type { RoleType } from "@/lib/domain/types";

export const AUTH_METADATA_ROLE_KEY = "role";
export const AUTH_METADATA_ORG_KEY = "organization_id";

/**
 * Schnellweg für den Proxy: Rolle/Organisation aus `app_metadata` lesen.
 *
 * Bewusst app_metadata, NICHT user_metadata:
 * - `user_metadata` kann der Nutzer selbst beschreiben (updateUser) — als
 *   Quelle für Rechte wäre das eine Lücke.
 * - Die RLS-Regeln der Datenbank lesen seit jeher `auth.jwt()->'app_metadata'`
 *   (siehe supabase/migrations/*_init_bauflip_mvp.sql) — der Proxy folgt damit
 *   derselben Quelle wie die Datenbank selbst.
 * - Gemessen am 01.09.2026: user_metadata war nur bei 6 von 11 Nutzern gesetzt,
 *   app_metadata bei allen 11 und deckungsgleich mit organization_memberships.
 *   Für die 5 anderen lief bei JEDER Anfrage eine Ersatzabfrage auf
 *   `organization_memberships` — die häufigste Abfrage der ganzen Datenbank.
 *
 * Fehlt eine der Angaben, liefert die Funktion null und der Proxy fällt wie
 * bisher auf die Mitgliedschafts-Abfrage zurück.
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
