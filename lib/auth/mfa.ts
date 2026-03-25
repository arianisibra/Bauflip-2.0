import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/lib/auth/session";

export async function isAdminMfaRequiredAndMissing() {
  const enforce = process.env.ENFORCE_ADMIN_MFA === "true";
  if (!enforce) {
    return false;
  }

  const session = await getCurrentSession();
  if (!session || session.role !== "admin") {
    return false;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return false;
  }

  const mfaApi = (supabase.auth as { mfa?: { getAuthenticatorAssuranceLevel?: () => Promise<{ data?: { currentLevel?: string } }> } }).mfa;
  if (!mfaApi?.getAuthenticatorAssuranceLevel) {
    return process.env.NODE_ENV === "production";
  }

  const { data } = await mfaApi.getAuthenticatorAssuranceLevel();
  return data?.currentLevel !== "aal2";
}
