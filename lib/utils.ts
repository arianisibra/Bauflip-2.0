import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Für FK-Spalten (z. B. profiles.id): Mock-IDs wie «mock-user» sind keine UUIDs. */
export function isUuidString(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Ziffern aus der bexio-Kontakt-ID (z. B. "000795") als ganze Zahl — für Zapier → bexio `contact_id`
 * (API erwartet oft Integer, nicht String mit führenden Nullen).
 */
export function parseBexioContactIdNumeric(value: string | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const digits = String(value).trim().replace(/\D/g, "");
  if (!digits) {
    return null;
  }
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

/** Legacy getrennte Felder für ein gemeinsames «Zugang/Schlüssel»-Feld zusammenführen. */
export function mergeAccessAndKeyNotes(
  access: string | null | undefined,
  key: string | null | undefined,
): string {
  const a = (access ?? "").trim();
  const k = (key ?? "").trim();
  if (a && k) {
    return `${a}\n\n${k}`;
  }
  return a || k;
}
