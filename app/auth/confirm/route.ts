import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Auth-Callback für E-Mail-Links (Einladung, Passwort-Reset, Magic-Link).
 * Tauscht den Token aus der URL gegen eine **Session** (schreibt das Cookie über den
 * SSR-Client) und leitet dann weiter. Ohne diese Route wird der Token nie in eine
 * Session umgewandelt → eine evtl. bestehende (fremde) Session bleibt aktiv und man
 * landet im falschen Konto.
 *
 * Unterstützt beide Supabase-Flows:
 *  - `token_hash` + `type`  (empfohlen, Email-Template zeigt auf diese Route)
 *  - `code`                 (PKCE-Fallback, falls Default-Template via /auth/v1/verify kommt)
 */

/** Nur same-origin-relative Ziele erlauben (kein `//host`, kein Schema). */
function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/onboarding";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/anmeldung?error=config", origin));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/anmeldung?error=invite", origin));
}
