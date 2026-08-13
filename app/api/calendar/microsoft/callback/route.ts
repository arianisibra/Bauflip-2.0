import { requireOrgLayoutSession } from "@/lib/auth/organization";
import { exchangeMicrosoftCode } from "@/lib/calendar-sync/microsoft";
import { consumeOAuthStateCookie } from "@/lib/calendar-sync/oauth-state";
import { saveMyCalendarConnection } from "@/lib/calendar-sync/connections";
import { publicOrigin } from "@/lib/auth/public-origin";

export async function GET(request: Request): Promise<Response> {
  // Nicht request.url: hinter dem Proxy zeigt das auf den internen Port, und der
  // Nutzer landet nach dem OAuth-Rückweg auf einer toten localhost-Adresse.
  const base = publicOrigin(new URL(request.url).origin);
  const settingsUrl = new URL("/einstellungen", base);

  try {
    await requireOrgLayoutSession();
  } catch {
    return Response.redirect(new URL("/anmeldung", base), 302);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const stateValid = await consumeOAuthStateCookie("microsoft", state);
  if (!stateValid || !code) {
    settingsUrl.searchParams.set("calendar_sync_error", "microsoft");
    return Response.redirect(settingsUrl, 302);
  }

  try {
    const tokens = await exchangeMicrosoftCode(code);
    await saveMyCalendarConnection("microsoft", tokens);
    settingsUrl.searchParams.set("calendar_sync_connected", "microsoft");
  } catch {
    settingsUrl.searchParams.set("calendar_sync_error", "microsoft");
  }
  return Response.redirect(settingsUrl, 302);
}
