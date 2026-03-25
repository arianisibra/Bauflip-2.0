import type { User } from "@supabase/supabase-js";
import type { RoleType, UserProfile } from "@/lib/domain/types";
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

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: roleData }, { data: orgData }, profileResponse] = await Promise.all([
    supabase.rpc("current_user_role"),
    supabase.rpc("current_organization_id"),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);

  const role = mapRole((roleData as string | null | undefined) ?? user.user_metadata?.role);
  const organizationId = (orgData as string | null | undefined) ?? null;

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
          email: user.email ?? "",
          display_name: displayName,
          role,
          avatar_url: null,
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (inserted) {
      return {
        user,
        role,
        organizationId,
        profile: inserted as unknown as UserProfile,
      };
    }
  }

  return {
    user,
    role,
    organizationId,
    profile: (profileResponse.data as unknown as UserProfile) ?? {
      id: user.id,
      displayName: user.email?.split("@")[0] ?? "Benutzer",
      email: user.email ?? "",
      role,
      avatarUrl: null,
    },
  };
}

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
  };
}
