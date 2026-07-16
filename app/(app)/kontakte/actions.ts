"use server";

import { requireOfficeSession } from "@/lib/auth/organization";
import { getCachedSessionProfile } from "@/lib/auth/session";
import {
  createContact,
  deleteContact,
  listContactsForOrg,
  updateContact,
} from "@/lib/db/contacts";
import type { Contact, ContactKind } from "@/lib/domain/types";
import { publish } from "@/lib/realtime/publish";
import { contactSchema, contactUpdateSchema } from "@/lib/validations/forms";

function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Ungültige Eingabe.";
}

async function publishContactsChanged(organizationId: string | null, tabId?: string): Promise<void> {
  if (!organizationId) return;
  await publish(organizationId, { type: "contact.changed", originTabId: tabId });
}

export async function listContactsAction(opts?: {
  query?: string;
  kind?: ContactKind;
  activeOnly?: boolean;
}): Promise<Contact[]> {
  const session = await requireOfficeSession();
  if (!session.organizationId) return [];
  return listContactsForOrg(session.organizationId, opts);
}

export async function createContactAction(values: unknown, tabId?: string): Promise<Contact> {
  const session = await requireOfficeSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const profile = await getCachedSessionProfile(session);
  const contact = await createContact(session.organizationId, parsed.data, profile.userId);
  await publishContactsChanged(session.organizationId, tabId);
  return contact;
}

export async function updateContactAction(values: unknown, tabId?: string): Promise<Contact> {
  const session = await requireOfficeSession();
  const parsed = contactUpdateSchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const { id, ...rest } = parsed.data;
  const contact = await updateContact(id, rest);
  await publishContactsChanged(session.organizationId, tabId);
  return contact;
}

export async function deleteContactAction(contactId: string, tabId?: string): Promise<void> {
  const session = await requireOfficeSession();
  await deleteContact(contactId);
  await publishContactsChanged(session.organizationId, tabId);
}
