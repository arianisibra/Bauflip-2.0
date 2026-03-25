import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/anmeldung");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expected = cookieStore.get("oauth_cal_state")?.value;
  cookieStore.delete("oauth_cal_state");
  cookieStore.delete("oauth_cal_provider");

  if (!code || !state || !expected || state !== expected) {
    redirect("/integrationen?calendar=error");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!clientId || !clientSecret || !siteUrl) {
    redirect("/integrationen?calendar=config");
  }

  const redirectUri = `${siteUrl}/api/calendar/google/callback`;
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenRes.ok) {
    redirect("/integrationen?calendar=token");
  }

  const tokenJson = (await tokenRes.json()) as { refresh_token?: string; access_token?: string };
  const refreshToken = tokenJson.refresh_token;
  if (!refreshToken) {
    redirect("/integrationen?calendar=norefresh");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/integrationen?calendar=nodb");
  }

  const { error } = await supabase.from("calendar_provider_tokens").upsert(
    {
      profile_id: session.user.id,
      provider: "google",
      refresh_token: refreshToken,
      email_hint: session.profile.email || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,provider" },
  );

  if (error) {
    redirect("/integrationen?calendar=save");
  }

  redirect("/integrationen?calendar=google");
}
