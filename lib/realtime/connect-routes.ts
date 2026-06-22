/** Routen mit Listen/Kalender — Cross-Tab-Sync sinnvoll. Kein Realtime auf /einstellungen, /profil, … */
const REALTIME_ROUTE_PREFIXES = [
  "/projekte",
  "/kalender",
  "/mitarbeiter",
  "/bestellformulare",
  "/tag",
  "/wochenplan",
  "/auftrag",
] as const;

export function isRealtimeDataRoute(pathname: string): boolean {
  if (!pathname || pathname === "/") return false;
  return REALTIME_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
