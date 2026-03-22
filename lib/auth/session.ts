import { cookies } from "next/headers";
import type { RoleType, UserProfile } from "@/lib/domain/types";

const roleByCookie: Record<string, RoleType> = {
  admin: "admin",
  monteur: "technician",
  technician: "technician",
  office: "office",
};

export function isMockAuthEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_AUTH === "true";
}

export async function isMockAuthenticated() {
  if (!isMockAuthEnabled()) {
    return false;
  }
  const cookieStore = await cookies();
  return cookieStore.get("bauflip_mock_auth")?.value === "1";
}

export async function getCurrentRole(): Promise<RoleType> {
  if (!isMockAuthEnabled()) {
    return "office";
  }
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get("bauflip_mock_role")?.value ?? "office";
  return roleByCookie[roleCookie] ?? "office";
}

export async function getCurrentProfile(): Promise<UserProfile> {
  const cookieStore = await cookies();
  const role = await getCurrentRole();
  const email = cookieStore.get("bauflip_mock_email")?.value ?? "admin@bauflip.ch";

  return {
    id: `mock-${role}`,
    displayName: role === "admin" ? "Admin" : role === "technician" ? "Monteur" : "Büro",
    email,
    role,
    avatarUrl: null,
  };
}
