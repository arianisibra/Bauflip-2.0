import "server-only";

import { cookies } from "next/headers";

const COOKIE_PREFIX = "bauflip_cal_oauth_";

/** CSRF-Nonce für den OAuth-Redirect — kurzlebiges httpOnly-Cookie, provider-spezifisch. */
export async function setOAuthStateCookie(provider: string): Promise<string> {
  const state = crypto.randomUUID();
  const store = await cookies();
  store.set(`${COOKIE_PREFIX}${provider}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return state;
}

export async function consumeOAuthStateCookie(provider: string, receivedState: string | null): Promise<boolean> {
  const store = await cookies();
  const cookieName = `${COOKIE_PREFIX}${provider}`;
  const expected = store.get(cookieName)?.value;
  store.delete(cookieName);
  return Boolean(expected) && expected === receivedState;
}
