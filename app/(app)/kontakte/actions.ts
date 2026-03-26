"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import {
  createContact,
  deleteSiteProperty,
  deleteContact,
  deleteContactAddress,
  deleteContactPerson,
  getContactWithDetails,
  insertSiteProperty,
  insertContactAddress,
  insertContactPerson,
  updateContact,
  updateContactAddress,
  updateContactPerson,
} from "@/lib/db/repository";
import { contactCreateSchema, contactUpdateSchema } from "@/lib/validations/forms";

function isEmptyPerson(p: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  roleTitle?: string | null;
}): boolean {
  const hasName = (p.firstName?.trim() ?? "") !== "" || (p.lastName?.trim() ?? "") !== "";
  const hasOther =
    (p.email?.trim() ?? "") !== "" ||
    (p.phone?.trim() ?? "") !== "" ||
    (p.mobile?.trim() ?? "") !== "" ||
    (p.roleTitle?.trim() ?? "") !== "";
  return !hasName && !hasOther;
}

function isEmptyAddress(a: {
  label?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
}): boolean {
  return (
    (a.label?.trim() ?? "") === "" &&
    (a.street?.trim() ?? "") === "" &&
    (a.postalCode?.trim() ?? "") === "" &&
    (a.city?.trim() ?? "") === ""
  );
}

function deriveDefaultSitePropertyName(input: { managedObjectLabel?: string | null; name: string }) {
  const managed = input.managedObjectLabel?.trim();
  if (managed) {
    return managed;
  }
  return `${input.name.trim()} Hauptobjekt`;
}

function hasRootAddressBits(input: { street?: string | null; postalCode?: string | null; city?: string | null }) {
  return Boolean(input.street?.trim() || input.postalCode?.trim() || input.city?.trim());
}

export async function getContactBundleAction(contactId: string) {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  const bundle = await getContactWithDetails(contactId);
  if (!bundle) {
    throw new Error("Kontakt nicht gefunden.");
  }
  return bundle;
}

