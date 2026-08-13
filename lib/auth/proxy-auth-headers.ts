import { mapRole } from "@/lib/auth/map-role";
import type { RoleType } from "@/lib/domain/types";

/**
 * Interne Request-Header, die proxy.ts NACH erfolgreicher Authentifizierung setzt.
 *
 * SICHERHEITSINVARIANTE: Diese Header dürfen die App ausschliesslich dann
 * erreichen, wenn proxy.ts sie selbst gesetzt hat. Ein Client könnte sie sonst
 * einfach mitschicken und sich Rolle und Organisation frei aussuchen.
 * Deshalb verwirft proxy.ts eingehende Exemplare bedingungslos als Erstes
 * (stripProxyAuthContext) — vor jedem Frühausstieg, auf jedem Rückgabeweg.
 * Wer diese Header liest, verlässt sich auf genau diese Invariante.
 */
export const PROXY_AUTH_USER_ID_HEADER = "x-bauflip-proxy-auth-user-id";
export const PROXY_AUTH_ROLE_HEADER = "x-bauflip-proxy-auth-role";
export const PROXY_AUTH_ORG_ID_HEADER = "x-bauflip-proxy-auth-org-id";

/**
 * Eingehende Proxy-Header verwerfen. MUSS als Erstes im Proxy laufen, damit
 * von aussen mitgeschickte Exemplare nie in die App gelangen.
 */
export function stripProxyAuthContext(headers: Headers): void {
  headers.delete(PROXY_AUTH_USER_ID_HEADER);
  headers.delete(PROXY_AUTH_ROLE_HEADER);
  headers.delete(PROXY_AUTH_ORG_ID_HEADER);
}

export function applyProxyAuthContext(
  headers: Headers,
  ctx: { userId: string; role: RoleType; organizationId: string | null },
): void {
  headers.set(PROXY_AUTH_USER_ID_HEADER, ctx.userId);
  headers.set(PROXY_AUTH_ROLE_HEADER, ctx.role);
  if (ctx.organizationId) {
    headers.set(PROXY_AUTH_ORG_ID_HEADER, ctx.organizationId);
  } else {
    headers.delete(PROXY_AUTH_ORG_ID_HEADER);
  }
}

/** @deprecated use applyProxyAuthContext */
export function applyProxyAuthUserId(headers: Headers, userId: string): void {
  headers.set(PROXY_AUTH_USER_ID_HEADER, userId);
}

export function readProxyAuthUserId(headers: Headers): string | null {
  const raw = headers.get(PROXY_AUTH_USER_ID_HEADER)?.trim();
  return raw || null;
}

export function readProxyAuthRole(headers: Headers): RoleType | null {
  const raw = headers.get(PROXY_AUTH_ROLE_HEADER)?.trim();
  if (!raw) return null;
  return mapRole(raw);
}

export function readProxyAuthOrgId(headers: Headers): string | null {
  const raw = headers.get(PROXY_AUTH_ORG_ID_HEADER)?.trim();
  return raw || null;
}
