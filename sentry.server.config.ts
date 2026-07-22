import * as Sentry from "@sentry/nextjs";

// Ohne DSN (kein Sentry-Konto verknüpft) bleibt das Monitoring inaktiv — analog SMTP/Bexio.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
}
