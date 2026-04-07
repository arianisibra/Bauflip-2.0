import type { Project } from "@/lib/domain/types";

/** Adresszeile ohne vollen `Project` (z. B. verschachtelte Supabase-Joins). */
export function formatServiceAddressFields(fields: {
  serviceStreet: string | null | undefined;
  servicePostalCode: string | null | undefined;
  serviceCity: string | null | undefined;
}): string {
  const parts = [
    fields.serviceStreet,
    [fields.servicePostalCode, fields.serviceCity].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.join(", ") || "—";
}

export function formatServiceAddress(p: Project): string {
  return formatServiceAddressFields({
    serviceStreet: p.serviceStreet,
    servicePostalCode: p.servicePostalCode,
    serviceCity: p.serviceCity,
  });
}

export function tenantLabel(p: Project): string {
  return p.tenantName?.trim() || "—";
}

export function managementLabel(p: Project): string {
  return p.managementName?.trim() || "—";
}
