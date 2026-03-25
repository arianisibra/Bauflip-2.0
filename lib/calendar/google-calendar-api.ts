/**
 * Google Calendar REST (Server): Access-Token aus Refresh-Token, Event anlegen.
 * Benötigt GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET.
 */

async function refreshGoogleAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
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

export async function createGoogleCalendarEventFromRefresh(
  refreshToken: string,
  event: { summary: string; description: string; start: string; end: string },
): Promise<boolean> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  if (!accessToken) {
    return false;
  }
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      start: { dateTime: startDate.toISOString(), timeZone: "Europe/Zurich" },
      end: { dateTime: endDate.toISOString(), timeZone: "Europe/Zurich" },
    }),
  });
  return res.ok;
}
