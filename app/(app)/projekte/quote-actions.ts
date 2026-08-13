"use server";

import { requireAdminSession, requireOfficeSession } from "@/lib/auth/organization";
import { getCachedSessionProfile } from "@/lib/auth/session";
import {
  createQuote,
  deleteQuote,
  getQuotePdfProjectHead,
  getQuoteWithItems,
  listQuotesForProject,
  setQuoteStatus,
  updateQuote,
} from "@/lib/db/quotes";
import { EMPTY_ORGANIZATION_BILLING_SETTINGS, getOrganizationBillingSettings } from "@/lib/db/billing";
import { getOrganizationBranding, listAdminEmailsForOrg } from "@/lib/db/repository";
import type { Quote } from "@/lib/domain/types";
import { assertMailRateLimit } from "@/lib/mail/rate-limit";
import { isMailConfigured, sendMail } from "@/lib/mail/send";
import { buildQuotePdf, fetchLogoBytes, formatChf } from "@/lib/pdf/quote-pdf";
import { publish } from "@/lib/realtime/publish";
import {
  quoteApprovalRejectSchema,
  quoteCreateSchema,
  quoteSendSchema,
  quoteStatusSchema,
  quoteUpdateSchema,
} from "@/lib/validations/forms";

function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Ungültige Eingabe.";
}

async function publishQuoteChanged(
  organizationId: string | null,
  projectId: string,
  tabId?: string,
): Promise<void> {
  if (!organizationId) return;
  await publish(organizationId, { type: "quote.changed", projectId, originTabId: tabId });
}

/**
 * Best-effort-Benachrichtigung an alle Admins der Organisation, wenn eine Offerte
 * zur Freigabe eingereicht wird. Bewusst nicht blockierend: ein SMTP-Ausfall darf
 * die Einreichung selbst nicht verhindern — die Offerte ist auch ohne Mail im
 * Büro-Sheet als «wartet auf Freigabe» sichtbar.
 */
async function notifyAdminsQuoteNeedsApproval(quote: Quote, organizationId: string): Promise<void> {
  if (!isMailConfigured()) return;
  const [admins, branding] = await Promise.all([
    listAdminEmailsForOrg(organizationId),
    getOrganizationBranding(organizationId),
  ]);
  if (admins.length === 0) return;

  const quoteLabel = quote.quoteNumber ?? "Offerte";
  const text =
    `Guten Tag\n\n` +
    `${quote.createdByDisplayName ?? "Das Büro"} hat ${quoteLabel} über CHF ${formatChf(quote.totalGross)} ` +
    `zur Freigabe eingereicht.\n\n` +
    `Bitte im Projekt-Sheet unter «Offerten» prüfen und freigeben oder zurückweisen.\n\n` +
    `Freundliche Grüsse\n${branding.name}`;

  await Promise.allSettled(
    admins.map((to) =>
      sendMail({
        to,
        subject: `${quoteLabel} wartet auf Freigabe — ${branding.name}`,
        text,
        fromName: branding.name,
      }),
    ),
  );
}

export async function listQuotesAction(projectId: string): Promise<Quote[]> {
  await requireOfficeSession();
  return listQuotesForProject(projectId);
}

export async function createQuoteAction(values: unknown, tabId?: string): Promise<Quote> {
  const session = await requireOfficeSession();
  const parsed = quoteCreateSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const profile = await getCachedSessionProfile(session);
  const quote = await createQuote(
    {
      projectId: parsed.data.projectId,
      validUntil: parsed.data.validUntil ?? null,
      introText: parsed.data.introText?.trim() || null,
      outroText: parsed.data.outroText?.trim() || null,
      vatRate: parsed.data.vatRate,
      discountPercent: parsed.data.discountPercent,
      lineItems: parsed.data.lineItems,
    },
    { createdByProfileId: profile.userId },
  );
  await publishQuoteChanged(session.organizationId, quote.projectId, tabId);
  return quote;
}

export async function updateQuoteAction(values: unknown, tabId?: string): Promise<Quote> {
  const session = await requireOfficeSession();
  const parsed = quoteUpdateSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const quote = await updateQuote(parsed.data.quoteId, {
    validUntil: parsed.data.validUntil ?? null,
    introText: parsed.data.introText?.trim() || null,
    outroText: parsed.data.outroText?.trim() || null,
    vatRate: parsed.data.vatRate,
    discountPercent: parsed.data.discountPercent,
    lineItems: parsed.data.lineItems,
  });
  await publishQuoteChanged(session.organizationId, quote.projectId, tabId);
  return quote;
}

