"use server";

import { requireOfficeSession } from "@/lib/auth/organization";
import {
  createTextSnippet,
  deleteTextSnippet,
  listTextSnippetsForOrg,
  updateTextSnippet,
} from "@/lib/db/text-snippets";
import type { TextSnippet } from "@/lib/domain/types";
import { publish } from "@/lib/realtime/publish";
import { textSnippetSchema, textSnippetUpdateSchema } from "@/lib/validations/forms";

function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Ungültige Eingabe.";
}

async function publishTextSnippetsChanged(organizationId: string | null, tabId?: string): Promise<void> {
  if (!organizationId) return;
  await publish(organizationId, { type: "text_snippets.changed", originTabId: tabId });
}

export async function listTextSnippetsAction(): Promise<TextSnippet[]> {
  const session = await requireOfficeSession();
  if (!session.organizationId) return [];
  return listTextSnippetsForOrg(session.organizationId);
}

export async function createTextSnippetAction(values: unknown, tabId?: string): Promise<TextSnippet> {
  const session = await requireOfficeSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");
  const parsed = textSnippetSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const snippet = await createTextSnippet(session.organizationId, {
    title: parsed.data.title,
    body: parsed.data.body,
    isActive: parsed.data.isActive,
    sortOrder: parsed.data.sortOrder,
  });
  await publishTextSnippetsChanged(session.organizationId, tabId);
  return snippet;
}

export async function updateTextSnippetAction(values: unknown, tabId?: string): Promise<TextSnippet> {
  const session = await requireOfficeSession();
  const parsed = textSnippetUpdateSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const snippet = await updateTextSnippet(parsed.data.id, {
    title: parsed.data.title,
    body: parsed.data.body,
    isActive: parsed.data.isActive,
    sortOrder: parsed.data.sortOrder,
  });
  await publishTextSnippetsChanged(session.organizationId, tabId);
  return snippet;
}

export async function deleteTextSnippetAction(snippetId: string, tabId?: string): Promise<{ ok: true }> {
  const session = await requireOfficeSession();
  if (!snippetId) throw new Error("Textbaustein-ID fehlt.");
  await deleteTextSnippet(snippetId);
  await publishTextSnippetsChanged(session.organizationId, tabId);
  return { ok: true };
}
