import { mapRole } from "@/lib/auth/map-role";
import type { RoleType } from "@/lib/domain/types";

/**
 * Internal request headers set by proxy.ts after auth.
 * Not trusted alone — getLayoutSession / getCurrentSession must match cookie session.
 */
export const PROXY_AUTH_USER_ID_HEADER = "x-bauflip-proxy-auth-user-id";
export const PROXY_AUTH_ROLE_HEADER = "x-bauflip-proxy-auth-role";
export const PROXY_AUTH_ORG_ID_HEADER = "x-bauflip-proxy-auth-org-id";

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
