"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Sends Core Web Vitals to NEXT_PUBLIC_WEB_VITALS_ENDPOINT (POST JSON) when set.
 * In development without an endpoint, logs to the console for quick checks.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const endpoint = process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT?.trim();
    if (endpoint) {
      const body = JSON.stringify({
        id: metric.id,
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        navigationType: metric.navigationType,
      });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(endpoint, blob);
      } else {
        void fetch(endpoint, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
      }
      return;
    }
    if (process.env.NODE_ENV === "development") {
      console.debug("[web-vitals]", metric.name, metric.value, metric.rating);
    }
  });

  return null;
}
