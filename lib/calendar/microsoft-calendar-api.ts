/**
 * Microsoft Graph: Refresh-Token → Access-Token, Event anlegen.
 * Benötigt MICROSOFT_CLIENT_ID und MICROSOFT_CLIENT_SECRET.
 */

async function refreshMicrosoftAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "offline_access Calendars.ReadWrite",
  });
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    return null;
  }
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

export async function createMicrosoftCalendarEventFromRefresh(
  refreshToken: string,
  event: { summary: string; description: string; start: string; end: string },
): Promise<boolean> {
  const accessToken = await refreshMicrosoftAccessToken(refreshToken);
  if (!accessToken) {
    return false;
  }
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: event.summary,
      body: { contentType: "Text", content: event.description },
      start: { dateTime: startDate.toISOString(), timeZone: "Europe/Zurich" },
      end: { dateTime: endDate.toISOString(), timeZone: "Europe/Zurich" },
    }),
  });
  return res.ok;
}
