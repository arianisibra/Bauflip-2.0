"use client";

import Script from "next/script";
import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; theme?: "light" | "dark" },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type TurnstileFieldProps = {
  inputName?: string;
};

export function TurnstileField({ inputName = "turnstileToken" }: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const widgetContainerId = useId().replace(/:/g, "");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !window.turnstile || !containerRef.current) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => {
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = token;
        }
      },
      theme: "light",
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <input ref={hiddenInputRef} type="hidden" name={inputName} />
      <div id={widgetContainerId} ref={containerRef} />
    </div>
  );
}
