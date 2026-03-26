"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getProjectBundle,
  insertProjectWorkType,
  listAssignableProfiles,
  listContactAddressesForContact,
  listContactPersonsForContact,
  listContacts,
  listArticles,
  listProjectWorkTypes,
  listSiteProperties,
  listSupplierTemplates,
  updateProjectStammdaten,
} from "@/lib/db/repository";
import { projectStammdatenUpdateSchema } from "@/lib/validations/forms";

function nz(s: string | undefined | null): string | null {
  if (s == null) {
    return null;
  }
  const t = String(s).trim();
  return t === "" ? null : t;
}

export async function getContactProjectOptionsAction(contactId: string) {
  const [persons, addresses] = await Promise.all([
    listContactPersonsForContact(contactId),
    listContactAddressesForContact(contactId),
  ]);
  return { persons, addresses };
}

export async function getProjectSheetDataAction(projectId: string) {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  const bundle = await getProjectBundle(projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }
  const [contacts, properties, workTypes, profiles, supplierTemplates, articles] = await Promise.all([
    listContacts(),
    listSiteProperties(),
    listProjectWorkTypes(),
    listAssignableProfiles(),
    listSupplierTemplates(),
    listArticles(),
  ]);
  const { persons, addresses } = await getContactProjectOptionsAction(bundle.project.contactId);
  return {
    bundle,
    contacts,
    properties,
    workTypes,
    profiles,
    persons,
    addresses,
    supplierTemplates,
    articles,
    actorRole: session.role,
  };
}

export async function updateProjectStammdatenAction(values: unknown) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }

  const parsed = projectStammdatenUpdateSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  let v = parsed.data;
  if (v.newWorkTypeName?.trim()) {
    const wt = await insertProjectWorkType(v.newWorkTypeName);
    v = { ...v, workTypeId: wt.id, newWorkTypeName: undefined };
  }

  await updateProjectStammdaten(v.projectId, {
    contactId: v.contactId,
    title: v.title,
    tenantUnit: nz(v.tenantUnit),
    sitePhone: nz(v.sitePhone),
    siteMobile: nz(v.siteMobile),
    referenceCode: nz(v.referenceCode),
    technicianNotes: nz(v.technicianNotes),
    propertyId: nz(v.propertyId),
    mapsUrl: nz(v.mapsUrl),
    workTypeId: nz(v.workTypeId),
    contactPersonId: nz(v.contactPersonId),
    serviceAddressId: nz(v.serviceAddressId),
    billingAddressId: nz(v.billingAddressId),
    hintsAndNotes: nz(v.hintsAndNotes),
    nextOwnerUserId: nz(v.nextOwnerUserId),
    intakeOriginalText: v.intakeOriginalText ?? "",
    accessNotes: nz(v.accessNotes),
    keyHandlingNotes: nz(v.keyHandlingNotes),
    timingNotes: nz(v.timingNotes),
    internalNotes: nz(v.internalNotes),
  });

  revalidatePath(`/projekte/${v.projectId}`);
  revalidatePath("/projekte");
}
