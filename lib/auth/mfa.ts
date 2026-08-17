import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LayoutSession } from "@/lib/auth/session";
import { getLayoutSession } from "@/lib/auth/session";

type MfaClient = {
  mfa?: {
    getAuthenticatorAssuranceLevel?: () => Promise<{
      data?: { currentLevel?: string; nextLevel?: string };
    }>;
  };
};

/**
 * "satisfied" = AAL2 erreicht. "needs_enrollment" = kein Faktor vorhanden
 * (nextLevel bleibt aal1 — es gibt nichts, wogegen man sich verifizieren
 * könnte). "needs_challenge" = ein Faktor ist eingerichtet, diese Sitzung hat
 * ihn aber noch nicht verifiziert (nextLevel springt auf aal2). Die
 * Unterscheidung ist wichtig: ohne sie schickte /mfa/setup einen bereits
 * eingerichteten Admin bei jedem Login erneut in enroll() — Supabase erlaubt
 * mehrere TOTP-Faktoren, das hätte still einen zweiten, nutzlosen Faktor
 * angelegt, statt den vorhandenen abzufragen.
 */
export type MfaRequirement = "satisfied" | "needs_enrollment" | "needs_challenge";

async function resolveMfaRequirement(
  supabase: MfaClient,
  role: string | null | undefined,
): Promise<MfaRequirement> {
  const enforce = process.env.ENFORCE_ADMIN_MFA === "true";
  if (!enforce || role !== "admin") {
    return "satisfied";
  }

  const mfaApi = supabase.mfa;
  if (!mfaApi?.getAuthenticatorAssuranceLevel) {
    return process.env.NODE_ENV === "production" ? "needs_enrollment" : "satisfied";
  }

  try {
    const { data } = await mfaApi.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel === "aal2") return "satisfied";
    return data?.nextLevel === "aal2" ? "needs_challenge" : "needs_enrollment";
  } catch (err) {
    // Fail-closed: ein Fehler bei der Stufenprüfung darf niemals als
    // "zweiter Faktor erfüllt" gewertet werden — sonst hebelt ein
    // Supabase-Fehler die MFA-Pflicht komplett aus. "needs_enrollment" ist
    // der konservativste Pfad, wenn der tatsächliche Zustand unbekannt ist.
    console.error("[bauflip] MFA assurance level check failed", err);
    return "needs_enrollment";
  }
}

export async function isAdminMfaRequiredAndMissing(layoutSession?: LayoutSession | null) {
  try {
    const enforce = process.env.ENFORCE_ADMIN_MFA === "true";
    if (!enforce) return false;

    const session = layoutSession ?? (await getLayoutSession());
    if (!session || session.role !== "admin") return false;

    const supabase = await createSupabaseServerClient();
    if (!supabase) return false;

    const requirement = await resolveMfaRequirement(supabase.auth as unknown as MfaClient, session.role);
    return requirement !== "satisfied";
  } catch (err) {
    console.error("[bauflip] isAdminMfaRequiredAndMissing failed", err);
    return true;
  }
}

/**
 * Wie isAdminMfaRequiredAndMissing, liefert aber die passende Route statt
 * eines Booleans — /mfa/setup nur, wenn wirklich noch kein Faktor existiert,
 * sonst /mfa/verify (Login-Zeitpunkt-Challenge für einen bereits
 * eingerichteten Faktor). Gibt null zurück, wenn nichts zu tun ist.
 */
export async function resolveAdminMfaGatePath(
  layoutSession?: LayoutSession | null,
): Promise<"/mfa/setup" | "/mfa/verify" | null> {
  try {
    const session = layoutSession ?? (await getLayoutSession());
    if (!session || session.role !== "admin") return null;

    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const requirement = await resolveMfaRequirement(supabase.auth as unknown as MfaClient, session.role);
    if (requirement === "satisfied") return null;
    return requirement === "needs_challenge" ? "/mfa/verify" : "/mfa/setup";
  } catch (err) {
    console.error("[bauflip] resolveAdminMfaGatePath failed", err);
    return "/mfa/setup";
  }
}

/** Für die Login-Aktion: derselbe Client, der gerade signInWithPassword aufgerufen hat. */
export async function resolveAdminMfaGatePathForClient(
  supabase: SupabaseClient,
  role: string | null | undefined,
): Promise<"/mfa/setup" | "/mfa/verify" | null> {
  try {
    const requirement = await resolveMfaRequirement(supabase.auth as unknown as MfaClient, role);
    if (requirement === "satisfied") return null;
    return requirement === "needs_challenge" ? "/mfa/verify" : "/mfa/setup";
  } catch (err) {
    console.error("[bauflip] resolveAdminMfaGatePathForClient failed", err);
    return "/mfa/setup";
  }
}
