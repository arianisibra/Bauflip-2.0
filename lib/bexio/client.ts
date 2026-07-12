import "server-only";

/**
 * Bexio-API-Client (Teil B, Modell A): schlanker fetch-Wrapper, kein SDK.
 * Feldnamen/Endpunkte sind gegen den Quellcode + Tests eines gepflegten
 * Community-Clients (codebar-ag/laravel-bexio) kreuzverifiziert — siehe
 * docs/PLAN-zahlungen-bexio.md Abschnitt "Verifiziertes Schema (B0)".
 */

const BEXIO_BASE_URL = "https://api.bexio.com";

export class BexioApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BexioApiError";
  }
}

/** path beginnt mit der API-Version, z. B. "/2.0/accounts" oder "/3.0/taxes" (Bexio mischt Namespaces). */
async function bexioFetch(token: string, path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BEXIO_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new BexioApiError("Bexio-Token ungültig oder abgelaufen.", 401);
    }
    if (res.status === 429) {
      throw new BexioApiError("Bexio-Rate-Limit erreicht — bitte später erneut versuchen.", 429);
    }
    const body = await res.text().catch(() => "");
    throw new BexioApiError(
      `Bexio-Anfrage fehlgeschlagen (${res.status})${body ? `: ${body.slice(0, 300)}` : ""}`,
      res.status,
    );
  }
  if (res.status === 204) return null;
  return res.json();
}

export type BexioAccount = {
  id: number;
  account_no: string;
  name: string;
  account_type: number;
  is_active: boolean;
};

export type BexioTax = {
  id: number;
  name: string;
  display_name: string;
  value: number;
  is_active: boolean;
};

export type BexioContact = {
  id: number;
  name_1: string;
  name_2: string | null;
  mail: string | null;
};

/** Verbindungstest: schlägt bei ungültigem Token mit BexioApiError(401) fehl. */
export async function testBexioConnection(token: string): Promise<void> {
  await bexioFetch(token, "/2.0/accounts?limit=1");
}

/** Für das Konto-Mapping (Teil B2) — Ertragskonten filtert die UI selbst (account_type). */
export async function listBexioAccounts(token: string): Promise<BexioAccount[]> {
  const data = await bexioFetch(token, "/2.0/accounts?limit=500");
  return Array.isArray(data) ? (data as BexioAccount[]) : [];
}

/** Für das Steuersatz-Mapping (Teil B2) — anderer Namespace (3.0) als der Rest der API. */
export async function listBexioTaxes(token: string): Promise<BexioTax[]> {
  const data = await bexioFetch(
    token,
    "/3.0/taxes?limit=200&offset=0&scope=active&types=sales_tax",
  );
  return Array.isArray(data) ? (data as BexioTax[]) : [];
}

/**
 * Kontakt per Mail oder Name suchen (exakte Übereinstimmung) — für Kontakt-Matching
 * beim ersten Rechnungs-Push (Teil B3). Liefert nur den ersten Treffer.
 */
export async function findBexioContact(
  token: string,
  query: { email?: string | null; name?: string | null },
): Promise<BexioContact | null> {
  const field = query.email ? "mail" : "name_1";
  const value = query.email || query.name;
  if (!value) return null;

  const data = await bexioFetch(token, "/2.0/contact/search?limit=1", {
    method: "POST",
    body: JSON.stringify([{ field, value, criteria: "=" }]),
  });
  const list = Array.isArray(data) ? (data as BexioContact[]) : [];
  return list[0] ?? null;
}

export async function createBexioContact(
  token: string,
  input: { name: string; email: string | null },
): Promise<BexioContact> {
  const data = await bexioFetch(token, "/2.0/contact", {
    method: "POST",
    body: JSON.stringify({
      name_1: input.name,
      // 1 = Firma (Company) — Projekt-Kontakte in Bauflip sind praktisch immer Firmen/Haushalte,
      // nicht Einzelpersonen im Bexio-Sinn; für den Beleg reicht das.
      contact_type_id: 1,
      mail: input.email || undefined,
    }),
  });
  return data as BexioContact;
}

/**
 * kb_invoice erwartet einen internen Bexio-Benutzer (user_id) als "erstellt von" —
 * nicht unseren eigenen Nutzer. Ein PAT gehört zu genau einem Bexio-Konto; bei mehreren
 * hinterlegten Bexio-Benutzern wird der erste (i. d. R. der Kontoinhaber) verwendet.
 */
export async function getDefaultBexioUserId(token: string): Promise<number> {
  const data = await bexioFetch(token, "/3.0/users?limit=1&offset=0");
  const list = Array.isArray(data) ? (data as { id: number }[]) : [];
  const user = list[0];
  if (!user) throw new BexioApiError("Kein Bexio-Benutzer gefunden.", 500);
  return user.id;
}

/**
 * Bauflip-Rechnungspositionen haben keine Mengeneinheit — es wird die erste aktive
 * Bexio-Einheit verwendet (typischerweise "Stück"). Kein manuelles Mapping nötig.
 */
export async function getDefaultBexioUnitId(token: string): Promise<number> {
  const data = await bexioFetch(token, "/2.0/unit?limit=500");
  const list = Array.isArray(data) ? (data as { id: number; is_active?: boolean }[]) : [];
  const unit = list.find((u) => u.is_active !== false) ?? list[0];
  if (!unit) throw new BexioApiError("Keine Bexio-Einheit gefunden.", 500);
  return unit.id;
}

export type BexioInvoicePosition = {
  amount: string;
  unit_id: number;
  account_id: number;
  tax_id: number;
  text: string;
  unit_price: string;
  discount_in_percent: string;
};

export type CreateBexioInvoiceInput = {
  title: string;
  contact_id: number;
  user_id: number;
  /** 0 = Preise exkl. MwSt (unsere unit_price-Werte sind netto) — siehe Plan-Doku-Hinweis zur Live-Verifikation. */
  mwst_type: number;
  mwst_is_net: boolean;
  show_position_taxes: boolean;
  is_valid_from: string;
  is_valid_to: string | null;
  reference: string;
  api_reference: string;
  positions: BexioInvoicePosition[];
};

/** Legt den Beleg in Bexio an — kb_invoice, Modell A (Bauflip bleibt Rechnungssteller). */
export async function createBexioInvoice(
  token: string,
  input: CreateBexioInvoiceInput,
): Promise<{ id: number }> {
  const data = await bexioFetch(token, "/2.0/kb_invoice", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      positions: input.positions.map((p) => ({ type: "KbPositionCustom", ...p })),
    }),
  });
  return data as { id: number };
}
