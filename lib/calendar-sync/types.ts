export type CalendarProvider = "google" | "microsoft";

export type OAuthTokens = {
  accessToken: string;
  refreshToken: string;
  /** ISO-Timestamp. */
  expiresAt: string;
};

export type CalendarEventInput = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
};

function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!url) throw new Error("NEXT_PUBLIC_SITE_URL fehlt.");
  return url.replace(/\/$/, "");
}

export function calendarRedirectUri(provider: CalendarProvider): string {
  return `${siteUrl()}/api/calendar/${provider}/callback`;
}
