import nodemailer from "nodemailer";

type MailInput = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
};

function buildTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendMailViaSmtp(input: MailInput) {
  const transport = buildTransport();
  if (!transport) {
    return {
      ok: false as const,
      error:
        "SMTP nicht konfiguriert. Bitte SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS setzen.",
    };
  }

  const from = process.env.RESEND_FROM_EMAIL ?? process.env.SMTP_FROM ?? "operations@bauflip.ch";
  try {
    const response = await transport.sendMail({
      from,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
    });
    return { ok: true as const, messageId: response.messageId };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "SMTP Fehler" };
  }
}
