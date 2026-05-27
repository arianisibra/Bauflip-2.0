/** Erlaubte Ziele für «Zurück» (nur interne App-Pfade inkl. Query). */
const ALLOWED_RETURN_PREFIXES = [
  "/kalender",
  "/wochenplan",
  "/tag",
  "/profil",
  "/projekte",
] as const;

export function sanitizeAppReturnTo(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let path: string;
  try {
    path = decodeURIComponent(raw.trim());
  } catch {
    return null;
  }
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  const allowed = ALLOWED_RETURN_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}?`),
  );
  return allowed ? path : null;
}
