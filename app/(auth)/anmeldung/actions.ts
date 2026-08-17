"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTrustedClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { resolveAdminMfaGatePathForClient } from "@/lib/auth/mfa";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loginAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const turnstileToken = String(formData.get("turnstileToken") ?? "");

  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }

  const headerList = await headers();
  const ip = getTrustedClientIp(headerList.get("x-forwarded-for"));
  const rateLimit = consumeRateLimit(`login:${ip}:${email}`, 8, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    return { error: "Zu viele Anmeldeversuche. Bitte in wenigen Minuten erneut versuchen." };
  }

  const captchaOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!captchaOk) {
    return { error: "Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: "Supabase ist nicht konfiguriert." };
  }

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen." };
  }

  // Zweiten Faktor einfordern, BEVOR die volle Sitzung (Weiterleitung auf "/")
  // beginnt — sonst hätte ein Admin mit nur Passwort kurzzeitig Zugriff, bis
  // die nächste geschützte Aktion die AAL2-Prüfung greift. Unterscheidet
  // "noch kein Faktor eingerichtet" (/mfa/setup) von "Faktor vorhanden, diese
  // Sitzung hat ihn noch nicht bestätigt" (/mfa/verify) — sonst würde ein
  // bereits eingerichteter Admin bei jedem Login erneut in enroll() landen.
  const role = signInData.user?.app_metadata?.role as string | undefined;
  const mfaGatePath = await resolveAdminMfaGatePathForClient(supabase, role);
  if (mfaGatePath) {
    redirect(mfaGatePath);
  }

  redirect("/");
}
