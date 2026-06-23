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
/** Bottom-nav / link prefetch noise vs. deliberate tab navigation. */
const NAV_PREFETCH_GAP_MS = 2000;
/** Auftrag card RSC prefetch after /tag document. */
const AUFTRAG_PREFETCH_GAP_MS = 3000;

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
const tagDoc = appEntries.find(
  (e) =>
    e.request.method === "GET" &&
    !e.request.url.includes("_rsc=") &&
    e.request.url.replace(/\?.*$/, "").endsWith("/tag"),
);
const tagPosts = appEntries.filter((e) => e.request.method === "POST" && e.request.url.includes("/tag"));
const wochenplanRscGets = appEntries.filter(
  (e) => e.request.method === "GET" && e.request.url.includes("/wochenplan") && e.request.url.includes("_rsc="),
);
const profilRscGets = appEntries.filter(
  (e) => e.request.method === "GET" && e.request.url.includes("/profil") && e.request.url.includes("_rsc="),
);
const auftragRscGets = appEntries.filter(
  (e) => e.request.method === "GET" && e.request.url.includes("/auftrag/") && e.request.url.includes("_rsc="),
);
const wochenplanDoc = appEntries.find(
  (e) =>
    e.request.method === "GET" &&
    !e.request.url.includes("_rsc=") &&
    e.request.url.replace(/\?.*$/, "").split("?")[0].endsWith("/wochenplan"),
);
const wochenplanPosts = appEntries.filter(
  (e) => e.request.method === "POST" && e.request.url.includes("/wochenplan"),
);
const auftragDoc = appEntries.find(
  (e) =>
    e.request.method === "GET" &&
    !e.request.url.includes("_rsc=") &&
    /\/auftrag\/[^/]+$/.test(e.request.url.replace(/\?.*$/, "").replace(/^https:\/\/[^/]+/, "")),
);
const auftragPosts = appEntries.filter(
  (e) => e.request.method === "POST" && e.request.url.includes("/auftrag/"),
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

/** Classify POST /projekte Server-Action bodies (not all are bootstrap). */
function classifyProjektePostBody(text) {
  if (!text) return "unknown";
  if (/fetchAvailabilityRangeAction/.test(text)) return "availability";
  if (/fetchProjekteListPageAction/.test(text)) return "list";
  if (/fetchProjekteBootstrapAction/.test(text)) return "bootstrap";
  if (/addAppointmentAction|deleteAppointmentAction/.test(text)) return "mutation";
  if (/getProjectSheetBootstrapAction|getProjectSheetHeadAction|getProjectSheetDetailsAction|getProjectCore/.test(text)) return "core";
  if (
    /\["20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(text) &&
    /,"20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(text)
  ) {
    return "availability";
  }
  if (/\["active"|"all"|"archived"/.test(text)) return "list";
  if (/projectId/.test(text) && /startsAt/.test(text)) return "mutation";
  if (/appointmentId/.test(text) && /projectId/.test(text)) return "mutation";
  return "other";
}

function classifyAuftragPost(post) {
  const text = post.request.postData?.text ?? "";
  const mime = post.request.postData?.mimeType ?? "";
  if (mime.includes("multipart/form-data") || /uploadProjectReportFileAction/.test(text)) return "upload";
  if (/fetchAuftragExtrasAction/.test(text)) return "extras";
  if (/fetchAuftragProjectCoreAction/.test(text)) return "core";
  if (/submitTechnicianReportAction|updateTechnicianReportAction/.test(text)) return "rapport";

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      if (parsed.length === 2 && typeof parsed[0] === "string" && typeof parsed[1] === "boolean") {
        return "extras";
      }
      if (parsed.length === 1 && typeof parsed[0] === "string" && parsed[0].includes("-")) {
        return "core";
      }
      if (parsed.length === 3 && typeof parsed[0] === "string" && typeof parsed[1] === "string") {
        return parsed[1].includes("/") ? "delete" : "notes";
      }
    }
    if (parsed && typeof parsed === "object") {
      if (parsed.outcome || parsed.reportId) return "rapport";
    }
  } catch {
    // Next.js may wrap args; fall through to heuristics below.
  }

  if (/\boutcome\b/.test(text) && /\bprojectId\b/.test(text)) return "rapport";
  if (/\breportId\b/.test(text)) return "rapport";
  return "other";
}

function projektePostKindLabel(kind) {
  const labels = {
    availability: "availability",
    list: "list",
    bootstrap: "bootstrap",
    mutation: "mutation",
    core: "core",
    other: "other",
    unknown: "unknown",
  };
  return labels[kind] ?? kind;
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

console.log("\nPOST /projekte (session):", bootstrapPosts.length);
const projekteClassified = bootstrapPosts.map((p) => ({
  post: p,
  kind: classifyProjektePostBody(p.request.postData?.text ?? ""),
}));
const projekteKindCounts = projekteClassified.reduce((acc, { kind }) => {
  acc[kind] = (acc[kind] ?? 0) + 1;
  return acc;
}, {});
for (const [kind, count] of Object.entries(projekteKindCounts).sort((a, b) => b[1] - a[1])) {
  console.log("  ", projektePostKindLabel(kind) + ":", count);
}
for (const { post: p, kind } of projekteClassified) {
  console.log(
    "  ",
    Math.round(p.time) + "ms",
    Math.round((p.response._transferSize ?? 0) / 1024) + "KB",
    projektePostKindLabel(kind),
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
} else if (bootstrapPosts[0]) {
  console.log("\nTimeline /projekte (ms from first request, no document GET in HAR)");
  console.log("  first POST start:", rel(bootstrapPosts[0]));
  console.log("  first POST end:", end(bootstrapPosts[0]));
  const firstKind = classifyProjektePostBody(bootstrapPosts[0].request.postData?.text ?? "");
  console.log("  first POST kind:", projektePostKindLabel(firstKind));
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

if (tagDoc) {
  const tagDocEndMs = end(tagDoc);
  const tagPostsAfterDoc = tagPosts.filter((p) => rel(p) >= tagDocEndMs);
  const tagEarlyPosts = tagPostsAfterDoc.filter((p) => rel(p) - tagDocEndMs < HYDRATION_GAP_MS);
  const wochenplanRscAfterDoc = wochenplanRscGets.filter(
    (p) => rel(p) >= tagDocEndMs && rel(p) - tagDocEndMs < NAV_PREFETCH_GAP_MS,
  );
  const profilRscAfterDoc = profilRscGets.filter(
    (p) => rel(p) >= tagDocEndMs && rel(p) - tagDocEndMs < NAV_PREFETCH_GAP_MS,
  );
  const auftragRscEarlyPrefetch = auftragRscGets.filter(
    (p) => rel(p) >= tagDocEndMs && rel(p) - tagDocEndMs < AUFTRAG_PREFETCH_GAP_MS,
  );

  console.log("\nTag interaction (after document load)");
  console.log("  POST /tag total:", tagPostsAfterDoc.length);
  console.log("    early (<" + HYDRATION_GAP_MS + "ms, regression):", tagEarlyPosts.length);
  console.log(
    "  GET /auftrag/*?_rsc= early (<" + AUFTRAG_PREFETCH_GAP_MS + "ms, card prefetch):",
    auftragRscEarlyPrefetch.length,
  );
  console.log(
    "  GET /wochenplan?_rsc= early (<" + NAV_PREFETCH_GAP_MS + "ms, bottom-nav prefetch):",
    wochenplanRscAfterDoc.length,
  );
  console.log(
    "  GET /profil?_rsc= early (<" + NAV_PREFETCH_GAP_MS + "ms, bottom-nav prefetch):",
    profilRscAfterDoc.length,
  );

  if (tagPostsAfterDoc.length > 0) {
    console.log("\n  POST /tag timeline:");
    for (const p of [...tagPostsAfterDoc].sort((a, b) => rel(a) - rel(b))) {
      const gap = rel(p) - tagDocEndMs;
      console.log(
        "   ",
        "t+" + gap + "ms",
        Math.round(p.time) + "ms",
        Math.round((p.response._transferSize ?? 0) / 1024) + "KB",
      );
    }
  }

  console.log("\nTimeline /tag (ms from first request)");
  console.log("  document end:", tagDocEndMs);
  if (tagEarlyPosts[0]) {
    console.log("  early POST start:", rel(tagEarlyPosts[0]));
    console.log("  hydration gap:", rel(tagEarlyPosts[0]) - tagDocEndMs);
  } else if (tagPostsAfterDoc[0]) {
    console.log("  first POST start:", rel(tagPostsAfterDoc[0]));
    console.log("  gap to first POST:", rel(tagPostsAfterDoc[0]) - tagDocEndMs);
  } else {
    console.log("  data ready (Hybrid-SSR):", tagDocEndMs);
  }

  const tagGates = [
    {
      label: "No POST /tag within " + HYDRATION_GAP_MS + "ms of document (hydration)",
      pass: tagEarlyPosts.length === 0,
      detail: String(tagEarlyPosts.length),
    },
    {
      label: "Load POST /tag = 0 (Hybrid-SSR)",
      pass: tagPostsAfterDoc.length === 0,
      detail: String(tagPostsAfterDoc.length),
    },
    {
      label: "GET /wochenplan?_rsc= early (<" + NAV_PREFETCH_GAP_MS + "ms) = 0 (bottom-nav prefetch)",
      pass: wochenplanRscAfterDoc.length === 0,
      detail: String(wochenplanRscAfterDoc.length),
    },
    {
      label: "GET /profil?_rsc= early (<" + NAV_PREFETCH_GAP_MS + "ms) = 0 (bottom-nav prefetch)",
      pass: profilRscAfterDoc.length === 0,
      detail: String(profilRscAfterDoc.length),
    },
    {
      label: "GET /auftrag/*?_rsc= early (<" + AUFTRAG_PREFETCH_GAP_MS + "ms) = 0 (card prefetch)",
      pass: auftragRscEarlyPrefetch.length === 0,
      detail: String(auftragRscEarlyPrefetch.length),
    },
  ];
  console.log("\nTag gates (load-only HAR)");
  for (const g of tagGates) {
    console.log(" ", g.pass ? "PASS" : "FAIL", "—", g.label, `(${g.detail})`);
  }
}

if (wochenplanDoc) {
  const wpDocEndMs = end(wochenplanDoc);
  const wochenplanPostsAfterDoc = wochenplanPosts.filter((p) => rel(p) >= wpDocEndMs);
  const wochenplanEarlyPosts = wochenplanPostsAfterDoc.filter(
    (p) => rel(p) - wpDocEndMs < HYDRATION_GAP_MS,
  );

  console.log("\nWochenplan interaction (after document load)");
  console.log("  POST /wochenplan total:", wochenplanPostsAfterDoc.length);
  console.log("    early (<" + HYDRATION_GAP_MS + "ms, regression):", wochenplanEarlyPosts.length);
  if (wochenplanPostsAfterDoc.length > 0) {
    console.log("  note: Month tab without ?view=month in URL may cause 1 POST (expected)");
  }

  console.log("\nTimeline /wochenplan (ms from first request)");
  console.log("  document end:", wpDocEndMs);
  if (wochenplanEarlyPosts[0]) {
    console.log("  early POST start:", rel(wochenplanEarlyPosts[0]));
  } else if (wochenplanPostsAfterDoc[0]) {
    console.log("  first POST start:", rel(wochenplanPostsAfterDoc[0]));
    console.log("  gap to first POST:", rel(wochenplanPostsAfterDoc[0]) - wpDocEndMs);
  } else {
    console.log("  data ready (Hybrid-SSR):", wpDocEndMs);
  }

  const wpGates = [
    {
      label: "No POST /wochenplan within " + HYDRATION_GAP_MS + "ms of document (hydration)",
      pass: wochenplanEarlyPosts.length === 0,
      detail: String(wochenplanEarlyPosts.length),
    },
    {
      label: "Load POST /wochenplan = 0 (Hybrid-SSR week; month only if ?view=month)",
      pass: wochenplanPostsAfterDoc.length === 0,
      detail: String(wochenplanPostsAfterDoc.length),
    },
  ];
  console.log("\nWochenplan gates (load-only HAR)");
  for (const g of wpGates) {
    console.log(" ", g.pass ? "PASS" : "FAIL", "—", g.label, `(${g.detail})`);
  }
}

if (auftragDoc) {
  const auftragDocEndMs = end(auftragDoc);
  const auftragPostsAfterDoc = auftragPosts.filter((p) => rel(p) >= auftragDocEndMs);
  const auftragEarlyPosts = auftragPostsAfterDoc.filter(
    (p) => rel(p) - auftragDocEndMs < HYDRATION_GAP_MS,
  );

  console.log("\nAuftrag interaction (after document load)");
  console.log("  POST /auftrag total:", auftragPostsAfterDoc.length);
  console.log("    early (<" + HYDRATION_GAP_MS + "ms):", auftragEarlyPosts.length);
  console.log("  note: 1 POST after load = fetchAuftragExtrasAction (signed URLs + templates)");

  console.log("\nTimeline /auftrag (ms from first request)");
  console.log("  document end:", auftragDocEndMs);
  if (auftragPostsAfterDoc[0]) {
    console.log("  first extras POST:", rel(auftragPostsAfterDoc[0]));
    console.log("  gap to extras POST:", rel(auftragPostsAfterDoc[0]) - auftragDocEndMs);
  }

  const auftragGates = [
    {
      label: "Load POST /auftrag <= 1 (extras defer, not duplicate bootstrap)",
      pass: auftragPostsAfterDoc.length <= 1,
      detail: String(auftragPostsAfterDoc.length),
    },
  ];
  console.log("\nAuftrag gates (load HAR)");
  for (const g of auftragGates) {
    console.log(" ", g.pass ? "PASS" : "FAIL", "—", g.label, `(${g.detail})`);
  }
}

const auftragClassified = auftragPosts.map((p) => ({
  post: p,
  kind: classifyAuftragPost(p),
}));
const auftragUploadCount = auftragClassified.filter((x) => x.kind === "upload").length;
const auftragRapportCount = auftragClassified.filter((x) => x.kind === "rapport").length;
const auftragCoreRefetchCount = auftragClassified.filter((x) => x.kind === "core").length;
const isAuftragRapportSession = auftragUploadCount >= 2 && auftragRapportCount >= 1;

if (isAuftragRapportSession || auftragPosts.length >= 4) {
  console.log("\nAuftrag interaction (rapport + photos session)");
  console.log("  POST /auftrag total:", auftragPosts.length);
  for (const [kind, count] of Object.entries(
    auftragClassified.reduce((acc, { kind }) => {
      acc[kind] = (acc[kind] ?? 0) + 1;
      return acc;
    }, {}),
  )) {
    console.log("   ", kind + ":", count);
  }

  const rapportGates = [
    {
      label: "Rapport + 2 photos: POST /auftrag <= 4 (no duplicate core refetch)",
      pass: auftragPosts.length <= 4 && auftragCoreRefetchCount === 0,
      detail:
        auftragPosts.length +
        " POST(s), " +
        auftragCoreRefetchCount +
        " core refetch, " +
        auftragUploadCount +
        " upload(s), " +
        auftragRapportCount +
        " rapport",
    },
  ];
  console.log("\nAuftrag gates (interaction HAR)");
  for (const g of rapportGates) {
    console.log(" ", g.pass ? "PASS" : "FAIL", "—", g.label, `(${g.detail})`);
  }
}

const projekteAvailabilityCount = projekteKindCounts.availability ?? 0;
const projekteMutationCount = projekteKindCounts.mutation ?? 0;
const isProjekteBookingSession =
  projekteMutationCount > 0 || projekteAvailabilityCount > 2 || bootstrapPosts.length >= 6;

if (isProjekteBookingSession) {
  console.log("\nProjekte interaction (Termin buchen session)");
  console.log("  POST /projekte total:", bootstrapPosts.length);
  console.log("    availability:", projekteAvailabilityCount);
  console.log("    list refetch:", projekteKindCounts.list ?? 0);
  console.log("    mutations:", projekteMutationCount);

  const projekteGates = [
    {
      label: "Availability POST /projekte <= 3 (after slot tweaks)",
      pass: projekteAvailabilityCount <= 3,
      detail: String(projekteAvailabilityCount),
    },
    {
      label: "Projekt + Termine: total POST /projekte <= 8",
      pass: bootstrapPosts.length <= 8,
      detail: String(bootstrapPosts.length),
    },
  ];
  console.log("\nProjekte gates (interaction HAR)");
  for (const g of projekteGates) {
    console.log(" ", g.pass ? "PASS" : "FAIL", "—", g.label, `(${g.detail})`);
  }
}
