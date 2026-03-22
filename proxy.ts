import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/anmeldung"];
const technicianAllowedPrefixes = ["/projekte", "/termine", "/rapporte", "/team-chat", "/anmeldung"];
const mockAuthEnabled = process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_AUTH === "true";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.includes(".");

  if (isStaticAsset) {
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isAuthenticated = mockAuthEnabled && request.cookies.get("bauflip_mock_auth")?.value === "1";
  const role = request.cookies.get("bauflip_mock_role")?.value ?? "admin";

  if (!isAuthenticated && !isPublicPath) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
    }
    const loginUrl = new URL("/anmeldung", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && pathname === "/anmeldung") {
    const appUrl = new URL("/", request.url);
    return NextResponse.redirect(appUrl);
  }

  if (
    isAuthenticated &&
    role === "monteur" &&
    pathname !== "/" &&
    !technicianAllowedPrefixes.some((prefix) => pathname.startsWith(prefix))
  ) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
    }
    const appUrl = new URL("/", request.url);
    return NextResponse.redirect(appUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
