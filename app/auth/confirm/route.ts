import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/auth/public-origin";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Auth-Callback für E-Mail-Links (Einladung, Passwort-Reset, Magic-Link).
 * Tauscht den Token aus der URL gegen eine **Session** (schreibt das Cookie über den
 * SSR-Client) und leitet dann weiter. Ohne diese Route wird der Token nie in eine
 * Session umgewandelt → eine evtl. bestehende (fremde) Session bleibt aktiv und man
 * landet im falschen Konto.
 *
 * Unterstützt drei Supabase-Flows:
 *  - `token_hash` + `type`  (empfohlen, Email-Template zeigt auf diese Route)
 *  - `code`                 (PKCE-Fallback)
 *  - Hash-Fragment          (Standard-Template über /auth/v1/verify): Supabase löst den
 *                           Token selbst ein und hängt die fertige Session als
 *                           `#access_token=…` an. Fragmente erreichen den Server nie,
 *                           deshalb übernimmt /auth/hash den Rest im Browser.
 */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  // Nicht `origin`: hinter dem Proxy zeigt das auf den internen Port.
  const base = publicOrigin(origin);
  // Gegen den eigenen Ursprung auflösen, nicht bloss die Zeichenkette prüfen —
  // sonst führt `/\evil.com` nach erfolgreicher Anmeldung auf eine fremde Seite.
  const next = safeNextPath(searchParams.get("next"), base);

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/anmeldung?error=config", base));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, base));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, base));
  } else {
    // Weder token_hash noch code: Womöglich steckt die Session im Fragment.
    // Der Browser hängt es bei dieser Weiterleitung von selbst wieder an.
    return NextResponse.redirect(
      new URL(`/auth/hash?next=${encodeURIComponent(next)}`, base),
    );
  }

  return NextResponse.redirect(new URL("/anmeldung?error=invite", base));
}
