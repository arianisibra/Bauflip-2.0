"use server";

import { requireOfficeSession } from "@/lib/auth/organization";
import { getCachedSessionProfile } from "@/lib/auth/session";
import {
  createInvoice,
  deleteInvoice,
  listInvoicesForProject,
  setInvoiceStatus,
  updateInvoice,
} from "@/lib/db/invoices";
import type { Invoice } from "@/lib/domain/types";
import { publish } from "@/lib/realtime/publish";
import {
  invoiceCreateSchema,
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
