/** Google Maps Suche (geeignet für Monteure: ein Klick öffnet die Navigation). */
export function buildGoogleMapsSearchUrl(parts: {
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}): string {
  const q = [parts.street, parts.postalCode, parts.city, parts.country]
    .map((x) => (x != null ? String(x).trim() : ""))
    .filter(Boolean)
    .join(", ");
  if (!q) {
    return "";
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
