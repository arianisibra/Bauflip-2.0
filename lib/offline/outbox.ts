"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { QueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { submitTechnicianReportAction } from "@/app/(tech)/actions";
import { uploadProjectReportFileAction } from "@/app/(app)/actions";
import { getTabId } from "@/lib/query/tab-id";
import { afterProjectCoreChange, patchAttachmentAdded } from "@/lib/query/invalidations";
import { technicianReportSchema } from "@/lib/validations/forms";

type TechnicianReportInput = z.infer<typeof technicianReportSchema>;
type OutboxStatus = "pending" | "sending" | "failed";

export type OutboxItem =
  | {
      id: string;
      type: "rapport";
      projectId: string;
      createdAt: number;
      attempts: number;
      lastError: string | null;
      status: OutboxStatus;
      payload: TechnicianReportInput;
    }
  | {
      id: string;
      type: "photo";
      projectId: string;
      createdAt: number;
      attempts: number;
      lastError: string | null;
      status: OutboxStatus;
      file: File;
      fileName: string;
    };

interface OutboxDB extends DBSchema {
  outbox: { key: string; value: OutboxItem };
}

let dbPromise: Promise<IDBPDatabase<OutboxDB>> | null = null;

function getDb(): Promise<IDBPDatabase<OutboxDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OutboxDB>("bauflip-outbox", 1, {
      upgrade(db) {
        db.createObjectStore("outbox", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

const EMPTY_OUTBOX: OutboxItem[] = [];
const listeners = new Set<() => void>();
let cache: OutboxItem[] = EMPTY_OUTBOX;

function notify(): void {
  for (const listener of listeners) listener();
}

async function refresh(): Promise<void> {
  const db = await getDb();
  cache = await db.getAll("outbox");
  notify();
}

if (typeof window !== "undefined") void refresh();

export function subscribeOutbox(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getOutboxSnapshot(): OutboxItem[] {
  return cache;
}

export function getOutboxServerSnapshot(): OutboxItem[] {
  return EMPTY_OUTBOX;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `outbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Persisted in IndexedDB (not the localStorage read-cache from lib/query/provider.tsx)
 * because photo entries carry a raw `File`, which structured-clones fine into IndexedDB
 * but not into localStorage (string-only).
 */
export async function enqueueRapport(payload: TechnicianReportInput): Promise<void> {
  const db = await getDb();
  await db.put("outbox", {
    id: newId(),
    type: "rapport",
    projectId: payload.projectId,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
    status: "pending",
    payload,
  });
  await refresh();
}

export async function enqueuePhoto(projectId: string, file: File): Promise<void> {
  const db = await getDb();
  await db.put("outbox", {
    id: newId(),
    type: "photo",
    projectId,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
    status: "pending",
    file,
    fileName: file.name,
  });
  await refresh();
}

export async function discardOutboxItem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("outbox", id);
  await refresh();
}

let flushing = false;

/**
 * Sends queued items in FIFO order. No Background Sync API (unsupported on iOS
 * Safari, and devices here are a mixed iPhone/Android fleet) — this is called
 * manually on `online` events and window focus instead, see use-outbox.ts.
 * A thrown error (network failure) leaves the item `pending` for the next
 * retry; a structured `{success:false}` response marks it `failed`. Failed
 * items are skipped on automatic flushes — otherwise a genuinely-rejected
 * payload (e.g. a validation error) would retry silently forever on every
 * reconnect/focus. Pass `includeFailed: true` (the manual "Erneut versuchen"
 * button) to retry those too.
 */
export async function flushOutbox(
  queryClient: QueryClient,
  opts?: { includeFailed?: boolean },
): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  try {
    const db = await getDb();
    const items = (await db.getAll("outbox"))
      .filter((item) => opts?.includeFailed || item.status !== "failed")
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const item of items) {
      await db.put("outbox", { ...item, status: "sending" });
      await refresh();
      try {
        if (item.type === "rapport") {
          const result = await submitTechnicianReportAction(item.payload, getTabId());
          if (result.success) {
            await db.delete("outbox", item.id);
            afterProjectCoreChange(queryClient, item.projectId, { refetchType: "all" });
          } else {
            await db.put("outbox", {
              ...item,
              status: "failed",
              attempts: item.attempts + 1,
              lastError: result.error,
            });
          }
        } else {
          const formData = new FormData();
          formData.set("projectId", item.projectId);
          formData.set("file", item.file, item.fileName);
          const result = await uploadProjectReportFileAction(formData, getTabId());
          if (result.success) {
            await db.delete("outbox", item.id);
            patchAttachmentAdded(queryClient, item.projectId, result.attachment);
          } else {
            await db.put("outbox", {
              ...item,
              status: "failed",
              attempts: item.attempts + 1,
              lastError: result.error,
            });
          }
        }
      } catch {
        await db.put("outbox", {
          ...item,
          status: "pending",
          attempts: item.attempts + 1,
          lastError: "Netzwerkfehler — wird automatisch erneut versucht",
        });
      }
      await refresh();
    }
  } finally {
    flushing = false;
  }
}
