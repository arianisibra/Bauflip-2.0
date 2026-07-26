"use server";

import { requireAdminLayoutSession } from "@/lib/auth/organization";
import { getIntakeEmailToken, regenerateIntakeEmailToken } from "@/lib/db/intake-email";

export type IntakeEmailSettings = {
  token: string;
  /** null, wenn INTAKE_EMAIL_DOMAIN nicht gesetzt ist — Funktion dann inaktiv. */
  address: string | null;
};

function buildAddress(token: string): string | null {
  const domain = process.env.INTAKE_EMAIL_DOMAIN?.trim();
  if (!domain) return null;
  return `intake+${token}@${domain}`;
}

export async function getIntakeEmailSettingsAction(): Promise<IntakeEmailSettings> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) return { token: "", address: null };
  const token = (await getIntakeEmailToken(session.organizationId)) ?? "";
  return { token, address: token ? buildAddress(token) : null };
}

export async function regenerateIntakeEmailTokenAction(): Promise<IntakeEmailSettings> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");
  const token = await regenerateIntakeEmailToken(session.organizationId);
  return { token, address: buildAddress(token) };
}
