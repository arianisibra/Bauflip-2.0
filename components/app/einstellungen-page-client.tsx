"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchEinstellungenPageDataAction } from "@/app/(app)/layout-actions";
import { ProfileSettingsForm } from "@/components/app/profile-settings-form";
import { BauflipLoading } from "@/components/ui/bauflip-loading";
import { useOrganizationBranding } from "@/lib/query/hooks";

export function EinstellungenPageClient() {
  const { data: branding } = useOrganizationBranding();

  const { data, isLoading } = useQuery({
    queryKey: ["einstellungen-page"],
    queryFn: () => fetchEinstellungenPageDataAction(),
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16" role="status" aria-live="polite">
        <BauflipLoading size="sm" label="Einstellungen werden geladen …" />
      </div>
    );
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
