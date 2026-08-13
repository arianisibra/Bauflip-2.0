import "server-only";

import type { User } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { RoleType, UserProfile } from "@/lib/domain/types";
import { hasSupabaseAuthCookie } from "@/lib/auth/cookies";
import { mapRole } from "@/lib/auth/map-role";
import { mapUserProfileRow } from "@/lib/db/repository";
import {
  readProxyAuthOrgId,
  readProxyAuthRole,
  readProxyAuthUserId,
} from "@/lib/auth/proxy-auth-headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type CurrentSession = {
  user: User;
  role: RoleType;
  organizationId: string | null;
  profile: UserProfile;
};

/** Slim session for layouts — no profile DB, no membership query when proxy headers match. */
export type LayoutSession = {
  userId: string;
  role: RoleType;
  organizationId: string | null;
};

/** Display fields for header / tech pages — loaded once per layout request. */
export type SessionProfileSnapshot = {
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  role: RoleType;
};

function mockLayoutSessionFromCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  mockAuthEnabled: boolean,
): LayoutSession | null {
  const mockAuthenticated = cookieStore.get("bauflip_mock_auth")?.value === "1";
  if (!mockAuthEnabled || !mockAuthenticated) return null;
  const mockRole = mapRole(cookieStore.get("bauflip_mock_role")?.value);
  return { userId: "mock-user", role: mockRole, organizationId: null };
}

