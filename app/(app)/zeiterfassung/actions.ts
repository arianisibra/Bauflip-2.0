"use server";

import { requireOfficeSession, requireTechFieldSession } from "@/lib/auth/organization";
import {
  createTimeEntry,
  deleteTimeEntry,
  listTimeEntriesForOrg,
  listTimeEntriesForUser,
  updateTimeEntry,
} from "@/lib/db/repository";
import type { TimeEntry } from "@/lib/domain/types";
import { publish } from "@/lib/realtime/publish";
import { timeEntrySchema, timeEntryUpdateSchema } from "@/lib/validations/forms";

/** Eigene Zeiterfassungs-Einträge — jede Rolle (Admin, Büro, Monteur). */
export async function listMyTimeEntriesAction(startDate: string, endDate: string): Promise<TimeEntry[]> {
  const session = await requireTechFieldSession();
  return listTimeEntriesForUser(session.userId, startDate, endDate);
}

/** Team-Übersicht: alle Einträge der Organisation — nur Büro/Admin. */
export async function listOrgTimeEntriesAction(startDate: string, endDate: string): Promise<TimeEntry[]> {
  const session = await requireOfficeSession();
  if (!session.organizationId) return [];
  return listTimeEntriesForOrg(session.organizationId, startDate, endDate);
}

export async function createTimeEntryAction(input: unknown, tabId?: string): Promise<TimeEntry> {
  const session = await requireTechFieldSession();
  const parsed = timeEntrySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  const v = parsed.data;
  const created = await createTimeEntry(
    {
      entryDate: v.entryDate,
      startsAt: v.startsAt ?? null,
      endsAt: v.endsAt ?? null,
      hours: v.hours,
      note: v.note?.trim() ? v.note.trim() : null,
    },
    session.userId,
    session.userId,
  );
  if (session.organizationId) {
    await publish(session.organizationId, { type: "time_entry.changed", originTabId: tabId });
  }
  return created;
}

export async function updateTimeEntryAction(input: unknown, tabId?: string): Promise<TimeEntry> {
  const session = await requireTechFieldSession();
  const parsed = timeEntryUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  const v = parsed.data;
  const updated = await updateTimeEntry(v.id, {
    entryDate: v.entryDate,
    startsAt: v.startsAt ?? null,
    endsAt: v.endsAt ?? null,
    hours: v.hours,
    note: v.note?.trim() ? v.note.trim() : null,
  });
  if (session.organizationId) {
    await publish(session.organizationId, { type: "time_entry.changed", originTabId: tabId });
  }
  return updated;
}

export async function deleteTimeEntryAction(timeEntryId: string, tabId?: string): Promise<{ ok: true }> {
  const session = await requireTechFieldSession();
  if (!timeEntryId || typeof timeEntryId !== "string") {
    throw new Error("Ungültige ID.");
  }
  await deleteTimeEntry(timeEntryId);
  if (session.organizationId) {
    await publish(session.organizationId, { type: "time_entry.changed", originTabId: tabId });
  }
  return { ok: true };
}
