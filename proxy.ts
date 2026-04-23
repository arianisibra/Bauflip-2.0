import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/anmeldung", "/onboarding", "/mfa/setup"];

function withSecurityHeaders(res: NextResponse): NextResponse {
  const isProd = process.env.NODE_ENV === "production";
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // camera=(self): Monteur-Fotos per <input capture> / Kamera-API auf derselben Origin; Rest gesperrt.
  res.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  );
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  // Cloudflare Turnstile: Script + iframe von challenges.cloudflare.com (sonst leeres Widget trotz Site-Key).
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
/** Monteur: nur Einsatz-Routen und Onboarding/MFA, kein Büro (/projekte, /einstellungen, /mitarbeiter). */
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
  // SSE realtime stream — same origin, auth'd via session cookie.
  "/api/events",
];

function isTechnicianAllowedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return TECHNICIAN_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function mapRole(raw: string | null | undefined) {
  if (raw === "admin" || raw === "office" || raw === "technician") {
    return raw;
  }
  if (raw === "monteur") {
    return "technician";
  }
  return "office";
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

  const response = withSecurityHeaders(
    NextResponse.next({
      request: {
        headers: request.headers,
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

  let role: ReturnType<typeof mapRole> = "office";
  if (user) {
    const rawMeta = user.user_metadata?.role as string | undefined;
    role = mapRole(rawMeta);
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
    return redirectRootByRole(supabase, user!, role, request);
  }

  if (isAuthenticated && role === "technician" && !isTechnicianAllowedPath(pathname)) {
    return denyTechnician(pathname, request);
  }

  return response;
}

async function redirectRootByRole(
  supabase: ReturnType<typeof createServerClient>,
  user: { id: string },
  fallbackRole: ReturnType<typeof mapRole>,
  request: NextRequest,
): Promise<NextResponse> {
  // Resolve role from membership here (before any layout streams) so
  // technicians don't flash the office sidebar.
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const resolvedRole = mapRole((membership?.role as string | undefined) ?? fallbackRole);
  const dest = resolvedRole === "technician" ? "/tag" : "/projekte";
  return withSecurityHeaders(NextResponse.redirect(new URL(dest, request.url)));
}

function denyTechnician(pathname: string, request: NextRequest): NextResponse {
  if (pathname.startsWith("/api")) {
    return withSecurityHeaders(NextResponse.json({ error: "Kein Zugriff." }, { status: 403 }));
  }
  return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
