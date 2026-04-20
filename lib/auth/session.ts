import "server-only";

import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import type { RoleType, UserProfile } from "@/lib/domain/types";
import { mapUserProfileRow } from "@/lib/db/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CurrentSession = {
  user: User;
  role: RoleType;
  organizationId: string | null;
  profile: UserProfile;
};

function mapRole(raw: string | null | undefined): RoleType {
  if (raw === "admin" || raw === "technician" || raw === "office") {
    return raw;
  }
  if (raw === "monteur") {
    return "technician";
  }
  return "office";
}

export const getCurrentSession = cache(async function getCurrentSession(): Promise<CurrentSession | null> {
  const cookieStore = await cookies();
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

  const supabase = await createSupabaseServerClient();
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  const role = mapRole(membershipRole ?? (user.user_metadata?.role as string | null | undefined));
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
