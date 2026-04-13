import "server-only";

function parseThresholdMs(): number {
  const raw = process.env.SERVER_ACTION_SLOW_MS?.trim();
  if (!raw) return 2000;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 2000;
}

/**
 * Logs JSON to stderr when the async work exceeds SERVER_ACTION_SLOW_MS (default 2000).
 * Use around heavy DB / IO paths to spot regressions in production logs.
 */
export async function withSlowLog<T>(label: string, run: () => Promise<T>): Promise<T> {
  const threshold = parseThresholdMs();
  const t0 = performance.now();
  try {
    return await run();
  } finally {
    const durationMs = Math.round(performance.now() - t0);
    if (durationMs >= threshold) {
      console.warn(JSON.stringify({ type: "slow_operation", label, durationMs }));
    }
  }
}
