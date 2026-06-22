"use server";

import { getCachedSessionProfile, getCachedUserProfile, getLayoutSession } from "@/lib/auth/session";
import { getOrganizationBranding } from "@/lib/db/repository";
import type { RoleType } from "@/lib/domain/types";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export async function fetchOrganizationBrandingAction() {
  const session = await getLayoutSession();
  if (!session) {
    return { name: "Bauflip", logoUrl: null as string | null };
  }
  return getOrganizationBranding(session.organizationId);
}

export async function fetchSessionProfileAction(): Promise<{
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  role: RoleType;
} | null> {
  const session = await getLayoutSession();
  if (!session) return null;
  return getCachedSessionProfile(session);
}

export async function fetchEinstellungenPageDataAction(): Promise<{
  profile: Awaited<ReturnType<typeof getCachedUserProfile>>;
  canEditCompanySettings: boolean;
  supabaseConfigured: boolean;
} | null> {
  const session = await getLayoutSession();
  if (!session) return null;

  const profile = await getCachedUserProfile(session);
  return {
    profile,
    canEditCompanySettings: session.role === "admin",
    supabaseConfigured: hasSupabaseConfig(),
  };
}
