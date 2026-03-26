import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/anmeldung"];
const technicianAllowedPrefixes = ["/projekte", "/termine", "/rapporte", "/team-chat", "/mitarbeiter", "/anmeldung"];
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
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!supabaseUrl || !supabaseAnonKey) {
    if (!isPublicPath) {
      const loginUrl = new URL("/anmeldung", request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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

  let role = "office";
  if (user) {
    const [{ data: roleData }, membershipResult] = await Promise.all([
      supabase.rpc("current_user_role"),
      supabase
        .from("organization_memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    role = mapRole((membershipResult.data?.role as string | null | undefined) ?? (roleData as string));
  }

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
    role === "technician" &&
    pathname !== "/" &&
    !technicianAllowedPrefixes.some((prefix) => pathname.startsWith(prefix))
  ) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
    }
    const appUrl = new URL("/", request.url);
    return NextResponse.redirect(appUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
