import { requireOrgLayoutSession } from "@/lib/auth/organization";
import { buildMicrosoftAuthorizeUrl, isMicrosoftCalendarConfigured } from "@/lib/calendar-sync/microsoft";
import { setOAuthStateCookie } from "@/lib/calendar-sync/oauth-state";

export async function GET(): Promise<Response> {
  try {
    await requireOrgLayoutSession();
  } catch {
    return new Response("Nicht angemeldet.", { status: 401 });
  }
  if (!isMicrosoftCalendarConfigured()) {
    return new Response("Microsoft-Kalender ist nicht konfiguriert.", { status: 400 });
  }
  const state = await setOAuthStateCookie("microsoft");
  return Response.redirect(buildMicrosoftAuthorizeUrl(state), 302);
}
