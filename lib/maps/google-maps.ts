function buildAddressQuery(parts: {
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}) {
  return [parts.street, parts.postalCode, parts.city, parts.country]
    .map((x) => (x != null ? String(x).trim() : ""))
    .filter(Boolean)
    .join(", ");
}

/** Google Maps Suche (geeignet für Monteure: ein Klick öffnet die Navigation). */
export function buildGoogleMapsSearchUrl(parts: {
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}): string {
  const q = buildAddressQuery(parts);
  if (!q) {
    return "";
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Google Maps Routenplaner zur Zieladresse. */
export function buildGoogleMapsDirectionsUrl(parts: {
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}): string {
  const destination = buildAddressQuery(parts);
  if (!destination) {
    return "";
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}
