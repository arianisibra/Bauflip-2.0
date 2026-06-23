# Verify `signAttachmentUrls` slow_log on Netlify

After deploy **`6a3a95a`** (2026-06-23 ~14:18 UTC, commit `b513c72`), `withSlowLog("signAttachmentUrls", …)` runs in sheet actions with `attachmentCount` meta.

## Status (2026-06-23)

| Check | Result |
|-------|--------|
| Code on `main` | **Yes** — [`app/(app)/projekte/actions.ts`](../../app/(app)/projekte/actions.ts) |
| Production deploy | **Yes** — Netlify deploy `6a3a95a056a80900088867fb` on `app.gross-storenbau.ch` |
| Session B function logs (16:23) | Duration-only view — **no** `slow_operation` lines in pasted excerpt (calls may be &lt; 800 ms or filter needed) |

## How to verify after sheet open

1. Netlify → **bauflipp** → Logs → Functions → Real-time.
2. Filter message: `signAttachmentUrls` or `slow_operation`.
3. Open a project sheet with attachments in prod.
4. Expect JSON stderr when signing exceeds `SERVER_ACTION_SLOW_MS` (**800**):

```json
{"type":"slow_operation","operation":"signAttachmentUrls","durationMs":...,"attachmentCount":N}
```

If only `loadProjectCoreBootstrap` appears slow, signing is under threshold — acceptable.

## After realtime fix deploy

Filter should **not** show `realtime publish failed: AbortError` on mutations once `await publish()` ships.
