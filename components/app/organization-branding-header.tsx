"use client";

import { usePathname } from "next/navigation";

import { UserAvatarButton } from "@/components/app/user-avatar-button";
import { useOrganizationBranding } from "@/lib/query/hooks";

export function OrganizationBrandingHeader() {
  const pathname = usePathname();
  // Branding auf /projekte kommt aus SSR-Bootstrap (Cache-Prime).
  const isProjekteHub = pathname === "/projekte";
  const { data } = useOrganizationBranding({ fetch: !isProjekteHub });

  return (
    <UserAvatarButton
      organizationName={data?.name ?? "Bauflip"}
      organizationLogoUrl={data?.logoUrl ?? null}
    />
  );
}
