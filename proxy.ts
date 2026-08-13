import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasSupabaseAuthCookie } from "@/lib/auth/cookies";
import { mapRole } from "@/lib/auth/map-role";
import { applyProxyAuthContext, stripProxyAuthContext } from "@/lib/auth/proxy-auth-headers";
import { readProxyAuthFromAppMetadata } from "@/lib/auth/user-metadata-keys";
import type { RoleType } from "@/lib/domain/types";

const PUBLIC_PATHS = [
  "/anmeldung",
  "/registrieren",
  "/onboarding",
  "/mfa/setup",
  "/auth/confirm",
  // Auffangseite für Supabase-Links mit Session im Fragment. Muss öffentlich sein:
  // Beim Aufruf existiert noch kein Cookie — das schreibt erst der Browser dort.
  "/auth/hash",
  // Ohne Anmeldung erreichbar — wer sein Passwort vergessen hat, hat keine Session.
  "/passwort-vergessen",
  // Rechtstexte müssen vor der Registrierung lesbar sein: das Formular verlangt
  // ausdrücklich die Zustimmung zu beiden und verlinkt sie.
  "/agb",
  "/datenschutz",
];

// Server-zu-Server-Webhooks ohne Nutzer-Session — authentisieren sich selbst
// (z. B. per Capability-Token in der URL/im Payload), nicht per Auth-Cookie.
//
// /api/version liefert nur die Deployment-Kennung (Git-SHA). Ohne Eintrag hier
// bekämen Monteure darauf 403 aus der Rollenprüfung — ausgerechnet die Nutzer
// mit den langlebigsten Tabs. Ausserdem spart der frühe Ausstieg den
// Supabase-Roundtrip bei jeder Prüfung.
const PUBLIC_API_PATHS = ["/api/intake/email", "/api/version"];

function withSecurityHeaders(res: NextResponse): NextResponse {
  const isProd = process.env.NODE_ENV === "production";
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  );
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' http://127.0.0.1:54321 http://localhost:54321 ws://127.0.0.1:54321 ws://localhost:54321 https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://challenges.cloudflare.com",
      "frame-src 'self' https://challenges.cloudflare.com",
      "frame-ancestors 'self'",
    ].join("; "),
  );
  if (isProd) {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  return res;
}

const TECHNICIAN_ALLOWED_PREFIXES = [
  "/tag",
  "/auftrag",
  "/kalender",
  "/wochenplan",
  // Die untere Leiste der Monteur-Ansicht bietet «Zeit» an; ohne diesen Eintrag
  // wirft die Rollenprüfung den Monteur bei jedem Tippen zurück auf «Mein Tag».
  "/zeit",
  "/mfa/setup",
  "/onboarding",
  "/anmeldung",
  "/profil",
  "/tech",
  // Nach dem Zurücksetzen-Link ist der Monteur angemeldet; ohne diesen Eintrag
  // würde er von hier auf «Mein Tag» umgeleitet, ohne das Passwort zu setzen.
  "/passwort-neu",
  // Rechtstexte gelten für alle Rollen — ohne diese Einträge landet ein
  // angemeldeter Monteur beim Klick auf AGB/Datenschutz wieder auf «Mein Tag».
  "/agb",
  "/datenschutz",
];

/**
 * Segmentgenau vergleichen, nicht per `startsWith`: Sonst gäbe der Eintrag «/zeit»
 * auch «/zeiterfassung» frei — die Büro-Seite — und der Monteur käme an Daten,
 * die ihn nichts angehen.
 */
function isTechnicianAllowedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return TECHNICIAN_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Echte Dateiendungen statt «enthält einen Punkt».
 *
 * Die frühere Prüfung `pathname.includes(".")` stufte auch `/projekte/a.b` als
 * Datei ein — ein Pfad, der auf die dynamische Route `/projekte/[id]` passt.
 * Damit liess sich die gesamte Rollen- und Sitzungsprüfung überspringen.
 */
const STATIC_ASSET_PATTERN =
  /\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|ttf|otf|css|js|map|txt|xml|json|webmanifest)$/i;

/**
 * Statisch ist nur, was wirklich eine Datei ist: feste Asset-Präfixe oder eine
 * Datei direkt im Wurzelverzeichnis (alles in `public/` liegt dort).
 *
 * Entscheidend ist die Segmenttiefe: `/globe.svg` ist eine Datei, `/projekte/x.svg`
 * dagegen passt auf die dynamische Route `/projekte/[id]` und MUSS durch die
 * Authentifizierung. Eine reine Endungsprüfung würde beides gleich behandeln
 * und die Rollenprüfung für jede Route mit Punkt im letzten Segment aushebeln.
 */