export async function updateContactFromFormAction(values: unknown) {
  const parsed = contactUpdateSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }

  const v = parsed.data;
  const id = v.id;

  const existing = await getContactWithDetails(id);
  if (!existing) {
    throw new Error("Kontakt nicht gefunden.");
  }

  await updateContact(id, {
    partyKind: v.partyKind,
    category: v.category,
    contactNumber: v.contactNumber?.trim() || null,
    name: v.name.trim(),
    uidNumber: v.uidNumber?.trim() || null,
    phone: v.phone?.trim() || null,
    mobile: v.mobile?.trim() || null,
    email: v.email?.trim() || null,
    website: v.website?.trim() || null,
    street: v.street?.trim() || null,
    postalCode: v.postalCode?.trim() || null,
    city: v.city?.trim() || null,
    managedObjectLabel: v.managedObjectLabel?.trim() || null,
  });

  const incomingPersonIds = new Set(
    (v.persons ?? []).filter((p) => p.id?.trim()).map((p) => p.id!.trim()),
  );
  for (const ep of existing.persons) {
    if (!incomingPersonIds.has(ep.id)) {
      await deleteContactPerson(ep.id);
    }
  }

  for (const p of v.persons ?? []) {
    if (isEmptyPerson(p)) {
      if (p.id?.trim()) {
        await deleteContactPerson(p.id.trim());
      }
      continue;
    }
    if (p.id?.trim()) {
      await updateContactPerson(p.id.trim(), {
        firstName: p.firstName?.trim() || null,
        lastName: p.lastName?.trim() || null,
        email: p.email?.trim() || null,
        phone: p.phone?.trim() || null,
        mobile: p.mobile?.trim() || null,
        roleTitle: p.roleTitle?.trim() || null,
      });
    } else {
      await insertContactPerson({
        contactId: id,
        firstName: p.firstName?.trim() || null,
        lastName: p.lastName?.trim() || null,
        email: p.email?.trim() || null,
        phone: p.phone?.trim() || null,
        mobile: p.mobile?.trim() || null,
        roleTitle: p.roleTitle?.trim() || null,
      });
    }
  }

  const incomingAddressIds = new Set(
    (v.addresses ?? []).filter((a) => a.id?.trim()).map((a) => a.id!.trim()),
  );
  for (const ea of existing.addresses) {
    if (!incomingAddressIds.has(ea.id)) {
      await deleteContactAddress(ea.id);
    }
  }

  let primaryAssigned = false;
  let addressCountAfterUpdate = 0;
  for (const a of v.addresses ?? []) {
    if (isEmptyAddress(a)) {
      if (a.id?.trim()) {
        await deleteContactAddress(a.id.trim());
      }
      continue;
    }
    const label = (a.label?.trim() || "Adresse").trim();
    const isPrimary = Boolean(a.isPrimary) && !primaryAssigned;
    if (isPrimary) {
      primaryAssigned = true;
    }
    const country = (a.country?.trim() || "CH").trim();
    if (a.id?.trim()) {
      await updateContactAddress(a.id.trim(), {
        label,
        street: a.street?.trim() || null,
        postalCode: a.postalCode?.trim() || null,
        city: a.city?.trim() || null,
        country,
        isPrimary,
      });
      addressCountAfterUpdate += 1;
    } else {
      await insertContactAddress({
        contactId: id,
        label,
        street: a.street?.trim() || null,
        postalCode: a.postalCode?.trim() || null,
        city: a.city?.trim() || null,
        country,
        isPrimary,
      });
      addressCountAfterUpdate += 1;
    }
  }

  if (addressCountAfterUpdate === 0 && hasRootAddressBits(v)) {
    await insertContactAddress({
      contactId: id,
      label: "Hauptadresse",
      street: v.street?.trim() || null,
      postalCode: v.postalCode?.trim() || null,
      city: v.city?.trim() || null,
      country: "CH",
      isPrimary: true,
    });
  }

  if (existing.siteProperties.length === 0) {
    const hasAddressBits = hasRootAddressBits(v);
    const hasObjectName = Boolean(v.managedObjectLabel?.trim() || v.name.trim());
    if (hasObjectName || hasAddressBits) {
      await insertSiteProperty({
        organizationId: session.organizationId ?? null,
        ownerContactId: id,
        name: deriveDefaultSitePropertyName({ managedObjectLabel: v.managedObjectLabel, name: v.name }),
        street: v.street?.trim() || null,
        postalCode: v.postalCode?.trim() || null,
        city: v.city?.trim() || null,
        country: "CH",
        mapsUrl: null,
      });
    }
  }

  revalidatePath("/kontakte");
  revalidatePath(`/kontakte/${id}`);
  revalidatePath("/projekte");
}

