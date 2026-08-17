/**
 * Ermittelt die Client-IP für Rate-Limits und Turnstile aus X-Forwarded-For.
 *
 * `X-Forwarded-For` ist eine vom Client mitgeschickte Kopfzeile — bei
 * `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` (Standard
 * bei nginx) HÄNGT der eigene Reverse-Proxy die tatsächliche Peer-Adresse nur
 * AN, überschreibt aber keinen vom Client vorgetäuschten Wert davor. Der
 * LINKESTE Eintrag ist deshalb frei fälschbar — ein Angreifer setzt einfach
 * bei jeder Anfrage eine neue erfundene IP und bekommt einen frischen
 * Rate-Limit-Zähler. Vertrauenswürdig ist nur, was der eigene Proxy zuletzt
 * angehängt hat: bei genau EINEM Hop (Bauflip: nginx auf demselben VPS,
 * keine CDN/Load-Balancer-Kette davor) ist das der RECHTESTE Eintrag.
 */
export function getTrustedClientIp(forwardedFor: string | null | undefined): string {
  if (!forwardedFor) return "unknown";
  const hops = forwardedFor.split(",").map((part) => part.trim()).filter(Boolean);
  return hops.at(-1) ?? "unknown";
}
