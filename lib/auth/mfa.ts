import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LayoutSession } from "@/lib/auth/session";
import { getLayoutSession } from "@/lib/auth/session";

export async function isAdminMfaRequiredAndMissing(layoutSession?: LayoutSession | null) {
  try {
    const enforce = process.env.ENFORCE_ADMIN_MFA === "true";
    if (!enforce) {
      return false;
    }

    const session = layoutSession ?? (await getLayoutSession());
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

    try {
      const { data } = await mfaApi.getAuthenticatorAssuranceLevel();
      return data?.currentLevel !== "aal2";
    } catch (err) {
      // Fail-closed: ein Fehler bei der Stufenprüfung darf niemals als
      // "zweiter Faktor erfüllt" gewertet werden — sonst hebelt ein
      // Supabase-Fehler die MFA-Pflicht komplett aus.
      console.error("[bauflip] MFA assurance level check failed", err);
      return true;
    }
  } catch (err) {
    console.error("[bauflip] isAdminMfaRequiredAndMissing failed", err);
    return true;
  }
}
