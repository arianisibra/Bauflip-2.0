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

/** POST /kalender within this window after document end = hydration regression. */
const HYDRATION_GAP_MS = 500;

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
const kalenderDoc = appEntries.find(
  (e) =>
    e.request.method === "GET" &&
    !e.request.url.includes("_rsc=") &&
    e.request.url.replace(/\?.*$/, "").endsWith("/kalender"),
);
const mitarbeiterDoc = appEntries.find(
  (e) =>
    e.request.method === "GET" &&
    !e.request.url.includes("_rsc=") &&
    e.request.url.replace(/\?.*$/, "").endsWith("/mitarbeiter"),
);
const mitarbeiterPosts = appEntries.filter(
  (e) => e.request.method === "POST" && e.request.url.includes("/mitarbeiter"),
);
const einstellungenDoc = appEntries.find(
  (e) =>
    e.request.method === "GET" &&
    !e.request.url.includes("_rsc=") &&
    e.request.url.replace(/\?.*$/, "").endsWith("/einstellungen"),
);
const bestellformulareDoc = appEntries.find(
  (e) =>
    e.request.method === "GET" &&
    !e.request.url.includes("_rsc=") &&
    e.request.url.replace(/\?.*$/, "").endsWith("/bestellformulare"),
);
const einstellungenPosts = appEntries.filter(
  (e) => e.request.method === "POST" && e.request.url.includes("/einstellungen"),
);
const bestellformularePosts = appEntries.filter(
  (e) => e.request.method === "POST" && e.request.url.includes("/bestellformulare"),
);
const einstellungenRscGets = appEntries.filter(
  (e) => e.request.method === "GET" && e.request.url.includes("/einstellungen") && e.request.url.includes("_rsc="),
);
const kalenderRscGets = appEntries.filter(
  (e) => e.request.method === "GET" && e.request.url.includes("/kalender") && e.request.url.includes("_rsc="),
);
const sidebarRscGets = appEntries.filter(
  (e) =>
    e.request.method === "GET" &&
    e.request.url.includes("_rsc=") &&
    !e.request.url.includes("/kalender") &&
    ["/projekte", "/mitarbeiter", "/bestellformulare", "/tag", "/einstellungen", "/wochenplan"].some((p) =>
      e.request.url.includes(p),
    ),
);
const kalenderPosts = appEntries.filter(
  (e) => e.request.method === "POST" && e.request.url.includes("/kalender"),
);
const bootstrapPosts = appEntries.filter(
  (e) => e.request.method === "POST" && e.request.url.includes("/projekte"),
);
const projekteSheetPrefetches = appEntries.filter(
  (e) =>
    e.request.method === "GET" &&
    e.request.url.includes("/projekte?sheet=") &&
    !e.request.url.replace(/\?.*$/, "").endsWith("/projekte"),
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

function kalenderPostKind(url) {
  try {
    const u = new URL(url);
    if (u.searchParams.has("sheet")) return "sheet";
    return "range";
  } catch {
    return "range";
  }
}

function shortKalenderUrl(url) {
  try {
    const u = new URL(url);
    const qs = u.search.startsWith("?") ? u.search.slice(1) : u.search;
    return qs.length > 72 ? qs.slice(0, 72) + "…" : qs || "(no query)";
  } catch {
    return url;
  }
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
  const text = doc.response.content?.text ?? "";
  const titleRows = (text.match(/"title":/g) || []).length;
  const displayLabelRows = (text.match(/displayLabel/g) || []).length;
  const serviceAddrRows = (text.match(/serviceAddressShort/g) || []).length;
  if (titleRows > 0) {
    console.log("  list row titles in payload (approx):", Math.min(titleRows, 200));
  }
  if (displayLabelRows > 0 || serviceAddrRows > 0) {
    console.log("  displayLabel / serviceAddressShort refs:", displayLabelRows, "/", serviceAddrRows);
  }
  const statusParam = (() => {
    try {
      return new URL(doc.request.url).searchParams.get("status") ?? "(default active)";
    } catch {
      return "n/a";
    }
  })();
  const searchParam = (() => {
    try {
      return new URL(doc.request.url).searchParams.get("q") ?? "(none)";
    } catch {
      return "n/a";
    }
  })();
  console.log("  URL status param:", statusParam);
  console.log("  URL search param:", searchParam);
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

if (kalenderDoc) {
  console.log("\nDocument GET /kalender");
  console.log("  total:", Math.round(kalenderDoc.time) + "ms");
  console.log("  TTFB (wait):", Math.round(kalenderDoc.timings?.wait ?? 0) + "ms");
  console.log("  transfer:", Math.round((kalenderDoc.response._transferSize ?? 0) / 1024) + "KB");
  const contentKb = Math.round((kalenderDoc.response.content?.size ?? 0) / 1024);
  if (contentKb > 0) {
    console.log("  RSC content (uncompressed):", contentKb + "KB");
  }
  const kalText = kalenderDoc.response.content?.text ?? "";
  const startsAtRefs = (kalText.match(/startsAt/g) || []).length;
  if (startsAtRefs > 0) {
    console.log("  appointments in payload (startsAt refs):", startsAtRefs);
  }
}

if (mitarbeiterDoc) {
  console.log("\nDocument GET /mitarbeiter");
  console.log("  total:", Math.round(mitarbeiterDoc.time) + "ms");
  console.log("  TTFB (wait):", Math.round(mitarbeiterDoc.timings?.wait ?? 0) + "ms");
  console.log("  transfer:", Math.round((mitarbeiterDoc.response._transferSize ?? 0) / 1024) + "KB");
  const contentKb = Math.round((mitarbeiterDoc.response.content?.size ?? 0) / 1024);
  if (contentKb > 0) {
    console.log("  RSC content (uncompressed):", contentKb + "KB");
  }
  const mitText = mitarbeiterDoc.response.content?.text ?? "";
  const teamRefs = (mitText.match(/displayName/g) || []).length;
  if (teamRefs > 0) {
    console.log("  team rows in payload (displayName refs):", teamRefs);
  }
}

const docEndMs = kalenderDoc ? end(kalenderDoc) : null;
const kalenderPostsAfterDoc =
  docEndMs != null ? kalenderPosts.filter((p) => rel(p) >= docEndMs) : kalenderPosts;
const kalenderEarlyPosts =
  docEndMs != null
    ? kalenderPostsAfterDoc.filter((p) => rel(p) - docEndMs < HYDRATION_GAP_MS)
    : [];
const kalenderRangePosts = kalenderPostsAfterDoc.filter((p) => kalenderPostKind(p.request.url) === "range");
const kalenderSheetPosts = kalenderPostsAfterDoc.filter((p) => kalenderPostKind(p.request.url) === "sheet");
const projektePostsAfterDoc =
  docEndMs != null ? bootstrapPosts.filter((p) => rel(p) >= docEndMs) : bootstrapPosts;
const kalenderRscAfterDoc =
  docEndMs != null ? kalenderRscGets.filter((p) => rel(p) >= docEndMs) : kalenderRscGets;

console.log("\nKalender interaction (after document load)");
console.log("  POST /kalender total:", kalenderPostsAfterDoc.length);
console.log("    early (<" + HYDRATION_GAP_MS + "ms, regression):", kalenderEarlyPosts.length);
console.log("    range/view (expected on nav):", kalenderRangePosts.length);
console.log("    sheet (Server Action on /kalender?sheet=):", kalenderSheetPosts.length);
console.log("  POST /projekte:", projektePostsAfterDoc.length);
console.log("  GET /kalender?_rsc= (soft nav):", kalenderRscAfterDoc.length);
console.log("  Sidebar _rsc prefetches (total session):", sidebarRscGets.length);

if (kalenderPostsAfterDoc.length > 0) {
  console.log("\n  POST /kalender timeline:");
  for (const p of [...kalenderPostsAfterDoc].sort((a, b) => rel(a) - rel(b))) {
    const gap = docEndMs != null ? rel(p) - docEndMs : 0;
    const kind = kalenderPostKind(p.request.url);
    console.log(
      "   ",
      "t+" + gap + "ms",
      Math.round(p.time) + "ms",
      Math.round((p.response._transferSize ?? 0) / 1024) + "KB",
      kind,
      shortKalenderUrl(p.request.url),
    );
  }
}

console.log("\nAll POST /kalender (session):", kalenderPosts.length);
for (const p of kalenderPosts) {
  console.log(
    "  ",
    Math.round(p.time) + "ms",
    Math.round((p.response._transferSize ?? 0) / 1024) + "KB",
    kalenderPostKind(p.request.url),
    "status",
    p.response.status,
  );
}

console.log("GET /projekte?sheet= prefetches:", projekteSheetPrefetches.length);
console.log("/api/events:", events.length);
console.log("Profile-related POSTs:", profilePosts.length);
console.log("WebSocket:", ws.length);
console.log("Total app transfer:", totalTransferKb + "KB");

if (doc && bootstrapPosts[0]) {
  console.log("\nTimeline /projekte (ms from first request)");
  console.log("  document end:", end(doc));
  console.log("  bootstrap start:", rel(bootstrapPosts[0]));
  console.log("  bootstrap end:", end(bootstrapPosts[0]));
  console.log("  data ready:", end(bootstrapPosts[0]));
  console.log("  hydration gap:", rel(bootstrapPosts[0]) - end(doc));
} else if (doc) {
  console.log("\nTimeline /projekte (ms from first request)");
  console.log("  document end:", end(doc));
  console.log("  data ready (Hybrid-SSR):", end(doc));
}

if (kalenderDoc) {
  console.log("\nTimeline /kalender (ms from first request)");
  console.log("  document end:", end(kalenderDoc));
  if (kalenderEarlyPosts[0]) {
    console.log("  early POST start:", rel(kalenderEarlyPosts[0]));
    console.log("  hydration gap:", rel(kalenderEarlyPosts[0]) - end(kalenderDoc));
  } else if (kalenderPostsAfterDoc[0]) {
    console.log("  first POST start:", rel(kalenderPostsAfterDoc[0]));
    console.log("  gap to first POST:", rel(kalenderPostsAfterDoc[0]) - end(kalenderDoc));
  } else {
    console.log("  data ready (Hybrid-SSR):", end(kalenderDoc));
  }
}

if (har.log.pages?.[0]?.pageTimings) {
  const pt = har.log.pages[0].pageTimings;
  console.log("\nPage timings");
  console.log("  onContentLoad:", Math.round(pt.onContentLoad ?? 0) + "ms");
  console.log("  onLoad:", Math.round(pt.onLoad ?? 0) + "ms");
}

if (kalenderDoc) {
  const isInteractionHar = kalenderPostsAfterDoc.length > 0;
  const gates = [
    {
      label: "No POST /kalender within " + HYDRATION_GAP_MS + "ms of document (hydration)",
      pass: kalenderEarlyPosts.length === 0,
      detail: String(kalenderEarlyPosts.length),
    },
    {
      label: "GET /projekte?sheet= prefetches = 0",
      pass: projekteSheetPrefetches.length === 0,
      detail: String(projekteSheetPrefetches.length),
    },
    {
      label: "GET /api/events = 0",
      pass: events.length === 0,
      detail: String(events.length),
    },
    {
      label: "GET /kalender?_rsc= after load = 0 (replaceState)",
      pass: kalenderRscAfterDoc.length === 0,
      detail: String(kalenderRscAfterDoc.length),
    },
  ];
  if (isInteractionHar) {
    gates.push({
      label: "Sheet uses POST /kalender?sheet= (not full RSC reload)",
      pass: kalenderSheetPosts.length === 0 || kalenderRscAfterDoc.length === 0,
      detail: kalenderSheetPosts.length + " sheet POST(s), " + kalenderRscAfterDoc.length + " _rsc",
    });
  }
  console.log("\nKalender gates" + (isInteractionHar ? " (interaction HAR)" : " (load-only HAR)"));
  for (const g of gates) {
    console.log(" ", g.pass ? "PASS" : "FAIL", "—", g.label, `(${g.detail})`);
  }
}

if (mitarbeiterDoc) {
  const mitDocEndMs = end(mitarbeiterDoc);
  const mitarbeiterPostsAfterDoc = mitarbeiterPosts.filter((p) => rel(p) >= mitDocEndMs);
  const mitarbeiterEarlyPosts = mitarbeiterPostsAfterDoc.filter(
    (p) => rel(p) - mitDocEndMs < HYDRATION_GAP_MS,
  );
  const einstellungenRscAfterDoc = einstellungenRscGets.filter((p) => rel(p) >= mitDocEndMs);
  const assignablePostsAfterDoc = profilePosts.filter(
    (p) => p.request.url.includes("/mitarbeiter") && rel(p) >= mitDocEndMs,
  );

  console.log("\nMitarbeiter interaction (after document load)");
  console.log("  POST /mitarbeiter total:", mitarbeiterPostsAfterDoc.length);
  console.log("    early (<" + HYDRATION_GAP_MS + "ms, regression):", mitarbeiterEarlyPosts.length);
  console.log("  listAssignableProfiles POST (drawer lazy):", assignablePostsAfterDoc.length);
  console.log("  GET /einstellungen?_rsc= after load:", einstellungenRscAfterDoc.length);

  if (mitarbeiterPostsAfterDoc.length > 0) {
    console.log("\n  POST /mitarbeiter timeline:");
    for (const p of [...mitarbeiterPostsAfterDoc].sort((a, b) => rel(a) - rel(b))) {
      const gap = rel(p) - mitDocEndMs;
      console.log(
        "   ",
        "t+" + gap + "ms",
        Math.round(p.time) + "ms",
        Math.round((p.response._transferSize ?? 0) / 1024) + "KB",
      );
    }
  }

  console.log("\nTimeline /mitarbeiter (ms from first request)");
  console.log("  document end:", mitDocEndMs);
  if (mitarbeiterEarlyPosts[0]) {
    console.log("  early POST start:", rel(mitarbeiterEarlyPosts[0]));
    console.log("  hydration gap:", rel(mitarbeiterEarlyPosts[0]) - mitDocEndMs);
  } else if (mitarbeiterPostsAfterDoc[0]) {
    console.log("  first POST start:", rel(mitarbeiterPostsAfterDoc[0]));
    console.log("  gap to first POST:", rel(mitarbeiterPostsAfterDoc[0]) - mitDocEndMs);
  } else {
    console.log("  data ready (Hybrid-SSR):", mitDocEndMs);
  }

  const isInteractionHar = mitarbeiterPostsAfterDoc.length > 0;
  const mitGates = [
    {
      label: "No POST /mitarbeiter within " + HYDRATION_GAP_MS + "ms of document (hydration)",
      pass: mitarbeiterEarlyPosts.length === 0,
      detail: String(mitarbeiterEarlyPosts.length),
    },
    {
      label: "GET /api/events = 0",
      pass: events.length === 0,
      detail: String(events.length),
    },
    {
      label: "GET /einstellungen?_rsc= after load = 0 (avatar prefetch)",
      pass: einstellungenRscAfterDoc.length === 0,
      detail: String(einstellungenRscAfterDoc.length),
    },
  ];
  if (isInteractionHar) {
    mitGates.push({
      label: "Load POST /mitarbeiter = 0 (Hybrid-SSR)",
      pass: mitarbeiterPostsAfterDoc.length === assignablePostsAfterDoc.length,
      detail:
        mitarbeiterPostsAfterDoc.length +
        " POST(s), " +
        assignablePostsAfterDoc.length +
        " assignable (drawer ok)",
    });
  }
  console.log("\nMitarbeiter gates" + (isInteractionHar ? " (interaction HAR)" : " (load-only HAR)"));
  for (const g of mitGates) {
    console.log(" ", g.pass ? "PASS" : "FAIL", "—", g.label, `(${g.detail})`);
  }
}

if (einstellungenDoc) {
  const estDocEndMs = end(einstellungenDoc);
  const einstellungenPostsAfterDoc = einstellungenPosts.filter((p) => rel(p) >= estDocEndMs);
  const einstellungenEarlyPosts = einstellungenPostsAfterDoc.filter(
    (p) => rel(p) - estDocEndMs < HYDRATION_GAP_MS,
  );
  const einstellungenRscAfterEstDoc = einstellungenRscGets.filter((p) => rel(p) >= estDocEndMs);

  console.log("\nEinstellungen interaction (after document load)");
  console.log("  POST /einstellungen total:", einstellungenPostsAfterDoc.length);
  console.log("    early (<" + HYDRATION_GAP_MS + "ms, regression):", einstellungenEarlyPosts.length);
  console.log("  GET /einstellungen?_rsc= after load:", einstellungenRscAfterEstDoc.length);

  console.log("\nTimeline /einstellungen (ms from first request)");
  console.log("  document end:", estDocEndMs);
  if (einstellungenEarlyPosts[0]) {
    console.log("  early POST start:", rel(einstellungenEarlyPosts[0]));
    console.log("  hydration gap:", rel(einstellungenEarlyPosts[0]) - estDocEndMs);
  } else if (einstellungenPostsAfterDoc[0]) {
    console.log("  first POST start:", rel(einstellungenPostsAfterDoc[0]));
    console.log("  gap to first POST:", rel(einstellungenPostsAfterDoc[0]) - estDocEndMs);
  } else {
    console.log("  data ready (Hybrid-SSR):", estDocEndMs);
  }

  const estGates = [
    {
      label: "No POST /einstellungen within " + HYDRATION_GAP_MS + "ms of document (hydration)",
      pass: einstellungenEarlyPosts.length === 0,
      detail: String(einstellungenEarlyPosts.length),
    },
    {
      label: "Load POST /einstellungen = 0 (Hybrid-SSR)",
      pass: einstellungenPostsAfterDoc.length === 0,
      detail: String(einstellungenPostsAfterDoc.length),
    },
    {
      label: "GET /einstellungen?_rsc= after load = 0 (avatar prefetch)",
      pass: einstellungenRscAfterEstDoc.length === 0,
      detail: String(einstellungenRscAfterEstDoc.length),
    },
  ];
  console.log("\nEinstellungen gates (load-only HAR)");
  for (const g of estGates) {
    console.log(" ", g.pass ? "PASS" : "FAIL", "—", g.label, `(${g.detail})`);
  }
}

if (bestellformulareDoc) {
  const bfDocEndMs = end(bestellformulareDoc);
  const bestellformularePostsAfterDoc = bestellformularePosts.filter((p) => rel(p) >= bfDocEndMs);
  const bestellformulareEarlyPosts = bestellformularePostsAfterDoc.filter(
    (p) => rel(p) - bfDocEndMs < HYDRATION_GAP_MS,
  );

  console.log("\nBestellformulare interaction (after document load)");
  console.log("  POST /bestellformulare total:", bestellformularePostsAfterDoc.length);
  console.log("    early (<" + HYDRATION_GAP_MS + "ms, regression):", bestellformulareEarlyPosts.length);

  console.log("\nTimeline /bestellformulare (ms from first request)");
  console.log("  document end:", bfDocEndMs);
  if (bestellformulareEarlyPosts[0]) {
    console.log("  early POST start:", rel(bestellformulareEarlyPosts[0]));
    console.log("  hydration gap:", rel(bestellformulareEarlyPosts[0]) - bfDocEndMs);
  } else if (bestellformularePostsAfterDoc[0]) {
    console.log("  first POST start:", rel(bestellformularePostsAfterDoc[0]));
    console.log("  gap to first POST:", rel(bestellformularePostsAfterDoc[0]) - bfDocEndMs);
  } else {
    console.log("  data ready (Hybrid-SSR):", bfDocEndMs);
  }

  const bfGates = [
    {
      label: "No POST /bestellformulare within " + HYDRATION_GAP_MS + "ms of document (hydration)",
      pass: bestellformulareEarlyPosts.length === 0,
      detail: String(bestellformulareEarlyPosts.length),
    },
    {
      label: "Load POST /bestellformulare = 0 (Hybrid-SSR)",
      pass: bestellformularePostsAfterDoc.length === 0,
      detail: String(bestellformularePostsAfterDoc.length),
    },
  ];
  console.log("\nBestellformulare gates (load-only HAR)");
  for (const g of bfGates) {
    console.log(" ", g.pass ? "PASS" : "FAIL", "—", g.label, `(${g.detail})`);
  }
}
