"use client";

import { BexioSettingsForm } from "@/components/app/bexio-settings-form";
import { BillingSettingsForm } from "@/components/app/billing-settings-form";
import { InvitePreferenceToggle } from "@/components/app/invite-preference-toggle";
import { useOrganizationBrandingContext } from "@/components/app/organization-branding-provider";
import { PriceBookManager } from "@/components/app/price-book-manager";
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

      <PriceBookManager />

      {data.canEditCompanySettings ? <BillingSettingsForm /> : null}

      {data.canEditCompanySettings ? <BexioSettingsForm /> : null}

      <InvitePreferenceToggle />
    </section>
  );
}
