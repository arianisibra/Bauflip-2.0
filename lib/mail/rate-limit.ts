import "server-only";

import { consumeRateLimit } from "@/lib/security/rate-limit";

/**
 * Gemeinsames Versand-Budget pro Nutzer über alle Mail-Actions
 * (Offerten + Terminbestätigungen). In-Memory pro Serverless-Instanz —
 * Best-Effort gegen Schleifen/Bursts, kein hartes globales Limit.
 */
const MAIL_RATE_LIMIT = 15;
const MAIL_RATE_WINDOW_MS = 10 * 60_000;

export function assertMailRateLimit(userId: string): void {
  const rate = consumeRateLimit(`mail-send:${userId}`, MAIL_RATE_LIMIT, MAIL_RATE_WINDOW_MS);
  if (!rate.allowed) {
    throw new Error("Zu viele E-Mails in kurzer Zeit — bitte in einigen Minuten erneut versuchen.");
  }
}