export async function createContactFromFormAction(values: unknown) {
  const parsed = contactCreateSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  const session = await getCurrentSession();
  const v = parsed.data;

  const contact = await createContact({
    organizationId: session?.organizationId ?? null,
    contactNumber: v.contactNumber?.trim() || null,
    partyKind: v.partyKind,
    category: v.category,
    name: v.name.trim(),
    uidNumber: v.uidNumber?.trim() || null,
    phone: v.phone?.trim() || null,
    mobile: v.mobile?.trim() || null,
    email: v.email?.trim() || null,
    website: v.website?.trim() || null,
    street: v.street?.trim() || null,
    postalCode: v.postalCode?.trim() || null,
    city: v.city?.trim() || null,
    managedObjectLabel: v.managedObjectLabel?.trim() || null,
  });

  for (const p of v.persons ?? []) {
    const hasName = (p.firstName?.trim() ?? "") !== "" || (p.lastName?.trim() ?? "") !== "";
    const hasOther =
      (p.email?.trim() ?? "") !== "" ||
      (p.phone?.trim() ?? "") !== "" ||
      (p.mobile?.trim() ?? "") !== "" ||
      (p.roleTitle?.trim() ?? "") !== "";
    if (!hasName && !hasOther) {
      continue;
    }
    await insertContactPerson({
      contactId: contact.id,
      firstName: p.firstName?.trim() || null,
      lastName: p.lastName?.trim() || null,
      email: p.email?.trim() || null,
      phone: p.phone?.trim() || null,
      mobile: p.mobile?.trim() || null,
      roleTitle: p.roleTitle?.trim() || null,
    });
  }

  let primaryAssigned = false;
  let insertedAddressCount = 0;
  for (const a of v.addresses ?? []) {
    if ((a.label?.trim() ?? "") === "") {
      continue;
    }
    const isPrimary = Boolean(a.isPrimary) && !primaryAssigned;
    if (isPrimary) {
      primaryAssigned = true;
    }
    await insertContactAddress({
      contactId: contact.id,
      label: a.label!.trim(),
      street: a.street?.trim() || null,
      postalCode: a.postalCode?.trim() || null,
      city: a.city?.trim() || null,
      country: a.country?.trim() || "CH",
      isPrimary,
    });
    insertedAddressCount += 1;
  }

  if (insertedAddressCount === 0 && hasRootAddressBits(v)) {
    await insertContactAddress({
      contactId: contact.id,
      label: "Hauptadresse",
      street: v.street?.trim() || null,
      postalCode: v.postalCode?.trim() || null,
      city: v.city?.trim() || null,
      country: "CH",
      isPrimary: true,
    });
  }

  const hasAddressBits = hasRootAddressBits(v);
  const hasObjectName = Boolean(v.managedObjectLabel?.trim() || v.name.trim());
  if (hasObjectName || hasAddressBits) {
    await insertSiteProperty({
      organizationId: session?.organizationId ?? null,
      ownerContactId: contact.id,
      name: deriveDefaultSitePropertyName({ managedObjectLabel: v.managedObjectLabel, name: v.name }),
      street: v.street?.trim() || null,
      postalCode: v.postalCode?.trim() || null,
      city: v.city?.trim() || null,
      country: "CH",
      mapsUrl: null,
    });
  }

  revalidatePath("/kontakte");
  revalidatePath("/projekte");
  redirect(`/kontakte/${contact.id}`);
}

export async function deleteContactAction(contactId: string) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  if (!contactId?.trim()) {
    throw new Error("Kontakt-ID fehlt.");
  }

  await deleteContact(contactId.trim());
  revalidatePath("/kontakte");
}

export async function createSitePropertyForContactAction(input: {
  contactId: string;
  name: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  mapsUrl?: string;
}) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  const contactId = input.contactId?.trim();
  const name = input.name?.trim();
  if (!contactId) {
    throw new Error("Kontakt-ID fehlt.");
  }
  if (!name) {
    throw new Error("Objektname fehlt.");
  }
  await insertSiteProperty({
    organizationId: session.organizationId ?? null,
    ownerContactId: contactId,
    name,
    street: input.street?.trim() || null,
    postalCode: input.postalCode?.trim() || null,
    city: input.city?.trim() || null,
    country: input.country?.trim() || "CH",
    mapsUrl: input.mapsUrl?.trim() || null,
  });
  revalidatePath("/kontakte");
  revalidatePath(`/kontakte/${contactId}`);
  revalidatePath("/projekte");
}

export async function deleteSitePropertyForContactAction(input: { contactId: string; propertyId: string }) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  const contactId = input.contactId?.trim();
  const propertyId = input.propertyId?.trim();
  if (!contactId || !propertyId) {
    throw new Error("Objekt- oder Kontakt-ID fehlt.");
  }
  await deleteSiteProperty(propertyId);
  revalidatePath("/kontakte");
  revalidatePath(`/kontakte/${contactId}`);
  revalidatePath("/projekte");
}
