"use client";

import { UserAvatarButton } from "@/components/app/user-avatar-button";
import { useOrganizationBrandingContext } from "@/components/app/organization-branding-provider";
import { useOrganizationBranding } from "@/lib/query/hooks";

export function OrganizationBrandingHeader() {
  const layoutBranding = useOrganizationBrandingContext();
  const { data: queryBranding } = useOrganizationBranding({
    fetch: layoutBranding == null,
    initialData: layoutBranding ?? undefined,
  });
  const branding = queryBranding ?? layoutBranding;

  return (
    <UserAvatarButton
      organizationName={branding?.name ?? "Bauflip"}
      organizationLogoUrl={branding?.logoUrl ?? null}
    />
  );
}