function isStaticAssetPath(pathname: string): boolean {
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/favicon")
  ) {
    return true;
  }
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 1 && STATIC_ASSET_PATTERN.test(pathname);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function resolveMembershipRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  fallbackRole: RoleType,
): Promise<{ role: RoleType; organizationId: string | null }> {
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role, organization_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const role = mapRole((membership?.role as string | undefined) ?? fallbackRole);
  const organizationId = (membership?.organization_id as string | null | undefined) ?? null;
  return { role, organizationId };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ZUERST und bedingungslos: von aussen mitgeschickte Proxy-Header verwerfen.
  // Sie sind das interne Signal dieses Proxys an die App — käme eines von
  // aussen durch, könnte ein Fremder Rolle und Organisation frei wählen und
  // damit jede Rollenprüfung und jeden Service-Role-Pfad übernehmen.
  // `forward()` reicht ausschliesslich die bereinigten Header weiter; jeder
  // Rückgabeweg mit Durchlauf zur App MUSS es benutzen, nie NextResponse.next().
  const requestHeaders = new Headers(request.headers);
  stripProxyAuthContext(requestHeaders);
  const forward = () => NextResponse.next({ request: { headers: requestHeaders } });

  if (isStaticAssetPath(pathname)) {
    return withSecurityHeaders(forward());
  }

  if (PUBLIC_API_PATHS.some((path) => pathname.startsWith(path))) {
    return withSecurityHeaders(forward());
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!supabaseUrl || !supabaseAnonKey) {
    if (!isPublicPath) {
      const loginUrl = new URL("/anmeldung", request.url);
      return withSecurityHeaders(NextResponse.redirect(loginUrl));
    }
    return withSecurityHeaders(forward());
  }

  // Public pages without auth cookie: skip Supabase auth API entirely.
  if (isPublicPath && !hasSupabaseAuthCookie(request.cookies.getAll())) {
    return withSecurityHeaders(forward());
  }

  // Protected routes without session cookie: redirect without getUser() round-trip.
  if (!isPublicPath && !hasSupabaseAuthCookie(request.cookies.getAll())) {
    if (pathname.startsWith("/api")) {
      return withSecurityHeaders(NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 }));
    }
    const loginUrl = new URL("/anmeldung", request.url);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  // requestHeaders stammt von oben — bereits von eingehenden Proxy-Headern befreit.
  const response = withSecurityHeaders(forward());

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  let role: RoleType = "office";
  let organizationId: string | null = null;

  if (user) {
    const fromMetadata = readProxyAuthFromAppMetadata(user);
    const membership = fromMetadata
      ? fromMetadata
      : await resolveMembershipRole(supabase, user.id, "office");
    role = membership.role;
    organizationId = membership.organizationId;
    applyProxyAuthContext(requestHeaders, {
      userId: user.id,
      role,
      organizationId,
    });
  }

  if (!isAuthenticated && !isPublicPath) {
    if (pathname.startsWith("/api")) {
      return withSecurityHeaders(NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 }));
    }
    const loginUrl = new URL("/anmeldung", request.url);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (isAuthenticated && pathname === "/anmeldung") {
    return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
  }

  if (isAuthenticated && pathname === "/") {
    const dest = role === "technician" ? "/tag" : "/projekte";
    return withSecurityHeaders(NextResponse.redirect(new URL(dest, request.url)));
  }

  if (isAuthenticated && role === "technician" && !isTechnicianAllowedPath(pathname)) {
    return denyTechnician(pathname, request);
  }

  return response;
}

function denyTechnician(pathname: string, request: NextRequest): NextResponse {
  if (pathname.startsWith("/api")) {
    return withSecurityHeaders(NextResponse.json({ error: "Kein Zugriff." }, { status: 403 }));
  }
  return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
}

/**
 * Nur feste Asset-Pfade ausnehmen — KEINE generische Endungsregel.
 *
 * Die frühere Fassung nahm jeden Pfad auf `.svg`, `.png`, … vom Proxy aus.
 * Da `/projekte/x.svg` auf die dynamische Route `/projekte/[id]` passt, lief so
 * ein Server-Action-POST vollständig an der Authentifizierung vorbei — samt
 * mitgeschickter Proxy-Header. Echte Dateien unter anderen Pfaden fängt jetzt
 * STATIC_ASSET_PATTERN im Proxy ab, nachdem die Header bereinigt sind.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)"],
};
