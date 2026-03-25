const FALLBACK_PALETTE = ["#0ea5e9", "#22c55e", "#eab308", "#a855f7", "#f97316", "#ec4899", "#14b8a6", "#6366f1"];

/** Erkennt gültiges Hex (#RRGGBB). */
export function isHexColor(v: string | null | undefined): v is string {
  return typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v.trim());
}

function hashPick(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}

/**
 * Farbe für Kalenderkarten: gespeicherte Farbe, sonst deterministisch aus Profil-ID,
 * ohne Zuordnung ein neutrales Grau.
 */
export function resolveCalendarColor(explicit: string | null | undefined, profileId: string | null | undefined): string {
  if (explicit && isHexColor(explicit)) {
    return explicit.trim();
  }
  if (!profileId) {
    return "#94a3b8";
  }
  return hashPick(profileId);
}
