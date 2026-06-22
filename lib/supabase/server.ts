import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export { hasSupabaseConfig } from "@/lib/supabase/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function createSupabaseServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch (err) {
    console.error("[supabase] cookies() in createSupabaseServerClient failed", err);
    return null;
  }
  const mockAuthEnabled =
    process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_AUTH === "true";
  const mockAuthenticated = cookieStore.get("bauflip_mock_auth")?.value === "1";
  const hasSupabaseAuthCookie = cookieStore
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (mockAuthEnabled && mockAuthenticated && !hasSupabaseAuthCookie && supabaseServiceRoleKey) {
    // Use service role only for explicit mock sessions.
    return createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
        } catch {
          /* Session refresh writes cookies; some server contexts reject writes (see Supabase SSR + Next.js docs). */
          if (process.env.NODE_ENV === "development") {
            console.warn("[supabase] cookie set skipped (session refresh may run in proxy).");
          }
        }
      },
    },
  });
}
