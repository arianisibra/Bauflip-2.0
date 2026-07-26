"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarSync, Loader2 } from "lucide-react";
import { useCalendarSyncSettings, useDisconnectCalendarSync } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";

const PROVIDER_LABEL = { google: "Google Kalender", microsoft: "Microsoft Kalender" } as const;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unbekannt";
  return d.toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" });
}

/**
 * Eigene Termine automatisch in den persönlichen Google-/Microsoft-Kalender
 * pushen (Gegenstück zum Busy-Blocker-Import). Verbindung ist rein persönlich
 * — kein Org-Bezug, jede Person verbindet ihr eigenes Konto.
 */
export function CalendarSyncSettings() {
  const settings = useCalendarSyncSettings();
  const disconnect = useDisconnectCalendarSync();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const connected = searchParams.get("calendar_sync_connected");
    const errored = searchParams.get("calendar_sync_error");
    if (connected) {
      toast.success(`${PROVIDER_LABEL[connected as "google" | "microsoft"] ?? connected} verbunden`);
    } else if (errored) {
      toast.error(`Verbindung mit ${PROVIDER_LABEL[errored as "google" | "microsoft"] ?? errored} fehlgeschlagen.`);
    }
    if (connected || errored) {
      const url = new URL(window.location.href);
      url.searchParams.delete("calendar_sync_connected");
      url.searchParams.delete("calendar_sync_error");
      router.replace(url.pathname + url.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = settings.data;
  const connectedProviders = new Set((data?.connections ?? []).map((c) => c.provider));

  const handleDisconnect = async (provider: "google" | "microsoft") => {
    try {
      await disconnect.mutateAsync(provider);
      toast.success(`${PROVIDER_LABEL[provider]} getrennt`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trennen fehlgeschlagen.");
    }
  };

  return (
    <section className="rounded-xl border border-border p-4">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <CalendarSync className="size-4" aria-hidden />
        Termine im eigenen Kalender
      </p>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        Deine zugewiesenen Bauflip-Termine automatisch in Google oder Microsoft (Outlook) spiegeln.
      </p>

      {settings.isLoading ? <p className="text-sm text-muted-foreground">Wird geladen …</p> : null}

      {!settings.isLoading ? (
        <div className="space-y-2">
          {(["google", "microsoft"] as const).map((provider) => {
            const connection = data?.connections.find((c) => c.provider === provider);
            const available = provider === "google" ? data?.googleAvailable : data?.microsoftAvailable;
            return (
              <div
                key={provider}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="block text-sm font-medium">{PROVIDER_LABEL[provider]}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {!available
                      ? "Nicht konfiguriert (Client-ID fehlt)."
                      : connection
                        ? `Verbunden seit ${formatDateTime(connection.connectedAt)}${connection.syncError ? ` · Fehler: ${connection.syncError}` : ""}`
                        : "Nicht verbunden."}
                  </span>
                </div>
                {connectedProviders.has(provider) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disconnect.isPending}
                    onClick={() => handleDisconnect(provider)}
                  >
                    {disconnect.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    Trennen
                  </Button>
                ) : (
                  <a
                    href={`/api/calendar/${provider}/connect`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    aria-disabled={!available}
                    onClick={(e) => {
                      if (!available) e.preventDefault();
                    }}
                  >
                    Verbinden
                  </a>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
