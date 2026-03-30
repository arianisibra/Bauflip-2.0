"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import {
  deleteProject,
  deleteProjectWorkType,
  getProjectBundle,
  insertProjectWorkType,
  updateProjectStammdaten,
} from "@/lib/db/repository";
import {
  getCachedOrganizationZapierEnabled,
  getCachedProjectFileSignedUrl,
  loadContactProjectOptions,
  loadProjectSheetReferenceLists,
} from "@/lib/app/project-sheet-cache";
import { projectStammdatenUpdateSchema } from "@/lib/validations/forms";

function nz(s: string | undefined | null): string | null {
  if (s == null) {
    return null;
  }
  const t = String(s).trim();
  return t === "" ? null : t;
}

export async function getContactProjectOptionsAction(contactId: string) {
  return loadContactProjectOptions(contactId);
}

export async function getProjectSheetDataAction(projectId: string) {
  const session = await getCurrentSession();
  const bundle = await getProjectBundle(projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }
  const {
    contacts,
    properties,
    workTypes,
    profiles,
    supplierTemplates,
    articles,
    outcomeOptions,
    locationOptions,
  } = await loadProjectSheetReferenceLists();
  const { persons, addresses } = await loadContactProjectOptions(bundle.project.contactId);
  const reportAttachments = await Promise.all(
    (bundle.attachments ?? []).map(async (a) => ({
      ...a,
      href: await getCachedProjectFileSignedUrl(a.filePath),
    })),
  );

  const integrationZapierEnabled = session?.organizationId
    ? await getCachedOrganizationZapierEnabled(session.organizationId)
    : false;

  return {
    bundle,
    reportAttachments,
    contacts,
    properties,
    workTypes,
    profiles,
    persons,
    addresses,
    supplierTemplates,
    articles,
    outcomeOptions,
    locationOptions,
    actorRole: session?.role ?? "office",
    integrationZapierEnabled,
  };
}

/** Nur Bundle, Anhänge, Kontakt-Optionen — keine org-weiten Referenzlisten (nach Mutationen / Refresh). */
export async function refreshProjectSheetViewAction(projectId: string) {
  const session = await getCurrentSession();
  const bundle = await getProjectBundle(projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }
  const { persons, addresses } = await loadContactProjectOptions(bundle.project.contactId);
  const reportAttachments = await Promise.all(
    (bundle.attachments ?? []).map(async (a) => ({
      ...a,
      href: await getCachedProjectFileSignedUrl(a.filePath),
    })),
  );
  const integrationZapierEnabled = session?.organizationId
    ? await getCachedOrganizationZapierEnabled(session.organizationId)
    : false;

  return {
    bundle,
    reportAttachments,
    persons,
    addresses,
    actorRole: session?.role ?? "office",
    integrationZapierEnabled,
  };
}

export async function addProjectWorkTypeAction(name: string) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Bezeichnung fehlt.");
  }
  const wt = await insertProjectWorkType(trimmed);
  revalidatePath("/projekte");
  return { id: wt.id };
}

export async function deleteProjectWorkTypeAction(workTypeId: string) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  if (!workTypeId) {
    throw new Error("Arbeitsart-ID fehlt.");
  }
  await deleteProjectWorkType(workTypeId);
  revalidatePath("/projekte");
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
    timingNotes: null,
    internalNotes: nz(v.internalNotes),
  });

  revalidatePath(`/projekte/${v.projectId}`);
  revalidatePath("/projekte");
}

export async function deleteProjectAction(projectId: string) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  if (!projectId) {
    throw new Error("Projekt-ID fehlt.");
  }

  await deleteProject(projectId);
  revalidatePath("/projekte");
}
