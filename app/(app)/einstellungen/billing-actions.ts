"use server";

import { requireAdminLayoutSession } from "@/lib/auth/organization";
import {
  EMPTY_ORGANIZATION_BILLING_SETTINGS,
  getOrganizationBillingSettings,
  updateOrganizationBillingSettings,
} from "@/lib/db/billing";
import type { OrganizationBillingSettings } from "@/lib/domain/types";
import { billingSettingsSchema } from "@/lib/validations/forms";

export async function getBillingSettingsAction(): Promise<OrganizationBillingSettings> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) return EMPTY_ORGANIZATION_BILLING_SETTINGS;
  return (await getOrganizationBillingSettings(session.organizationId)) ?? EMPTY_ORGANIZATION_BILLING_SETTINGS;
}

export async function updateBillingSettingsAction(
  values: unknown,
): Promise<OrganizationBillingSettings> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  const parsed = billingSettingsSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  return updateOrganizationBillingSettings(session.organizationId, {
    iban: parsed.data.iban || null,
    creditorName: parsed.data.creditorName || null,
    creditorStreet: parsed.data.creditorStreet || null,
    creditorBuildingNumber: parsed.data.creditorBuildingNumber || null,
    creditorPostalCode: parsed.data.creditorPostalCode || null,
    creditorCity: parsed.data.creditorCity || null,
    vatNumber: parsed.data.vatNumber || null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    website: parsed.data.website || null,
  });
}
