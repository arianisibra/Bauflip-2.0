import "server-only";

import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";

/**
 * Lädt einen iCal-Feed sicher herunter (SSRF-Härtung): nur https, Ziel-IP darf nicht
 * privat/loopback/link-local sein, jeder Redirect-Hop wird neu geprüft, harte Grenzen
 * bei Zeit und Grösse. Der Feed ist zwar die EIGENE URL des Nutzers — trotzdem darf der
 * Server damit keine internen Adressen erreichen.
 *
 * ENTSCHEIDEND: Verbunden wird zur BEREITS GEPRÜFTEN IP, nicht erneut zum Namen.
 * Ein `fetch(url)` nach erfolgter Prüfung löst den Namen ein zweites Mal auf — ein
 * Angreifer mit eigener Domain und TTL 0 lässt die erste Auflösung eine öffentliche
 * Adresse liefern und die zweite `127.0.0.1` (DNS-Rebinding). Deshalb hier
 * `https.request` mit eigenem `lookup`, der ausschliesslich die geprüfte Adresse
 * zurückgibt. Hostname und damit SNI/Host-Header bleiben unverändert, das Zertifikat
 * wird also weiterhin gegen den echten Namen geprüft.
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

type GeprueftesZiel = { url: URL; adresse: string; family: number };

async function assertPublicHttpsTarget(rawUrl: string): Promise<GeprueftesZiel> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BusyCalendarFetchError("Ungültige URL.");
  }
  if (parsed.protocol !== "https:") throw new BusyCalendarFetchError("Nur https-Adressen sind erlaubt.");
  const host = parsed.hostname.replace(/^\[|\]$/g, "");

  let eintraege: { address: string; family: number }[];
  if (net.isIP(host)) {
    eintraege = [{ address: host, family: net.isIPv6(host) ? 6 : 4 }];
  } else {
    try {
      eintraege = await dns.lookup(host, { all: true });
    } catch {
      throw new BusyCalendarFetchError("Host konnte nicht aufgelöst werden.");
    }
  }
  // ALLE Adressen müssen öffentlich sein — sonst könnte ein Angreifer eine
  // öffentliche und eine interne Adresse gleichzeitig hinterlegen und darauf
  // hoffen, dass die Verbindung die interne wählt.
  if (eintraege.length === 0 || eintraege.some((e) => isPrivateIp(e.address))) {
    throw new BusyCalendarFetchError("Diese Zieladresse ist nicht erlaubt.");
  }
  return { url: parsed, adresse: eintraege[0].address, family: eintraege[0].family };
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

type Antwort = { status: number; location: string | null; koerper: Uint8Array; laenge: number };

/**
 * Ein Abruf zur geprüften Adresse. Der `lookup`-Haken gibt ausschliesslich die
 * bereits validierte IP zurück — damit ist zwischen Prüfung und Verbindung kein
 * zweiter, manipulierbarer DNS-Vorgang mehr möglich.
 */
function ladeEinmal(ziel: GeprueftesZiel, signal: AbortSignal): Promise<Antwort> {
  return new Promise<Antwort>((resolve, reject) => {
    const req = https.request(
      ziel.url,
      {
        signal,
        headers: {
          Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1",
          "User-Agent": "Bauflip-Calendar-Sync",
        },
        lookup: (_hostname, options, callback) => {
          // Signatur je nach `all`-Option unterschiedlich.
          if (typeof options === "object" && options?.all) {
            (callback as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [
              { address: ziel.adresse, family: ziel.family },
            ]);
            return;
          }
          (callback as (e: null, a: string, f: number) => void)(null, ziel.adresse, ziel.family);
        },
      },
      (res) => {
        const chunks: Uint8Array[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.byteLength;
          if (total > MAX_BYTES) {
            req.destroy();
            reject(new BusyCalendarFetchError("Der Kalender-Feed ist zu gross (max. 2 MB)."));
            return;
          }
          chunks.push(new Uint8Array(chunk));
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            location: (res.headers.location as string | undefined) ?? null,
            koerper: concat(chunks, total),
            laenge: total,
          }),
        );
        res.on("error", () => reject(new BusyCalendarFetchError("Feed konnte nicht geladen werden.")));
      },
    );
    req.on("error", (e: NodeJS.ErrnoException) => {
      if (e?.name === "AbortError") {
        reject(new BusyCalendarFetchError("Zeitüberschreitung beim Laden des Feeds."));
        return;
      }
      reject(new BusyCalendarFetchError("Feed konnte nicht geladen werden."));
    });
    req.end();
  });
}

export async function fetchIcsText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      // Jeder Hop wird neu geprüft UND neu festgenagelt.
      const ziel = await assertPublicHttpsTarget(current);
      const res = await ladeEinmal(ziel, controller.signal);

      if (res.status >= 300 && res.status < 400) {
        if (!res.location) throw new BusyCalendarFetchError("Ungültige Weiterleitung.");
        current = new URL(res.location, ziel.url).toString();
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        // Bewusst OHNE Statuscode: Die Meldung landet in sync_error und wird dem
        // Nutzer angezeigt. Mit dem Code liesse sich blind abtasten, welche
        // internen Adressen und Ports antworten.
        throw new BusyCalendarFetchError("Feed nicht erreichbar.");
      }
      return new TextDecoder("utf-8").decode(res.koerper);
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