/** Read email from the Supabase auth cookie JWT — no Auth API round-trip. */
function readEmailFromSupabaseAuthCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): string | null {
  const authCookie = cookieStore
    .getAll()
    .find((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  if (!authCookie?.value) return null;

  try {
    const parsed = JSON.parse(authCookie.value) as { access_token?: string };
    const accessToken = parsed.access_token;
    if (!accessToken) return null;
    const payloadSegment = accessToken.split(".")[1];
    if (!payloadSegment) return null;
    const payload = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    ) as { email?: string };
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the authenticated user. When proxy already ran getUser() this
 * request, reuse the cookie session (no second Auth API round-trip).
 */
async function resolveAuthUser(supabase: SupabaseClient): Promise<User | null> {
  let proxyUserId: string | null = null;
  try {
    const headerStore = await headers();
    proxyUserId = readProxyAuthUserId(headerStore);
  } catch {
    proxyUserId = null;
  }

  if (proxyUserId) {
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user ?? null;
    if (!error && user?.id === proxyUserId) {
      return user;
    }
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn("[bauflip] auth.getUser:", error.message);
  }
  return data?.user ?? null;
}

/**
 * Lightweight layout auth: proxy headers + cookie session verification.
 * Falls back to full getCurrentSession when headers are missing (e.g. tests).
 */
export const getLayoutSession = cache(async function getLayoutSession(): Promise<LayoutSession | null> {
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch {
    return null;
  }

  const mockAuthEnabled =
    process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_AUTH === "true";
  const mockSession = mockLayoutSessionFromCookies(cookieStore, mockAuthEnabled);
  if (mockSession) return mockSession;

  let proxyUserId: string | null = null;
  let proxyRole: RoleType | null = null;
  let proxyOrgId: string | null = null;
  try {
    const headerStore = await headers();
    proxyUserId = readProxyAuthUserId(headerStore);
    proxyRole = readProxyAuthRole(headerStore);
    proxyOrgId = readProxyAuthOrgId(headerStore);
  } catch {
    proxyUserId = null;
  }

  if (proxyUserId && proxyRole && hasSupabaseAuthCookie(cookieStore.getAll())) {
    return {
      userId: proxyUserId,
      role: proxyRole,
      organizationId: proxyOrgId,
    };
  }

  const full = await getCurrentSession();
  if (!full) return null;
  return {
    userId: full.user.id,
    role: full.role,
    organizationId: full.organizationId,
  };
});

/** Single profiles row for layout / slim actions — no membership query. */
export const getCachedSessionProfile = cache(async function getCachedSessionProfile(
  layoutSession: LayoutSession,
): Promise<SessionProfileSnapshot> {
  const full = await getCachedUserProfile(layoutSession);
  return {
    userId: full.id,
    role: full.role,
    displayName: full.displayName,
    email: full.email || null,
    avatarUrl: full.avatarUrl,
  };
});

/** Full profile row for settings — no membership query. */
export const getCachedUserProfile = cache(async function getCachedUserProfile(
  layoutSession: LayoutSession,
): Promise<UserProfile> {
  const { userId, role } = layoutSession;
  const supabase = await createSupabaseServerClient();
  let cookieStore: Awaited<ReturnType<typeof cookies>> | null = null;
  try {
    cookieStore = await cookies();
  } catch {
    cookieStore = null;
  }
  const emailFromCookie = cookieStore ? readEmailFromSupabaseAuthCookie(cookieStore) : null;

  if (!supabase) {
    return {
      id: userId,
      displayName: role === "admin" ? "Admin" : role === "technician" ? "Monteur" : "Büro",
      email: emailFromCookie ?? "",
      role,
      avatarUrl: null,
      calendarColor: null,
      calendarPosition: 0,
    };
  }

  const { data: row } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, calendar_color, calendar_position")
    .eq("id", userId)
    .maybeSingle();

  const displayName =
    (row?.display_name != null && String(row.display_name).trim()
      ? String(row.display_name).trim()
      : null) ??
    (emailFromCookie?.split("@")[0] ?? "Benutzer");
  const avatarUrl =
    row?.avatar_url != null && String(row.avatar_url).trim() ? String(row.avatar_url).trim() : null;

  return {
    id: userId,
    displayName,
    email: emailFromCookie ?? "",
    role,
    avatarUrl,
    calendarColor: row?.calendar_color != null ? String(row.calendar_color) : null,
    calendarPosition: typeof row?.calendar_position === "number" ? row.calendar_position : 0,
  };
});

export const getCurrentSession = cache(async function getCurrentSession(): Promise<CurrentSession | null> {
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch (err) {
    console.error("[bauflip] cookies() in getCurrentSession failed", err);
    return null;
  }
  /**
   * Mock-Cookies (bauflip_mock_*) nur in Development oder wenn explizit erlaubt.
   * In Live-Umgebungen ALLOW_MOCK_AUTH niemals setzen — dokumentiert in .env.example.
   */
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_AUTH === "true") {
    console.warn(
      "[bauflip] ALLOW_MOCK_AUTH is enabled in production — disable for real deployments.",
    );
  }
  const mockAuthEnabled =
    process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_AUTH === "true";
  const mockAuthenticated = cookieStore.get("bauflip_mock_auth")?.value === "1";
  const mockRole = mapRole(cookieStore.get("bauflip_mock_role")?.value);
  const mockEmail = cookieStore.get("bauflip_mock_email")?.value ?? "mock@bauflip.ch";

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch (err) {
    console.error("[bauflip] createSupabaseServerClient failed", err);
    return null;
  }
  if (!supabase) {
    if (mockAuthEnabled && mockAuthenticated) {
      return {
        user: {
          id: "mock-user",
          email: mockEmail,
          user_metadata: { role: mockRole, display_name: mockRole === "admin" ? "Admin" : "Büro" },
        } as unknown as User,
        role: mockRole,
        organizationId: null,
        profile: {
          id: "mock-user",
          displayName: mockRole === "admin" ? "Admin" : mockRole === "technician" ? "Monteur" : "Büro",
          email: mockEmail,
          role: mockRole,
          avatarUrl: null,
          calendarColor: null,
          calendarPosition: 0,
        },
      };
    }
    return null;
  }

  let user: User | null = null;
  try {
    user = await resolveAuthUser(supabase);
  } catch (err) {
    console.error("[bauflip] resolveAuthUser failed", err);
    user = null;
  }

  if (!user) {
    if (mockAuthEnabled && mockAuthenticated) {
      return {
        user: {
          id: "mock-user",
          email: mockEmail,
          user_metadata: { role: mockRole, display_name: mockRole === "admin" ? "Admin" : "Büro" },
        } as unknown as User,
        role: mockRole,
        organizationId: null,
        profile: {
          id: "mock-user",
          displayName: mockRole === "admin" ? "Admin" : mockRole === "technician" ? "Monteur" : "Büro",
          email: mockEmail,
          role: mockRole,
          avatarUrl: null,
          calendarColor: null,
          calendarPosition: 0,
        },
      };
    }
    return null;
  }

  try {
    const [membershipResponse, profileResponse] = await Promise.all([
      supabase
        .from("organization_memberships")
        .select("role, organization_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, display_name, role, avatar_url, calendar_color, calendar_position")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const membershipRole = membershipResponse.data?.role as string | null | undefined;
    // Fallback nur aus app_metadata (Service-Role-geschützt) — niemals aus dem
    // nutzer-beschreibbaren user_metadata.
    const role = mapRole(membershipRole ?? (user.app_metadata?.role as string | null | undefined));
    const organizationId = (membershipResponse.data?.organization_id as string | null | undefined) ?? null;

    if (!profileResponse.data) {
      const displayName =
        String(user.user_metadata?.display_name ?? "").trim() ||
        user.email?.split("@")[0] ||
        "Benutzer";
      const { data: inserted } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            display_name: displayName,
            role,
          },
          { onConflict: "id" },
        )
        .select("id, display_name, role, avatar_url, calendar_color, calendar_position")
        .single();

      if (inserted) {
        return {
          user,
          role,
          organizationId,
          profile: mapUserProfileRow(inserted as Record<string, unknown>, user.email ?? ""),
        };
      }
    }

    const row = profileResponse.data as Record<string, unknown> | null;

    return {
      user,
      role,
      organizationId,
      profile: (() => {
        if (!row) {
          return {
            id: user.id,
            displayName: user.email?.split("@")[0] ?? "Benutzer",
            email: user.email ?? "",
            role,
            avatarUrl: null,
            calendarColor: null,
            calendarPosition: 0,
          };
        }
        // Ensure profile role stays consistent with resolved session role.
        const mapped = mapUserProfileRow(row, user.email ?? "");
        return { ...mapped, role };
      })(),
    };
  } catch (err) {
    console.error("[bauflip] session membership/profile failed", err);
    // Rolle nur aus app_metadata (Service-Role-geschützt), nie aus user_metadata.
    const role = mapRole(user.app_metadata?.role as string | null | undefined);
    const displayName =
      String(user.user_metadata?.display_name ?? "").trim() ||
      user.email?.split("@")[0] ||
      "Benutzer";
    return {
      user,
      role,
      organizationId: null,
      profile: {
        id: user.id,
        displayName,
        email: user.email ?? "",
        role,
        avatarUrl: null,
        calendarColor: null,
        calendarPosition: 0,
      },
    };
  }
});

export async function getCurrentRole(): Promise<RoleType> {
  const session = await getCurrentSession();
  return session?.role ?? "office";
}

export async function getCurrentProfile(): Promise<UserProfile> {
  const session = await getCurrentSession();
  if (session) {
    return session.profile;
  }

  return {
    id: "anonymous",
    displayName: "Gast",
    email: "",
    role: "office",
    avatarUrl: null,
    calendarColor: null,
    calendarPosition: 0,
  };
}
