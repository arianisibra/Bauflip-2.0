# Cold-start warmup options (Tier 1 — Ops)

Optional measures when the **first request after idle** hits ~2–5 s Netlify cold start. Does not replace region alignment (see [`docs/netlify-compute-optimization.md`](../docs/netlify-compute-optimization.md)).

## UptimeRobot / external cron (recommended, no app code)

| Setting | Value |
|---------|--------|
| URL | `https://app.gross-storenbau.ch/anmeldung` |
| Interval | Every **5–10 minutes** |
| Method | GET |

**What it warms:** public shell + edge path. **Does not** warm authenticated `/projekte` Server Actions (no session cookie).

## Limitations

- Logged-in cold starts still pay full auth + RSC + first Server Action.
- Do **not** store service-account cookies in a ping bot (security risk).
- Warmup reduces **frequency** of cold hits for anonymous/redirect traffic; marginal benefit for office users after long idle.

## Already configured (prod audit 2026-06-23)

- `SERVER_ACTION_SLOW_MS=800` on Netlify site **bauflipp**
- Supabase performance RPCs deployed (`project_core_bootstrap`, etc.)

## Measure baseline

1. Incognito → hard reload `/projekte` **twice**
2. Compare Document TTFB: run 1 (cold) vs run 2 (warm)
3. Log in [`docs/performance-production-har.md`](../docs/performance-production-har.md)

## Region check (manual)

| Service | Where | Target |
|---------|-------|--------|
| Netlify Functions | Site **bauflipp** → Project configuration → Functions | EU (e.g. `eu-central-1`) |
| Supabase | Project **pgcxmfkfvwhnbuqwzysc** → Settings → General → Region | EU (e.g. Frankfurt) |

**Verifiziert am:** ___
