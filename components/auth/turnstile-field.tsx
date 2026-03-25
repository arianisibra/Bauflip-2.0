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

  useEffect(() => {
    if (!apiReady || !siteKey || typeof window === "undefined" || !window.turnstile || !containerRef.current) {
      return;
    }

    const el = containerRef.current;

    widgetIdRef.current = window.turnstile.render(el, {
      sitekey: siteKey,
      theme: "light",
      callback: (token: string) => {
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
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setApiReady(true)}
      />
      <input ref={hiddenInputRef} type="hidden" name={inputName} />
      <div id={widgetContainerId} ref={containerRef} />
    </div>
  );
}
