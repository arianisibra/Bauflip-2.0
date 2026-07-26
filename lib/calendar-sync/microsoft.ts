import "server-only";

import { calendarRedirectUri, type CalendarEventInput, type OAuthTokens } from "@/lib/calendar-sync/types";

const AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const EVENTS_URL = "https://graph.microsoft.com/v1.0/me/events";
const SCOPE = "offline_access Calendars.ReadWrite";

export function isMicrosoftCalendarConfigured(): boolean {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

export function buildMicrosoftAuthorizeUrl(state: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) throw new Error("MICROSOFT_CLIENT_ID fehlt.");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: calendarRedirectUri("microsoft"),
    response_type: "code",
    scope: SCOPE,
    response_mode: "query",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
};

export async function exchangeMicrosoftCode(code: string): Promise<OAuthTokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Microsoft-Kalender ist nicht konfiguriert.");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: calendarRedirectUri("microsoft"),
      grant_type: "authorization_code",
      scope: SCOPE,
    }),
  });
  const data = (await response.json()) as MicrosoftTokenResponse;
  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new Error(data.error_description || data.error || "Microsoft-Autorisierung fehlgeschlagen.");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export async function refreshMicrosoftToken(refreshToken: string): Promise<OAuthTokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Microsoft-Kalender ist nicht konfiguriert.");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      scope: SCOPE,
    }),
  });
  const data = (await response.json()) as MicrosoftTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Microsoft-Token-Erneuerung fehlgeschlagen.");
  }
  return {
    accessToken: data.access_token,
    // Microsoft liefert bei Refresh i. d. R. einen neuen Refresh-Token (Rotation) — behalte den alten nur als Fallback.
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

function toMicrosoftEventBody(input: CalendarEventInput) {
  return {
    subject: input.title,
    body: { contentType: "text", content: input.description },
    start: { dateTime: input.startsAt, timeZone: "W. Europe Standard Time" },
    end: { dateTime: input.endsAt, timeZone: "W. Europe Standard Time" },
  };
}

export async function createMicrosoftEvent(accessToken: string, input: CalendarEventInput): Promise<string> {
  const response = await fetch(EVENTS_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(toMicrosoftEventBody(input)),
  });
  const data = (await response.json()) as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || "Microsoft-Event konnte nicht angelegt werden.");
  }
  return data.id;
}

export async function updateMicrosoftEvent(
  accessToken: string,
  eventId: string,
  input: CalendarEventInput,
): Promise<void> {
  const response = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(toMicrosoftEventBody(input)),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(data.error?.message || "Microsoft-Event konnte nicht aktualisiert werden.");
  }
}

export async function deleteMicrosoftEvent(accessToken: string, eventId: string): Promise<void> {
  const response = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Microsoft-Event konnte nicht gelöscht werden (${response.status}).`);
  }
}
