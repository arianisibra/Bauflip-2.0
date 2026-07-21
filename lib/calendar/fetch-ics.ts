import "server-only";

import dns from "node:dns/promises";
import net from "node:net";

/**
 * Lädt einen iCal-Feed sicher herunter (SSRF-Härtung): nur https, Ziel-IP darf nicht
 * privat/loopback/link-local sein, jeder Redirect-Hop wird neu geprüft, harte Grenzen
 * bei Zeit und Grösse. Der Feed ist zwar die EIGENE URL des Nutzers — trotzdem darf der
 * Server damit keine internen Adressen erreichen.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 4;

export class BusyCalendarFetchError extends Error {}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast/reserved
    return false;
  }
  const low = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (low === "::1" || low === "::") return true;
  if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA
  if (low.startsWith("fe80")) return true; // link-local
  if (low.startsWith("::ffff:")) return isPrivateIp(low.slice(7)); // IPv4-mapped
  return false;
}

async function assertPublicHttpsTarget(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BusyCalendarFetchError("Ungültige URL.");
  }
  if (parsed.protocol !== "https:") throw new BusyCalendarFetchError("Nur https-Adressen sind erlaubt.");
  const host = parsed.hostname.replace(/^\[|\]$/g, "");

  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new BusyCalendarFetchError("Host konnte nicht aufgelöst werden.");
    }
  }
  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    throw new BusyCalendarFetchError("Diese Zieladresse ist nicht erlaubt.");
  }
  return parsed;
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function fetchIcsText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const target = await assertPublicHttpsTarget(current);
      const res = await fetch(target.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1",
          "User-Agent": "Bauflip-Calendar-Sync",
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new BusyCalendarFetchError("Ungültige Weiterleitung.");
        current = new URL(loc, target).toString();
        continue;
      }
      if (!res.ok) throw new BusyCalendarFetchError(`Feed nicht erreichbar (HTTP ${res.status}).`);

      const reader = res.body?.getReader();
      if (!reader) return (await res.text()).slice(0, MAX_BYTES);
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          controller.abort();
          throw new BusyCalendarFetchError("Der Kalender-Feed ist zu gross (max. 2 MB).");
        }
        chunks.push(value);
      }
      return new TextDecoder("utf-8").decode(concat(chunks, total));
    }
    throw new BusyCalendarFetchError("Zu viele Weiterleitungen.");
  } catch (e) {
    if (e instanceof BusyCalendarFetchError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new BusyCalendarFetchError("Zeitüberschreitung beim Laden des Feeds.");
    }
    throw new BusyCalendarFetchError("Feed konnte nicht geladen werden.");
  } finally {
    clearTimeout(timer);
  }
}
