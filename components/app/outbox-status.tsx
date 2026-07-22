"use client";

import { AlertTriangle, UploadCloud } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useOutbox, useOutboxAutoFlush } from "@/lib/hooks/use-outbox";
import { discardOutboxItem, flushOutbox } from "@/lib/offline/outbox";

const TYPE_LABEL: Record<"rapport" | "photo", string> = {
  rapport: "Rapport",
  photo: "Foto",
};

/** Shows queued/failed Rapporte & Fotos from lib/offline/outbox — visible even while online (queue can outlive the offline window). */
export function OutboxStatus() {
  useOutboxAutoFlush();
  const items = useOutbox();
  const queryClient = useQueryClient();

  if (items.length === 0) return null;

  const pending = items.filter((item) => item.status !== "failed");
  const failed = items.filter((item) => item.status === "failed");

  return (
    <div className="flex shrink-0 flex-col gap-1.5 bg-sky-500/10 px-4 py-1.5 text-xs text-sky-900 dark:bg-sky-500/15 dark:text-sky-200">
      {pending.length > 0 ? (
        <div className="flex items-center justify-center gap-1.5">
          <UploadCloud className="size-3.5 shrink-0" aria-hidden />
          {pending.length === 1
            ? "1 Eintrag wird gesendet sobald online"
            : `${pending.length} Einträge werden gesendet sobald online`}
        </div>
      ) : null}
      {failed.length > 0 ? (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            {failed.length === 1
              ? "1 Eintrag konnte nicht gesendet werden"
              : `${failed.length} Einträge konnten nicht gesendet werden`}
          </div>
          <div className="flex w-full max-w-sm flex-col gap-1">
            {failed.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1"
              >
                <span className="truncate">
                  {TYPE_LABEL[item.type]} — {item.lastError ?? "Fehler"}
                </span>
                <button
                  type="button"
                  className="shrink-0 underline"
                  onClick={() => void discardOutboxItem(item.id)}
                >
                  Verwerfen
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="underline"
            onClick={() => void flushOutbox(queryClient, { includeFailed: true })}
          >
            Erneut versuchen
          </button>
        </div>
      ) : null}
    </div>
  );
}
