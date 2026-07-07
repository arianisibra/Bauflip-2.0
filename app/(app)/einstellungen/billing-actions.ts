"use server";

import { requireAdminLayoutSession } from "@/lib/auth/organization";
import {
  getOrganizationBillingSettings,
  updateOrganizationBillingSettings,
} from "@/lib/db/billing";
import type { OrganizationBillingSettings } from "@/lib/domain/types";
import { billingSettingsSchema } from "@/lib/validations/forms";

const EMPTY_BILLING: OrganizationBillingSettings = {
  iban: null,
  creditorName: null,
  creditorStreet: null,
  creditorBuildingNumber: null,
  creditorPostalCode: null,
  creditorCity: null,
  vatNumber: null,
};

export async function getBillingSettingsAction(): Promise<OrganizationBillingSettings> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) return EMPTY_BILLING;
  return (await getOrganizationBillingSettings(session.organizationId)) ?? EMPTY_BILLING;
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
  });
}
