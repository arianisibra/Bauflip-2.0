import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * SMTP-Versand über Env-Konfiguration (Provider-neutral: Resend, Postmark,
 * eigener SMTP — alle bieten SMTP-Endpunkte). Siehe .env.example.
 */

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    throw new Error(
      "E-Mail-Versand ist nicht konfiguriert (SMTP_HOST/MAIL_FROM in .env setzen).",
    );
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
  return cachedTransporter;
}

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  /** Anzeigename des Absenders (z. B. Organisationsname); Adresse kommt aus MAIL_FROM. */
  fromName?: string;
  replyTo?: string;
  attachments?: MailAttachment[];
  /** iCal-Einladung (text/calendar-Part) — Outlook/Google/Apple buchen direkt ein. */
  icalEvent?: { method: "REQUEST" | "CANCEL"; content: string };
};

export async function sendMail(input: SendMailInput): Promise<void> {
  const fromAddress = process.env.MAIL_FROM;
  if (!fromAddress) {
    throw new Error(
      "E-Mail-Versand ist nicht konfiguriert (SMTP_HOST/MAIL_FROM in .env setzen).",
    );
  }
  const transporter = getTransporter();
  await transporter.sendMail({
    from: input.fromName ? { name: input.fromName, address: fromAddress } : fromAddress,
    to: input.to,
    subject: input.subject,
    text: input.text,
    replyTo: input.replyTo,
    attachments: input.attachments,
    icalEvent: input.icalEvent
      ? { method: input.icalEvent.method, content: input.icalEvent.content }
      : undefined,
  });
}

/** Absender-Adresse für ORGANIZER-Felder in iCal-Einladungen. */
export function getMailFromAddress(): string | null {
  return process.env.MAIL_FROM || null;
}
