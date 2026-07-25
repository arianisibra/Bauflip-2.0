"use server";

import { requireOfficeSession } from "@/lib/auth/organization";
import { getCachedSessionProfile } from "@/lib/auth/session";
import { pushInvoiceToBexio } from "@/lib/bexio/push-invoice";
import { getOrganizationBillingSettings } from "@/lib/db/billing";
import {
  createInvoice,
  deleteInvoice,
  getInvoiceWithItems,
  listInvoicesForProject,
  setInvoiceStatus,
  updateInvoice,
} from "@/lib/db/invoices";
import { getQuotePdfProjectHead } from "@/lib/db/quotes";
import { getOrganizationBranding } from "@/lib/db/repository";
import type { Invoice } from "@/lib/domain/types";
import { assertMailRateLimit } from "@/lib/mail/rate-limit";
import { isMailConfigured, sendMail } from "@/lib/mail/send";
import { buildInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { fetchLogoBytes, formatChf } from "@/lib/pdf/quote-pdf";
import { publish } from "@/lib/realtime/publish";
import {
  invoiceCreateSchema,
  invoiceSendSchema,
  invoiceStatusSchema,
  invoiceUpdateSchema,
} from "@/lib/validations/forms";

function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Ungültige Eingabe.";
}

async function publishInvoiceChanged(
  organizationId: string | null,
  projectId: string,
  tabId?: string,
): Promise<void> {
  if (!organizationId) return;
  await publish(organizationId, { type: "invoice.changed", projectId, originTabId: tabId });
}

export async function listInvoicesAction(projectId: string): Promise<Invoice[]> {
  await requireOfficeSession();
  return listInvoicesForProject(projectId);
}

export async function createInvoiceAction(values: unknown, tabId?: string): Promise<Invoice> {
  const session = await requireOfficeSession();
  const parsed = invoiceCreateSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const profile = await getCachedSessionProfile(session);
  const invoice = await createInvoice(
    {
      projectId: parsed.data.projectId,
      fromQuoteId: parsed.data.fromQuoteId ?? null,
      dueDate: parsed.data.dueDate ?? null,
      introText: parsed.data.introText?.trim() || null,
      vatRate: parsed.data.vatRate,
      discountPercent: parsed.data.discountPercent,
      skontoPercent: parsed.data.skontoPercent,
      skontoDays: parsed.data.skontoDays,
      lineItems: parsed.data.lineItems,
    },
    { createdByProfileId: profile.userId },
  );
  await publishInvoiceChanged(session.organizationId, invoice.projectId, tabId);
  return invoice;
}

export async function updateInvoiceAction(values: unknown, tabId?: string): Promise<Invoice> {
  const session = await requireOfficeSession();
  const parsed = invoiceUpdateSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const invoice = await updateInvoice(parsed.data.invoiceId, {
    dueDate: parsed.data.dueDate ?? null,
    introText: parsed.data.introText?.trim() || null,
    vatRate: parsed.data.vatRate,
    discountPercent: parsed.data.discountPercent,
    skontoPercent: parsed.data.skontoPercent,
    skontoDays: parsed.data.skontoDays,
    lineItems: parsed.data.lineItems,
  });
  await publishInvoiceChanged(session.organizationId, invoice.projectId, tabId);
  return invoice;
}

export async function setInvoiceStatusAction(values: unknown, tabId?: string): Promise<Invoice> {
  const session = await requireOfficeSession();
  const parsed = invoiceStatusSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const invoice = await setInvoiceStatus(
    parsed.data.invoiceId,
    parsed.data.projectId,
    parsed.data.status,
  );
  await publishInvoiceChanged(session.organizationId, invoice.projectId, tabId);
  return invoice;
}

