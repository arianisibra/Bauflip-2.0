import { cache } from "react";
import type { ContactAddress, ContactPerson } from "@/lib/domain/types";
import {
  listArticles,
  listAssignableProfiles,
  listContactAddressesForContact,
  listContactPersonsForContact,
  listContacts,
  listProjectWorkTypes,
  listReportOutcomeOptions,
  listReportSelectOptions,
  listSiteProperties,
  listSupplierTemplates,
} from "@/lib/db/repository";
import { getProjectFileSignedUrl } from "@/lib/storage/signed-urls";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Org-weite Listen für das Projekt-Sheet — pro Request nur einmal geladen (React.cache). */
export const loadProjectSheetReferenceLists = cache(async () => {
  const [
    contacts,
    properties,
    workTypes,
    profiles,
    supplierTemplates,
    articles,
    outcomeOptions,
    locationOptions,
  ] = await Promise.all([
    listContacts(),
    listSiteProperties(),
    listProjectWorkTypes(),
    listAssignableProfiles(),
    listSupplierTemplates(),
    listArticles(),
    listReportOutcomeOptions(),
    listReportSelectOptions("ort"),
  ]);
  return {
    contacts,
    properties,
    workTypes,
    profiles,
    supplierTemplates,
    articles,
    outcomeOptions,
    locationOptions,
  };
});

export const loadContactProjectOptions = cache(async (contactId: string) => {
  const id = String(contactId ?? "").trim();
  if (!id) {
    return { persons: [] as ContactPerson[], addresses: [] as ContactAddress[] };
  }
  const [persons, addresses] = await Promise.all([
    listContactPersonsForContact(id),
    listContactAddressesForContact(id),
  ]);
  return { persons, addresses };
});

export const getCachedOrganizationZapierEnabled = cache(async (organizationId: string) => {
  const id = String(organizationId ?? "").trim();
  if (!id) {
    return false;
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return false;
  }
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("zapier_enabled")
    .eq("id", id)
    .maybeSingle();
  return Boolean(orgRow?.zapier_enabled);
});

/** Gleicher Storage-Pfad wird pro Request nur einmal signiert. */
export const getCachedProjectFileSignedUrl = cache(async (filePath: string) =>
  getProjectFileSignedUrl(filePath),
);
