"use server";

import { requireOfficeSession } from "@/lib/auth/organization";
import { getCachedSessionProfile } from "@/lib/auth/session";
import {
  createQuote,
  deleteQuote,
  listQuotesForProject,
  setQuoteStatus,
  updateQuote,
} from "@/lib/db/quotes";
import type { Quote } from "@/lib/domain/types";
import { publish } from "@/lib/realtime/publish";
import {
  quoteCreateSchema,
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
    lineItems: parsed.data.lineItems,
  });
  await publishQuoteChanged(session.organizationId, quote.projectId, tabId);
  return quote;
}

export async function setQuoteStatusAction(values: unknown, tabId?: string): Promise<Quote> {
  const session = await requireOfficeSession();
  const parsed = quoteStatusSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const quote = await setQuoteStatus(parsed.data.quoteId, parsed.data.projectId, parsed.data.status);
  await publishQuoteChanged(session.organizationId, quote.projectId, tabId);
  return quote;
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
