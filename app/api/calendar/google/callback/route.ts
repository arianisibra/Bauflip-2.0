import { requireOrgLayoutSession } from "@/lib/auth/organization";
import { exchangeGoogleCode } from "@/lib/calendar-sync/google";
import { consumeOAuthStateCookie } from "@/lib/calendar-sync/oauth-state";
import { saveMyCalendarConnection } from "@/lib/calendar-sync/connections";

export async function GET(request: Request): Promise<Response> {
  const settingsUrl = new URL("/einstellungen", request.url);

  try {
    await requireOrgLayoutSession();
  } catch {
    return Response.redirect(new URL("/anmeldung", request.url), 302);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const stateValid = await consumeOAuthStateCookie("google", state);
  if (!stateValid || !code) {
    settingsUrl.searchParams.set("calendar_sync_error", "google");
    return Response.redirect(settingsUrl, 302);
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    await saveMyCalendarConnection("google", tokens);
    settingsUrl.searchParams.set("calendar_sync_connected", "google");
  } catch {
    settingsUrl.searchParams.set("calendar_sync_error", "google");
  }
  return Response.redirect(settingsUrl, 302);
}