export async function sendInvoiceAction(values: unknown, tabId?: string): Promise<Invoice> {
  const session = await requireOfficeSession();
  const parsed = invoiceSendSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));
  if (!isMailConfigured()) {
    throw new Error("E-Mail-Versand ist nicht konfiguriert (SMTP_HOST/MAIL_FROM in .env setzen).");
  }
  assertMailRateLimit(session.userId);

  const invoice = await getInvoiceWithItems(parsed.data.invoiceId);
  if (!invoice || invoice.projectId !== parsed.data.projectId) {
    throw new Error("Rechnung nicht gefunden.");
  }
  if (invoice.status !== "draft" && invoice.status !== "sent") {
    throw new Error("Bezahlte oder stornierte Rechnungen können nicht versendet werden.");
  }

  const [project, branding, billing] = await Promise.all([
    getQuotePdfProjectHead(invoice.projectId),
    getOrganizationBranding(invoice.organizationId),
    getOrganizationBillingSettings(invoice.organizationId),
  ]);
  if (!project) throw new Error("Projekt nicht gefunden.");
  if (!billing?.iban || !billing.creditorName || !billing.creditorPostalCode || !billing.creditorCity) {
    throw new Error("Zahlungsdaten unvollständig — IBAN und Gläubiger-Adresse in den Einstellungen erfassen.");
  }

  const logo = await fetchLogoBytes(branding.logoUrl);
  const pdfBytes = await buildInvoicePdf({ invoice, project, branding, billing, logo });

  const invoiceLabel = invoice.invoiceNumber ?? "Rechnung";
  const dueDateLine = invoice.dueDate
    ? `Zahlbar bis ${new Date(invoice.dueDate).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}.\n`
    : "";
  const personalMessage = parsed.data.message?.trim();
  const text =
    `Guten Tag\n\n` +
    (personalMessage ? `${personalMessage}\n\n` : "") +
    `Im Anhang finden Sie unsere Rechnung ${invoiceLabel}` +
    (project.title ? ` zum Projekt «${project.title}»` : "") +
    ` über CHF ${formatChf(invoice.totalGross)}.\n` +
    dueDateLine +
    `Der Zahlteil mit QR-Code befindet sich auf der letzten Seite.\n` +
    `\nFreundliche Grüsse\n${branding.name}`;

  await sendMail({
    to: parsed.data.recipientEmail,
    subject: `${invoiceLabel} — ${branding.name}`,
    text,
    fromName: branding.name,
    attachments: [
      {
        filename: `${invoiceLabel}.pdf`,
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });

  const updated = await setInvoiceStatus(invoice.id, invoice.projectId, "sent", {
    sentToEmail: parsed.data.recipientEmail,
  });
  await publishInvoiceChanged(session.organizationId, updated.projectId, tabId);

  // Best-effort: Bexio-Push blockiert den Versand nie — Fehler landet nur als Sync-Status
  // an der Rechnung (Retry-Button in der UI), siehe lib/bexio/push-invoice.ts.
  if (session.organizationId) {
    pushInvoiceToBexio(session.organizationId, updated).catch(() => {});
  }

  return updated;
}

/** Manueller Retry-Button (Rechnungs-Sektion) — wirft bei Fehler, damit die UI ihn anzeigen kann. */
export async function pushInvoiceToBexioAction(invoiceId: string, tabId?: string): Promise<Invoice> {
  const session = await requireOfficeSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  const invoice = await getInvoiceWithItems(invoiceId);
  if (!invoice) throw new Error("Rechnung nicht gefunden.");

  await pushInvoiceToBexio(session.organizationId, invoice);
  const updated = await getInvoiceWithItems(invoiceId);
  if (!updated) throw new Error("Rechnung nicht gefunden.");
  await publishInvoiceChanged(session.organizationId, updated.projectId, tabId);
  return updated;
}

export async function deleteInvoiceAction(
  invoiceId: string,
  projectId: string,
  tabId?: string,
): Promise<{ ok: true }> {
  const session = await requireOfficeSession();
  if (!invoiceId) throw new Error("Rechnungs-ID fehlt.");
  await deleteInvoice(invoiceId);
  await publishInvoiceChanged(session.organizationId, projectId, tabId);
  return { ok: true };
}
