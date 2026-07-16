import "server-only";

import type { Contact, ContactKind } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CONTACT_DB_COLUMNS =
  "id, organization_id, kind, display_name, company_name, email, phone, mobile, street, postal_code, city, country, notes, kunden_nummer, bexio_contact_id, is_active, created_at";

function cleanText(value: unknown): string | null {
  return value != null && String(value).trim() ? String(value).trim() : null;
}

function mapContactRow(row: Record<string, unknown>): Contact {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? ""),
    kind: (row.kind as ContactKind) ?? "privat",
    displayName: String(row.display_name ?? ""),
    companyName: cleanText(row.company_name),
    email: cleanText(row.email),
    phone: cleanText(row.phone),
    mobile: cleanText(row.mobile),
    street: cleanText(row.street),
    postalCode: cleanText(row.postal_code),
    city: cleanText(row.city),
    country: cleanText(row.country),
    notes: cleanText(row.notes),
    kundenNummer: cleanText(row.kunden_nummer),
    bexioContactId: row.bexio_contact_id != null ? Number(row.bexio_contact_id) : null,
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at ?? ""),
  };
}

export type ContactWriteInput = {
  kind: ContactKind;
  displayName: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  kundenNummer?: string | null;
};

function toRow(input: ContactWriteInput): Record<string, unknown> {
  return {
    kind: input.kind,
    display_name: input.displayName.trim(),
    company_name: input.companyName?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    mobile: input.mobile?.trim() || null,
    street: input.street?.trim() || null,
    postal_code: input.postalCode?.trim() || null,
    city: input.city?.trim() || null,
    country: input.country?.trim() || null,
    notes: input.notes?.trim() || null,
    kunden_nummer: input.kundenNummer?.trim() || null,
  };
}

/** Alle Kontakte der Organisation (Verzeichnis: inkl. inaktive), optional nach Suchtext. */
export async function listContactsForOrg(
  organizationId: string,
  opts?: { query?: string; kind?: ContactKind; activeOnly?: boolean; limit?: number },
): Promise<Contact[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  let q = supabase
    .from("contacts")
    .select(CONTACT_DB_COLUMNS)
    .eq("organization_id", organizationId);

  if (opts?.activeOnly) q = q.eq("is_active", true);
  if (opts?.kind) q = q.eq("kind", opts.kind);

  const search = opts?.query?.trim();
  if (search) {
    const like = `%${search.replace(/[%_]/g, "")}%`;
    q = q.or(`display_name.ilike.${like},company_name.ilike.${like}`);
  }

  q = q.order("display_name", { ascending: true }).limit(opts?.limit ?? 500);

  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapContactRow);
}

export async function getContactById(contactId: string): Promise<Contact | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("contacts")
    .select(CONTACT_DB_COLUMNS)
    .eq("id", contactId)
    .maybeSingle();
  if (error || !data) return null;
  return mapContactRow(data as Record<string, unknown>);
}

export async function createContact(
  organizationId: string,
  input: ContactWriteInput,
  createdBy: string,
): Promise<Contact> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data, error } = await supabase
    .from("contacts")
    .insert({ organization_id: organizationId, created_by: createdBy, ...toRow(input) })
    .select(CONTACT_DB_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Kontakt konnte nicht gespeichert werden.");
  }
  return mapContactRow(data as Record<string, unknown>);
}

export async function updateContact(contactId: string, input: ContactWriteInput): Promise<Contact> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data, error } = await supabase
    .from("contacts")
    .update(toRow(input))
    .eq("id", contactId)
    .select(CONTACT_DB_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kontakt nicht gefunden.");
  return mapContactRow(data as Record<string, unknown>);
}

export async function deleteContact(contactId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");
  const { error } = await supabase.from("contacts").delete().eq("id", contactId);
  if (error) throw new Error(error.message);
}
