"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type TurnstileFieldProps = {
  inputName?: string;
  /** Called when a token is issued, cleared, or on error (empty string). */
  onToken?: (token: string) => void;
};

export function TurnstileField({ inputName = "turnstileToken", onToken }: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);
  const widgetContainerId = useId().replace(/:/g, "");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [apiReady, setApiReady] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiReady || !siteKey || typeof window === "undefined" || !window.turnstile || !containerRef.current) {
      return;
    }

    const el = containerRef.current;
    setWidgetError(null);

    widgetIdRef.current = window.turnstile.render(el, {
      sitekey: siteKey,
      theme: "light",
      callback: (token: string) => {
        setWidgetError(null);
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = token;
        }
        onTokenRef.current?.(token);
      },
      "expired-callback": () => {
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = "";
        }
        onTokenRef.current?.("");
      },
      "error-callback": () => {
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = "";
        }
        onTokenRef.current?.("");
        setWidgetError(
          "Turnstile konnte nicht geladen werden. Prüfen Sie in Cloudflare, ob diese Domain (z. B. app.gross-storenbau.ch) unter «Hostname-Verwaltung» des Widgets erlaubt ist, und ob kein Browser-Blocker das Captcha blockiert.",
        );
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [apiReady, siteKey]);

  if (!siteKey) {
    return (
      <div
        role="status"
        className="rounded-md border border-dashed border-amber-300/90 bg-amber-50 px-3 py-2.5 text-xs leading-snug text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-50"
      >
        <p className="font-medium">Captcha (Cloudflare Turnstile) nicht konfiguriert</p>
        <p className="mt-1.5 text-amber-900/95 dark:text-amber-100/90">
          Setzen Sie{" "}
          <code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[10px] dark:bg-white/10">
            NEXT_PUBLIC_TURNSTILE_SITE_KEY
          </code>{" "}
          (öffentlicher Site-Key) und{" "}
          <code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[10px] dark:bg-white/10">
            CLOUDFLARE_TURNSTILE_SECRET_KEY
          </code>{" "}
          (nur Server), danach Build/Neustart — dann erscheint das Widget hier.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setApiReady(true)}
        onError={() =>
          setWidgetError(
            "Turnstile-Skript konnte nicht geladen werden (Netzwerk, CSP oder Blocker). Bitte Seite neu laden oder Netzwerk prüfen.",
          )
        }
      />
      <input ref={hiddenInputRef} type="hidden" name={inputName} />
      <div id={widgetContainerId} ref={containerRef} className="min-h-[65px] w-full" />
      {widgetError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {widgetError}
        </p>
      ) : null}
    </div>
  );
}
