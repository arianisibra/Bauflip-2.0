"use server";

import { requireAdminLayoutSession, requireOfficeSession } from "@/lib/auth/organization";
import { getCachedSessionProfile } from "@/lib/auth/session";
import {
  BexioApiError,
  listBexioAccounts,
  listBexioTaxes,
  testBexioConnection,
  type BexioAccount,
  type BexioTax,
} from "@/lib/bexio/client";
import { clearBexioToken, getBexioToken, setBexioToken } from "@/lib/bexio/secrets";
import {
  getBexioSettings,
  markBexioConnected,
  markBexioDisconnected,
  setBexioMapping,
} from "@/lib/db/bexio";
import type { BexioSettings } from "@/lib/domain/types";

const EMPTY_BEXIO: BexioSettings = {
  connected: false,
  connectedAt: null,
  taxId: null,
  accountId: null,
};

export async function getBexioSettingsAction(): Promise<BexioSettings> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) return EMPTY_BEXIO;
  return (await getBexioSettings(session.organizationId)) ?? EMPTY_BEXIO;
}

/**
 * Nur der Verbindungsstatus (Office-Ebene, ohne Mapping-Details) — steuert, ob der
 * «Nach Bexio übertragen»-Menüpunkt an einer Rechnung überhaupt erscheint.
 */
export async function isBexioConnectedAction(): Promise<boolean> {
  const session = await requireOfficeSession();
  if (!session.organizationId) return false;
  return (await getBexioSettings(session.organizationId))?.connected ?? false;
}

/** Token gegen die Bexio-API testen, erst bei Erfolg speichern — nie ungeprüft ablegen. */
export async function connectBexioAction(token: string): Promise<BexioSettings> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  const trimmed = token.trim();
  if (!trimmed) throw new Error("Bitte einen Bexio-API-Token eingeben.");

  try {
    await testBexioConnection(trimmed);
  } catch (err) {
    if (err instanceof BexioApiError) throw new Error(err.message);
    throw new Error("Verbindung zu Bexio fehlgeschlagen.");
  }

  const profile = await getCachedSessionProfile(session);
  await setBexioToken(session.organizationId, trimmed, profile.userId, profile.displayName);
  return markBexioConnected(session.organizationId);
}

export async function disconnectBexioAction(): Promise<BexioSettings> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  await clearBexioToken(session.organizationId);
  return markBexioDisconnected(session.organizationId);
}

export type BexioMappingOptions = {
  accounts: BexioAccount[];
  taxes: BexioTax[];
};

/** Live aus Bexio geladen (nicht zwischengespeichert) — nur für die Mapping-Dropdowns. */
export async function getBexioMappingOptionsAction(): Promise<BexioMappingOptions> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  const token = await getBexioToken(session.organizationId);
  if (!token) throw new Error("Bexio ist nicht verbunden.");

  try {
    const [accounts, taxes] = await Promise.all([listBexioAccounts(token), listBexioTaxes(token)]);
    return { accounts, taxes };
  } catch (err) {
    if (err instanceof BexioApiError) throw new Error(err.message);
    throw new Error("Bexio-Daten konnten nicht geladen werden.");
  }
}

export async function saveBexioMappingAction(input: {
  taxId: number | null;
  accountId: number | null;
}): Promise<BexioSettings> {
  const session = await requireAdminLayoutSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  return setBexioMapping(session.organizationId, input.taxId, input.accountId);
}
