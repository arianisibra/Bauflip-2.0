"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { OrganizationBrandingSnapshot } from "@/lib/projekte/bootstrap-types";

const OrganizationBrandingContext = createContext<OrganizationBrandingSnapshot | null>(null);

export function OrganizationBrandingProvider({
  value,
  children,
}: {
  value: OrganizationBrandingSnapshot;
  children: ReactNode;
}) {
  return (
    <OrganizationBrandingContext.Provider value={value}>{children}</OrganizationBrandingContext.Provider>
  );
}

export function useOrganizationBrandingContext(): OrganizationBrandingSnapshot | null {
  return useContext(OrganizationBrandingContext);
}
