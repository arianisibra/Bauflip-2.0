import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function createSupabaseServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const cookieStore = await cookies();
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
          // Server Components cannot always set cookies during render; session refresh runs in `proxy` middleware.
          if (process.env.NODE_ENV === "development") {
            console.warn("[supabase] cookie set skipped in Server Component (expected if middleware refreshed session).");
          }
        }
      },
    },
  });
}