export async function setQuoteStatusAction(values: unknown, tabId?: string): Promise<Quote> {
  const session = await requireOfficeSession();
  const parsed = quoteStatusSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));
  if (parsed.data.status === "sent") {
    throw new Error("Offerten können nur über «Senden» mit PDF-Versand auf «Gesendet» gesetzt werden.");
  }

  const quote = await setQuoteStatus(parsed.data.quoteId, parsed.data.projectId, parsed.data.status);
  await publishQuoteChanged(session.organizationId, quote.projectId, tabId);

  if (parsed.data.status === "pending_approval" && session.organizationId) {
    void notifyAdminsQuoteNeedsApproval(quote, session.organizationId).catch((e) => {
      console.error("Freigabe-Benachrichtigung fehlgeschlagen:", e);
    });
  }

  return quote;
}

/** Admin weist eine zur Freigabe eingereichte Offerte zurück — zurück in den Entwurf, mit Kommentar fürs Büro. */
export async function rejectQuoteApprovalAction(values: unknown, tabId?: string): Promise<Quote> {
  const session = await requireAdminSession();
  const parsed = quoteApprovalRejectSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const profile = await getCachedSessionProfile(session);
  const quote = await setQuoteStatus(parsed.data.quoteId, parsed.data.projectId, "draft", {
    approvedByProfileId: profile.userId,
    approvedByDisplayName: profile.displayName,
    approvalNote: parsed.data.note?.trim() || null,
  });
  await publishQuoteChanged(session.organizationId, quote.projectId, tabId);
  return quote;
}

/** Verfügbarkeit des Versands für die UI (SMTP konfiguriert?). */
export async function getQuoteMailConfigAction(): Promise<{ mailConfigured: boolean }> {
  await requireOfficeSession();
  return { mailConfigured: isMailConfigured() };
}

export async function sendQuoteAction(values: unknown, tabId?: string): Promise<Quote> {
  const session = await requireOfficeSession();
  if (session.role !== "admin") {
    throw new Error("Nur Admins dürfen Offerten freigeben und senden. Bitte zuerst zur Freigabe einreichen.");
  }
  const parsed = quoteSendSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));
  if (!isMailConfigured()) {
    throw new Error("E-Mail-Versand ist nicht konfiguriert (SMTP_HOST/MAIL_FROM in .env setzen).");
  }
  assertMailRateLimit(session.userId);

  const quote = await getQuoteWithItems(parsed.data.quoteId);
  if (!quote || quote.projectId !== parsed.data.projectId) {
    throw new Error("Offerte nicht gefunden.");
  }
  if (quote.status === "approved" || quote.status === "rejected") {
    throw new Error("Entschiedene Offerten können nicht mehr versendet werden.");
  }
  if (quote.status === "draft") {
    throw new Error("Diese Offerte muss zuerst zur Freigabe eingereicht werden.");
  }

  const [project, branding, billing] = await Promise.all([
    getQuotePdfProjectHead(quote.projectId),
    getOrganizationBranding(quote.organizationId),
    getOrganizationBillingSettings(quote.organizationId),
  ]);
  if (!project) throw new Error("Projekt nicht gefunden.");

  const logo = await fetchLogoBytes(branding.logoUrl);
  const pdfBytes = await buildQuotePdf({
    quote,
    project,
    branding,
    billing: billing ?? EMPTY_ORGANIZATION_BILLING_SETTINGS,
    logo,
  });

  const quoteLabel = quote.quoteNumber ?? "Offerte";
  const validUntilLine = quote.validUntil
    ? `Die Offerte ist gültig bis ${new Date(quote.validUntil).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}.\n`
    : "";
  const personalMessage = parsed.data.message?.trim();
  const text =
    `Guten Tag\n\n` +
    (personalMessage ? `${personalMessage}\n\n` : "") +
    `Im Anhang finden Sie unsere Offerte ${quoteLabel}` +
    (project.title ? ` zum Projekt «${project.title}»` : "") +
    ` über CHF ${formatChf(quote.totalGross)}.\n` +
    validUntilLine +
    `\nFreundliche Grüsse\n${branding.name}`;

  await sendMail({
    to: parsed.data.recipientEmail,
    subject: `${quoteLabel} — ${branding.name}`,
    text,
    fromName: branding.name,
    // Zentraler Versand: Antworten des Endkunden müssen beim Betrieb landen,
    // nicht bei der technischen Absenderadresse.
    replyTo: branding.email ?? undefined,
    attachments: [
      {
        filename: `${quoteLabel}.pdf`,
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });

  const approver = await getCachedSessionProfile(session);
  const updated = await setQuoteStatus(quote.id, quote.projectId, "sent", {
    sentToEmail: parsed.data.recipientEmail,
    approvedByProfileId: approver.userId,
    approvedByDisplayName: approver.displayName,
  });
  await publishQuoteChanged(session.organizationId, updated.projectId, tabId);
  return updated;
}

export async function deleteQuoteAction(
  quoteId: string,
  projectId: string,
  tabId?: string,
): Promise<{ ok: true }> {
  const session = await requireOfficeSession();
  if (!quoteId) throw new Error("Offerten-ID fehlt.");
  await deleteQuote(quoteId);
  await publishQuoteChanged(session.organizationId, projectId, tabId);
  return { ok: true };
}
