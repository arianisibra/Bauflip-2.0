"use client";

import { useOrganizationBrandingContext } from "@/components/app/organization-branding-provider";
import { ProfileSettingsForm } from "@/components/app/profile-settings-form";
import { useEinstellungenPage, useOrganizationBranding } from "@/lib/query/hooks";

export function EinstellungenPageClient() {
  const layoutBranding = useOrganizationBrandingContext();
  const { data: branding } = useOrganizationBranding({
    fetch: false,
    initialData: layoutBranding ?? undefined,
  });
  const { data } = useEinstellungenPage();

  if (!data) {
    return null;
  }

  const organizationBilling = branding
    ? { companyName: branding.name, logoUrl: branding.logoUrl }
    : null;

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profil und Kalenderdarstellung.</p>
      </header>

      <ProfileSettingsForm
        profile={data.profile}
        supabaseConfigured={data.supabaseConfigured}
        canEditCompanySettings={data.canEditCompanySettings}
        organizationBilling={organizationBilling}
      />
    </section>
  );
}
