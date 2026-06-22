import "server-only";

import type { LayoutSession } from "@/lib/auth/session";
import { getCachedUserProfile } from "@/lib/auth/session";
import { getOrganizationBranding } from "@/lib/db/repository";
import type { EinstellungenPageData } from "@/lib/einstellungen/types";
import { queryKeys } from "@/lib/query/keys";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { dehydrate, QueryClient } from "@tanstack/react-query";

export const EINSTELLUNGEN_BOOTSTRAP_STALE_MS = 60_000;

export async function buildEinstellungenDehydratedState(
  session: LayoutSession,
): Promise<ReturnType<typeof dehydrate>> {
  const [profile, branding] = await Promise.all([
    getCachedUserProfile(session),
    session.organizationId
      ? getOrganizationBranding(session.organizationId)
      : Promise.resolve({ name: "Bauflip", logoUrl: null as string | null }),
  ]);

  const pageData: EinstellungenPageData = {
    profile,
    canEditCompanySettings: session.role === "admin",
    supabaseConfigured: hasSupabaseConfig(),
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: EINSTELLUNGEN_BOOTSTRAP_STALE_MS,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  queryClient.setQueryData(queryKeys.einstellungenPage(), pageData);
  queryClient.setQueryData(queryKeys.organizationBranding(), branding);

  return dehydrate(queryClient);
}
