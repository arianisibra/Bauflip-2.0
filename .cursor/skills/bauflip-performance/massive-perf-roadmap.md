# Massive performance roadmap

Tiered options after Hybrid-SSR, RPC bootstrap phases, and interaction gates. Warm `/projekte` (~783 ms) is largely optimized — this doc covers **remaining large wins**.

---

## Tier 1 — Active (PR-I + cold start)

| Item | Status | Effect |
|------|--------|--------|
| **`project_core_bootstrap` RPC** | Prod verified (2026-06-23) | Sheet: 1 POST; HAR gates PASS |
| **Cold start checklist** | Ops (documented) | Region + [`warmup-options.md`](../../../scripts/perf/warmup-options.md) |

Detail: this plan's implementation. Migration: `20260701120000_perf_project_core_bootstrap_rpc.sql`

### Sheet gate (after PR-I)

| Check | Target |
|-------|--------|
| Sheet open `core` POSTs | **1×** |
| `slow_operation` `loadProjectCoreBootstrap` | **≤ 600 ms** typical (+ signing) |

---

## Tier 2 — High ROI when needed

| Item | Trigger | Effect |
|------|---------|--------|
| **Kalender year view slim** | Jahr-Tab often used | 132 KB → few KB |
| **ABGEMACHT DB pagination** | >100 abgemacht projects | Stable TTFB vs 500-row fetch |
| **`next_appointment_starts_at` denorm** | ABGEMACHT growth | Sort without RPC/join |
| **`availability_range_for_org` RPC** | Booking at 3 POST gate | Fewer availability roundtrips |
| **PR-H** bootstrap + page-1 dedupe | Filter churn | −1 POST per filter change |
| **Phase 2b list slim** | RSC still ~350 KB | −100–250 ms receive |

---

## Tier 3 — Scale only

| Item | When |
|------|------|
| Org bootstrap cache (Redis) | Many concurrent users |
| Read replica | Heavy read load |
| Materialized views | Dashboard aggregates |
| Always-on hosting | Cold start unacceptable |

**Simplicity-first:** defer Tier 3 until Tier 1–2 insufficient.

---

## What pagination will NOT fix massively

- Default `/projekte` (50 rows SSR) — done
- `/tag`, `/mitarbeiter` — 0 POST load
- Smaller page size (50→25) — marginal ms, worse UX

---

## Measurement

```bash
node scripts/perf/summarize-har.mjs ~/sheet-open.har
```

Netlify: filter `loadProjectCoreBootstrap`, `getProjectCore`.

---

## Skill maintenance rule

After every Tier change, update **both**:

- `.agents/skills/bauflip-performance/SKILL.md`
- `.cursor/skills/bauflip-performance/SKILL.md`

Plus relevant reference files (`supabase-database.md`, `performance-chronology.md`, `refactoring-pr-roadmap.md`).
