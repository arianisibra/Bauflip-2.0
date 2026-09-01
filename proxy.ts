import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasSupabaseAuthCookie } from "@/lib/auth/cookies";
import { mapRole } from "@/lib/auth/map-role";
import { applyProxyAuthContext } from "@/lib/auth/proxy-auth-headers";
import { readProxyAuthFromAppMetadata } from "@/lib/auth/user-metadata-keys";
import type { RoleType } from "@/lib/domain/types";

const PUBLIC_PATHS = [
  "/anmeldung",
  "/onboarding",
  "/mfa/setup",
  "/auth/confirm",
  // Ohne Anmeldung erreichbar — wer sein Passwort vergessen hat, hat keine Session.
  "/passwort-vergessen",
];

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
  "/mfa/setup",
  "/onboarding",
  "/anmeldung",
  "/profil",
  "/tech",
  // Nach dem Zurücksetzen-Link ist der Monteur angemeldet; ohne diesen Eintrag
  // würde er von hier auf «Mein Tag» umgeleitet, ohne das Passwort zu setzen.
  "/passwort-neu",
];

function isTechnicianAllowedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return TECHNICIAN_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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

  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.includes(".");

  if (isStaticAsset) {
    return withSecurityHeaders(NextResponse.next());
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!supabaseUrl || !supabaseAnonKey) {
    if (!isPublicPath) {
      const loginUrl = new URL("/anmeldung", request.url);
      return withSecurityHeaders(NextResponse.redirect(loginUrl));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  // Public pages without auth cookie: skip Supabase auth API entirely.
  if (isPublicPath && !hasSupabaseAuthCookie(request.cookies.getAll())) {
    return withSecurityHeaders(NextResponse.next());
  }

  // Protected routes without session cookie: redirect without getUser() round-trip.
  if (!isPublicPath && !hasSupabaseAuthCookie(request.cookies.getAll())) {
    if (pathname.startsWith("/api")) {
      return withSecurityHeaders(NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 }));
    }
    const loginUrl = new URL("/anmeldung", request.url);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  const requestHeaders = new Headers(request.headers);
  const response = withSecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
  );

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
    // Rollen-Vorgabe für den Ersatzweg ebenfalls aus app_metadata — derselben
    // Quelle, die auch die RLS-Regeln der Datenbank lesen.
    const metaRole = mapRole(user.app_metadata?.role as string | undefined);
    const fromMetadata = readProxyAuthFromAppMetadata(user);
    const membership = fromMetadata
      ? fromMetadata
      : await resolveMembershipRole(supabase, user.id, metaRole);
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

export const config = {
  matcher: [
    // `api/browser-log` bewusst ausgenommen: Der Mitschnitt darf keine
    // Anmeldeprüfung auslösen. Sonst würde jede Meldung ein `auth.getUser()`
    // und ggf. eine Abfrage auf `organization_memberships` nach sich ziehen —
    // ausgerechnet während einer Störung, wo die Datenbank ohnehin am Limit
    // ist, würde das Diagnosewerkzeug die Last erhöhen. Ausserdem wären
    // Monteure ausgesperrt: `/api/browser-log` steht nicht in
    // TECHNICIAN_ALLOWED_PREFIXES, `denyTechnician` beantwortet /api-Pfade mit 403.
    "/((?!api/browser-log|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|txt|xml)$).*)",
  ],
};
