import type { UserProfile } from "@/lib/domain/types";

export type EinstellungenPageData = {
  profile: UserProfile;
  canEditCompanySettings: boolean;
  supabaseConfigured: boolean;
};
