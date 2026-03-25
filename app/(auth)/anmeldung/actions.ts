"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const turnstileToken = String(formData.get("turnstileToken") ?? "");

  if (!email || !password) {
    throw new Error("Bitte E-Mail und Passwort eingeben.");
  }

  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = consumeRateLimit(`login:${ip}:${email}`, 8, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    throw new Error("Zu viele Anmeldeversuche. Bitte in wenigen Minuten erneut versuchen.");
  }

  const captchaOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!captchaOk) {
    throw new Error("Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen.");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error("Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.");
  }

  redirect("/");
}
