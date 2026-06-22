#!/usr/bin/env node
/**
 * Summarize Bauflip-relevant requests from a Chrome HAR export.
 * Usage: node scripts/perf/summarize-har.mjs path/to/file.har
 */
import fs from "node:fs";

const harPath = process.argv[2];
if (!harPath) {
  console.error("Usage: node scripts/perf/summarize-har.mjs <file.har>");
  process.exit(1);
}

const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
const entries = har.log.entries ?? [];

const appHost = process.env.BAUFLIP_HAR_HOST ?? "gross-storenbau";
const appEntries = entries.filter((e) => {
  const url = e.request.url;
  if (url.startsWith("chrome-extension://") || url.startsWith("moz-extension://")) return false;
  try {
    const host = new URL(url).hostname;
    return host.includes(appHost) || host.includes("supabase");
  } catch {
    return false;
  }
});

const doc = appEntries.find(
  (e) => e.request.method === "GET" && e.request.url.replace(/\?.*$/, "").endsWith("/projekte"),
);
const bootstrapPosts = appEntries.filter(
  (e) => e.request.method === "POST" && e.request.url.includes("/projekte"),
);
const events = appEntries.filter((e) => e.request.url.includes("/api/events"));
const profilePosts = appEntries.filter(
  (e) =>
    e.request.method === "POST" &&
    (e.request.postData?.text?.includes("fetchSessionProfile") ||
      e.request.postData?.text?.includes("listAssignableProfiles")),
);
const ws = appEntries.filter((e) => e.request.url.startsWith("wss://"));

const t0 = entries.length ? new Date(entries[0].startedDateTime).getTime() : 0;
function rel(e) {
  return Math.round(new Date(e.startedDateTime).getTime() - t0);
}
function end(e) {
  return rel(e) + Math.round(e.time);
}

const totalTransferKb = Math.round(
  appEntries.reduce((s, e) => s + (e.response._transferSize ?? 0), 0) / 1024,
);

console.log("=== Bauflip HAR summary ===");
console.log("File:", harPath);
console.log("Total entries:", entries.length);
console.log("App + Supabase entries:", appEntries.length);
console.log("Extension entries:", entries.length - entries.filter((e) => !e.request.url.startsWith("chrome-extension://")).length);

if (doc) {
  console.log("\nDocument GET /projekte");
  console.log("  total:", Math.round(doc.time) + "ms");
  console.log("  TTFB (wait):", Math.round(doc.timings?.wait ?? 0) + "ms");
  console.log("  transfer:", Math.round((doc.response._transferSize ?? 0) / 1024) + "KB");
  const contentKb = Math.round((doc.response.content?.size ?? 0) / 1024);
  if (contentKb > 0) {
    console.log("  RSC content (uncompressed):", contentKb + "KB");
  }
  const statusParam = (() => {
    try {
      return new URL(doc.request.url).searchParams.get("status") ?? "(default active)";
    } catch {
      return "n/a";
    }
  })();
  console.log("  URL status param:", statusParam);
}

console.log("\nBootstrap POST /projekte:", bootstrapPosts.length);
for (const p of bootstrapPosts) {
  console.log(
    "  ",
    Math.round(p.time) + "ms",
    Math.round((p.response._transferSize ?? 0) / 1024) + "KB",
    "status",
    p.response.status,
  );
}

console.log("/api/events:", events.length);
console.log("Profile-related POSTs:", profilePosts.length);
console.log("WebSocket:", ws.length);
console.log("Total app transfer:", totalTransferKb + "KB");

if (doc && bootstrapPosts[0]) {
  console.log("\nTimeline (ms from first request)");
  console.log("  document end:", end(doc));
  console.log("  bootstrap start:", rel(bootstrapPosts[0]));
  console.log("  bootstrap end:", end(bootstrapPosts[0]));
  console.log("  data ready:", end(bootstrapPosts[0]));
  console.log("  hydration gap:", rel(bootstrapPosts[0]) - end(doc));
} else if (doc) {
  console.log("\nTimeline (ms from first request)");
  console.log("  document end:", end(doc));
  console.log("  data ready (Hybrid-SSR):", end(doc));
}

if (har.log.pages?.[0]?.pageTimings) {
  const pt = har.log.pages[0].pageTimings;
  console.log("\nPage timings");
  console.log("  onContentLoad:", Math.round(pt.onContentLoad ?? 0) + "ms");
  console.log("  onLoad:", Math.round(pt.onLoad ?? 0) + "ms");
}
