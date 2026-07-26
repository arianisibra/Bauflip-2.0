import "server-only";

import { calendarRedirectUri, type CalendarEventInput, type OAuthTokens } from "@/lib/calendar-sync/types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function buildGoogleAuthorizeUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID fehlt.");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: calendarRedirectUri("google"),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
};

export async function exchangeGoogleCode(code: string): Promise<OAuthTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google-Kalender ist nicht konfiguriert.");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: calendarRedirectUri("google"),
      grant_type: "authorization_code",
    }),
  });
  const data = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new Error(data.error_description || data.error || "Google-Autorisierung fehlgeschlagen.");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export async function refreshGoogleToken(refreshToken: string): Promise<Omit<OAuthTokens, "refreshToken">> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google-Kalender ist nicht konfiguriert.");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google-Token-Erneuerung fehlgeschlagen.");
  }
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

function toGoogleEventBody(input: CalendarEventInput) {
  return {
    summary: input.title,
    description: input.description,
    start: { dateTime: input.startsAt, timeZone: "Europe/Zurich" },
    end: { dateTime: input.endsAt, timeZone: "Europe/Zurich" },
  };
}

/** Legt ein Event an und liefert die Google-Event-ID. */
export async function createGoogleEvent(accessToken: string, input: CalendarEventInput): Promise<string> {
  const response = await fetch(EVENTS_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(toGoogleEventBody(input)),
  });
  const data = (await response.json()) as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || "Google-Event konnte nicht angelegt werden.");
  }
  return data.id;
}

export async function updateGoogleEvent(
  accessToken: string,
  eventId: string,
  input: CalendarEventInput,
): Promise<void> {
  const response = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(toGoogleEventBody(input)),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(data.error?.message || "Google-Event konnte nicht aktualisiert werden.");
  }
}

export async function deleteGoogleEvent(accessToken: string, eventId: string): Promise<void> {
  const response = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  // 404/410: Event bereits weg (z. B. vom Nutzer selbst gelöscht) — kein Fehler.
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(`Google-Event konnte nicht gelöscht werden (${response.status}).`);
  }
}
