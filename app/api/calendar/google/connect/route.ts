import { requireOrgLayoutSession } from "@/lib/auth/organization";
import { buildGoogleAuthorizeUrl, isGoogleCalendarConfigured } from "@/lib/calendar-sync/google";
import { setOAuthStateCookie } from "@/lib/calendar-sync/oauth-state";

export async function GET(): Promise<Response> {
  try {
    await requireOrgLayoutSession();
  } catch {
    return new Response("Nicht angemeldet.", { status: 401 });
  }
  if (!isGoogleCalendarConfigured()) {
    return new Response("Google-Kalender ist nicht konfiguriert.", { status: 400 });
  }
  const state = await setOAuthStateCookie("google");
  return Response.redirect(buildGoogleAuthorizeUrl(state), 302);
}
