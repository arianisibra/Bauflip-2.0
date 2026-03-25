export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string | null,
): Promise<boolean> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  if (!token) {
    return false;
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as { success?: boolean };
  return payload.success === true;
}
