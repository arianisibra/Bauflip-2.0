# Sheet open checklist (PR-I warm HAR)

Verify `getProjectSheetBootstrapAction` + `project_core_bootstrap` RPC after deploy.

## Capture (5 minutes)

1. Chrome **Incognito**, no extensions (or filter `gross-storenbau`).
2. DevTools → Network → **Disable cache**.
3. Log in → `/projekte` (or `/kalender`).
4. **Hard reload twice** — use the second load as warm baseline.
5. Open project sheet → close → repeat **3×**.
6. Export HAR: **Save all as HAR with content**.

## Analyze

```bash
node scripts/perf/summarize-har.mjs ~/Desktop/sheet-open.har
```

## Gates (script output)

| Gate | Target |
|------|--------|
| `core POST` count | **1 per sheet open** (not 2× head+details) |
| No burst | No two `core` POSTs within **300 ms** |
| Netlify `slow_operation` | `loadProjectCoreBootstrap` typical **≤ 600 ms** (+ `signAttachmentUrls`) |

## Netlify logs (optional)

Filter function logs for:

- `loadProjectCoreBootstrap`
- `signAttachmentUrls`
- `project_core_bootstrap_rpc_fallback` → should be **0** when RPC is live

## Related

- Full interaction session: [`projekte-interaction-checklist.md`](./projekte-interaction-checklist.md)
- Baseline: [`docs/performance-production-har.md`](../../docs/performance-production-har.md)
