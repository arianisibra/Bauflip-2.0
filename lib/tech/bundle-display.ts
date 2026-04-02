import type { Contact, ContactAddress, SiteProperty } from "@/lib/domain/types";

export function bundleContactLabel(contact: Contact | null): string {
  const n = contact?.name?.trim();
  return n && n.length > 0 ? n : "—";
}

export function bundleSiteAddressShort(
  serviceAddress: ContactAddress | null,
  property: SiteProperty | null,
): string | null {
  const a = serviceAddress;
  const p = property;
  const parts = (street: string | null, pc: string | null, city: string | null) => {
    const line = [pc, city].filter(Boolean).join(" ").trim();
    if (street?.trim() && line) {
      return `${street.trim()}, ${line}`;
    }
    if (line) {
      return line;
    }
    return street?.trim() || null;
  };
  return parts(a?.street ?? null, a?.postalCode ?? null, a?.city ?? null) ?? parts(p?.street ?? null, p?.postalCode ?? null, p?.city ?? null);
}

export function bundleSiteAddressFull(
  serviceAddress: ContactAddress | null,
  property: SiteProperty | null,
): string {
  const short = bundleSiteAddressShort(serviceAddress, property);
  if (short) {
    return short;
  }
  return "Adresse noch nicht hinterlegt.";
}
