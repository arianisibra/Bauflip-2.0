import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/anmeldung"];

/** Security-Header auf jede Response (CSP später iterativ, s. Next-Docs). */
function withSecurityHeaders(res: NextResponse): NextResponse {
  const isProd = process.env.NODE_ENV === "production";
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  if (isProd) {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  return res;
}
/** Monteur: nur Einsatz-Routen und Onboarding/MFA, kein Büro (/projekte, /einstellungen, /mitarbeiter). */
const TECHNICIAN_ALLOWED_PREFIXES = [
  "/tag",
  "/auftrag",
  "/mfa/setup",
  "/onboarding",
  "/anmeldung",
  "/profil",
  "/tech",
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
    const appUrl = new URL("/", request.url);
    return withSecurityHeaders(NextResponse.redirect(appUrl));
  }

  if (isAuthenticated && role === "technician" && !isTechnicianAllowedPath(pathname)) {
    if (pathname.startsWith("/api")) {
      return withSecurityHeaders(NextResponse.json({ error: "Kein Zugriff." }, { status: 403 }));
    }
    const appUrl = new URL("/", request.url);
    return withSecurityHeaders(NextResponse.redirect(appUrl));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
