"use server";

import { requireAdminLayoutSession } from "@/lib/auth/organization";
import { completeOrganizationOnboarding, updateOrganizationName } from "@/lib/db/onboarding";
import { z } from "zod";

const organizationNameSchema = z
  .string()
  .trim()
  .min(1, "Firmenname darf nicht leer sein.")
  .max(120, "Firmenname ist zu lang.");

export async function updateOrganizationNameAction(name: unknown): Promise<void> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  const parsed = organizationNameSchema.safeParse(name);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  return updateOrganizationName(session.organizationId, parsed.data);
}

export async function completeOnboardingAction(): Promise<void> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  return completeOrganizationOnboarding(session.organizationId);
}
