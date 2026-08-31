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
 *
 * `meta` IMMER mitgeben, wenn die Operation einen Bezug hat (Projekt, Zeitraum).
 * Am 31.08.2026 stand bei einem 16,8-Sekunden-Ausreisser nur
 * `{"label":"loadProjectCoreBootstrap","durationMs":16823}` — ohne zu verraten, WELCHES
 * Projekt betroffen war. Damit liess sich weder prüfen, ob ein bestimmter Datensatz die
 * Ursache ist, noch der Fall nachstellen. Die Suche kostete Stunden und mehrere
 * Fehlschlüsse.
 */
export async function withSlowLog<T>(
  label: string,
  run: () => Promise<T>,
  meta?: Record<string, unknown>,
): Promise<T> {
  const threshold = parseThresholdMs();
  const t0 = performance.now();
  try {
    return await run();
  } finally {
    const durationMs = Math.round(performance.now() - t0);
    if (durationMs >= threshold) {
      console.warn(JSON.stringify({ type: "slow_operation", label, durationMs, ...meta }));
    }
  }
}
