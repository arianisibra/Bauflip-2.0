import "server-only";

import { cache } from "react";
import type { Invoice, InvoiceLineItem, InvoiceReferenceType, InvoiceStatus } from "@/lib/domain/types";
import {
  assertAllowedInvoiceStatusTransition,
  invoiceReferenceTypes,
  invoiceStatuses,
} from "@/lib/domain/types";
import { computeQuoteTotals, type QuoteLineItemInput } from "@/lib/quotes/totals";
import { getOrganizationBillingSettings } from "@/lib/db/billing";
import { getQuoteWithItems } from "@/lib/db/quotes";
import { buildQrrReference, buildScorReference, chooseReferenceType } from "@/lib/qr-bill/reference";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INVOICE_DB_COLUMNS =
  "id, organization_id, project_id, quote_id, invoice_number, status, due_date, intro_text, vat_rate, discount_percent, total_net, total_gross, reference_type, payment_reference, sent_at, sent_to_email, paid_at, created_by, created_by_display_name, created_at, updated_at, bexio_invoice_id, bexio_synced_at, bexio_sync_error";

const INVOICE_LINE_ITEM_DB_COLUMNS =
  "id, invoice_id, position, description, quantity, unit, unit_price, line_total";

function mapInvoiceStatus(raw: unknown): InvoiceStatus {
  return invoiceStatuses.includes(raw as InvoiceStatus) ? (raw as InvoiceStatus) : "draft";
}

function mapReferenceType(raw: unknown): InvoiceReferenceType {
  return invoiceReferenceTypes.includes(raw as InvoiceReferenceType)
    ? (raw as InvoiceReferenceType)
    : "NON";
}

function mapInvoiceRow(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? ""),
    projectId: String(row.project_id ?? ""),
    quoteId: row.quote_id != null ? String(row.quote_id) : null,
    invoiceNumber: row.invoice_number != null ? String(row.invoice_number) : null,
    status: mapInvoiceStatus(row.status),
    dueDate: row.due_date != null ? String(row.due_date) : null,
    introText: row.intro_text != null ? String(row.intro_text) : null,
    vatRate: Number(row.vat_rate ?? 0),
    discountPercent: Number(row.discount_percent ?? 0),
    totalNet: Number(row.total_net ?? 0),
    totalGross: Number(row.total_gross ?? 0),
    referenceType: mapReferenceType(row.reference_type),
    paymentReference: row.payment_reference != null ? String(row.payment_reference) : null,
    sentAt: row.sent_at != null ? String(row.sent_at) : null,
    sentToEmail: row.sent_to_email != null ? String(row.sent_to_email) : null,
    paidAt: row.paid_at != null ? String(row.paid_at) : null,
    createdByProfileId: row.created_by != null ? String(row.created_by) : null,
    createdByDisplayName:
      row.created_by_display_name != null && String(row.created_by_display_name).trim()
        ? String(row.created_by_display_name).trim()
        : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    lineItems: [],
    bexioInvoiceId: row.bexio_invoice_id != null ? Number(row.bexio_invoice_id) : null,
    bexioSyncedAt: row.bexio_synced_at != null ? String(row.bexio_synced_at) : null,
    bexioSyncError: row.bexio_sync_error != null ? String(row.bexio_sync_error) : null,
  };
}

function mapInvoiceLineItemRow(row: Record<string, unknown>): InvoiceLineItem {
  return {
    id: String(row.id),
    invoiceId: String(row.invoice_id ?? ""),
    position: Number(row.position ?? 1),
    description: String(row.description ?? ""),
    quantity: Number(row.quantity ?? 1),
    unit: row.unit != null && String(row.unit).trim() ? String(row.unit).trim() : null,
    unitPrice: Number(row.unit_price ?? 0),
    lineTotal: Number(row.line_total ?? 0),
  };
}

function lineItemInsertRows(invoiceId: string, lineItems: readonly QuoteLineItemInput[]) {
  const { lineTotals } = computeQuoteTotals(lineItems, 0);
  return lineItems.map((item, i) => ({
    invoice_id: invoiceId,
    position: i + 1,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit?.trim() || null,
    unit_price: item.unitPrice,
    line_total: lineTotals[i],
  }));
}

/**
 * Referenz aus Rechnungsnummer «RE-JJJJ-NNNN» ableiten.
 * QRR: Jahr+Sequenz numerisch; SCOR: Nummer ohne Bindestriche.
 */
function paymentReferenceForInvoiceNumber(
  referenceType: InvoiceReferenceType,
  invoiceNumber: string,
): string | null {
  if (referenceType === "NON") return null;
  if (referenceType === "SCOR") return buildScorReference(invoiceNumber);
  const match = invoiceNumber.match(/^RE-(\d{4})-(\d+)$/);
  if (!match) throw new Error(`Unerwartetes Rechnungsnummern-Format: ${invoiceNumber}`);
  return buildQrrReference(Number(match[1]), Number(match[2]));
}

/** Rechnungen eines Projekts inkl. Positionen (neueste zuerst). */
export const listInvoicesForProject = cache(async function listInvoicesForProject(
  projectId: string,
): Promise<Invoice[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_DB_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error || !data || data.length === 0) return [];

  const invoices = (data as Record<string, unknown>[]).map(mapInvoiceRow);
  const { data: items } = await supabase
    .from("invoice_line_items")
    .select(INVOICE_LINE_ITEM_DB_COLUMNS)
    .in(
      "invoice_id",
      invoices.map((i) => i.id),
    )
    .order("position", { ascending: true });

  const byInvoiceId = new Map<string, InvoiceLineItem[]>();
  for (const row of (items ?? []) as Record<string, unknown>[]) {
    const item = mapInvoiceLineItemRow(row);
    const list = byInvoiceId.get(item.invoiceId);
    if (list) list.push(item);
    else byInvoiceId.set(item.invoiceId, [item]);
  }
  return invoices.map((i) => ({ ...i, lineItems: byInvoiceId.get(i.id) ?? [] }));
});

/** Einzelne Rechnung inkl. Positionen (PDF, Versand). */
export const getInvoiceWithItems = cache(async function getInvoiceWithItems(
  invoiceId: string,
): Promise<Invoice | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_DB_COLUMNS)
    .eq("id", invoiceId)
    .maybeSingle();
  if (error || !data) return null;

  const { data: items } = await supabase
    .from("invoice_line_items")
    .select(INVOICE_LINE_ITEM_DB_COLUMNS)
    .eq("invoice_id", invoiceId)
    .order("position", { ascending: true });

  return {
    ...mapInvoiceRow(data as Record<string, unknown>),
    lineItems: ((items ?? []) as Record<string, unknown>[]).map(mapInvoiceLineItemRow),
  };
});

export type InvoiceCreateInput = {
  projectId: string;
  /** Herkunfts-Offerte — Positionen werden kopiert, lineItems ignoriert. */
  fromQuoteId?: string | null;
  dueDate: string | null;
  introText: string | null;
  vatRate: number;
  discountPercent: number;
  lineItems: QuoteLineItemInput[];
};

export async function createInvoice(
  input: InvoiceCreateInput,
  options: { createdByProfileId: string | null },
): Promise<Invoice> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  // Org vom Projekt (RLS sichert Sichtbarkeit) — Muster createQuote.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  const organizationId = (project as { organization_id?: string | null } | null)?.organization_id;
  if (!organizationId) throw new Error("Projekt nicht gefunden oder ohne Organisation.");

  // Positionen + Konditionen aus Offerte übernehmen, falls angegeben.
  let lineItems = input.lineItems;
  let vatRate = input.vatRate;
  let discountPercent = input.discountPercent;
  let quoteId: string | null = null;
  if (input.fromQuoteId) {
    const quote = await getQuoteWithItems(input.fromQuoteId);
    if (!quote || quote.projectId !== input.projectId) {
      throw new Error("Offerte nicht gefunden.");
    }
    if (quote.status !== "approved") {
      throw new Error("Nur angenommene Offerten können in eine Rechnung übernommen werden.");
    }
    lineItems = quote.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
    }));
    vatRate = quote.vatRate;
    discountPercent = quote.discountPercent;
    quoteId = quote.id;
  }
  if (lineItems.length === 0) {
    throw new Error("Mindestens eine Position erfassen.");
  }

  let createdByDisplayName: string | null = null;
  if (options.createdByProfileId) {
    const { data: authorProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", options.createdByProfileId)
      .maybeSingle();
    const rawName = (authorProfile as { display_name?: string | null } | null)?.display_name;
    createdByDisplayName = typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;
  }

  // Referenztyp aus aktueller Org-IBAN — wird auf der Rechnung eingefroren.
  const billing = await getOrganizationBillingSettings(organizationId);
  const referenceType = chooseReferenceType(billing?.iban ?? null);

  const { totalNet, totalGross } = computeQuoteTotals(lineItems, vatRate, discountPercent);

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      organization_id: organizationId,
      project_id: input.projectId,
      quote_id: quoteId,
      due_date: input.dueDate,
      intro_text: input.introText,
      vat_rate: vatRate,
      discount_percent: discountPercent,
      total_net: totalNet,
      total_gross: totalGross,
      reference_type: referenceType,
      created_by: options.createdByProfileId,
      created_by_display_name: createdByDisplayName,
    })
    .select(INVOICE_DB_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Rechnung konnte nicht gespeichert werden.");
  }

  const invoice = mapInvoiceRow(data as Record<string, unknown>);

  // Referenz aus der vom Trigger vergebenen Nummer ableiten und einfrieren.
  let paymentReference: string | null = null;
  if (invoice.invoiceNumber && referenceType !== "NON") {
    paymentReference = paymentReferenceForInvoiceNumber(referenceType, invoice.invoiceNumber);
    const { error: refError } = await supabase
      .from("invoices")
      .update({ payment_reference: paymentReference })
      .eq("id", invoice.id);
    if (refError) {
      await supabase.from("invoices").delete().eq("id", invoice.id);
      throw new Error(refError.message);
    }
  }

  const { data: items, error: itemsError } = await supabase
    .from("invoice_line_items")
    .insert(lineItemInsertRows(invoice.id, lineItems))
    .select(INVOICE_LINE_ITEM_DB_COLUMNS);
  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    throw new Error(itemsError.message ?? "Positionen konnten nicht gespeichert werden.");
  }

  return {
    ...invoice,
    paymentReference,
    lineItems: ((items ?? []) as Record<string, unknown>[])
      .map(mapInvoiceLineItemRow)
      .sort((a, b) => a.position - b.position),
  };
}

export type InvoiceForPaymentMatching = {
  id: string;
  projectId: string;
  projectTitle: string;
  invoiceNumber: string | null;
  paymentReference: string | null;
  totalGross: number;
  status: InvoiceStatus;
};

/**
 * Rechnungen mit Referenz für den Zahlungsabgleich (Status `sent` **und** `paid`) —
 * `paid` wird gebraucht, damit ein erneuter Import derselben Zahlung als
 * "bereits erfasst" statt "unbekannt" erkannt wird (macht Re-Imports harmlos).
 */
export const listInvoicesForPaymentMatching = cache(async function listInvoicesForPaymentMatching(
  organizationId: string,
): Promise<InvoiceForPaymentMatching[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("invoices")
    .select("id, project_id, invoice_number, payment_reference, total_gross, status")
    .eq("organization_id", organizationId)
    .in("status", ["sent", "paid"])
    .not("payment_reference", "is", null);
  if (error || !data || data.length === 0) return [];

  const rows = data as Record<string, unknown>[];
  const projectIds = [...new Set(rows.map((r) => String(r.project_id)))];
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .in("id", projectIds);
  const titleById = new Map(
    ((projects ?? []) as { id: string; title: string | null }[]).map((p) => [p.id, p.title ?? ""]),
  );

  return rows.map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    projectTitle: titleById.get(String(row.project_id)) ?? "",
    invoiceNumber: row.invoice_number != null ? String(row.invoice_number) : null,
    paymentReference: row.payment_reference != null ? String(row.payment_reference) : null,
    totalGross: Number(row.total_gross ?? 0),
    status: mapInvoiceStatus(row.status),
  }));
});

export type InvoiceUpdateInput = {
  dueDate: string | null;
  introText: string | null;
  vatRate: number;
  discountPercent: number;
  lineItems: QuoteLineItemInput[];
};

/** Inhaltliche Änderung nur im Entwurf — versendete/entschiedene Rechnungen sind fixiert. */
export async function updateInvoice(invoiceId: string, input: InvoiceUpdateInput): Promise<Invoice> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data: existing, error: existingError } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Rechnung nicht gefunden.");
  if (mapInvoiceStatus((existing as { status?: string }).status) !== "draft") {
    throw new Error("Nur Entwürfe können bearbeitet werden.");
  }

  const { totalNet, totalGross } = computeQuoteTotals(input.lineItems, input.vatRate, input.discountPercent);

  const { data, error } = await supabase
    .from("invoices")
    .update({
      due_date: input.dueDate,
      intro_text: input.introText,
      vat_rate: input.vatRate,
      discount_percent: input.discountPercent,
      total_net: totalNet,
      total_gross: totalGross,
    })
    .eq("id", invoiceId)
    .select(INVOICE_DB_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Rechnung konnte nicht gespeichert werden.");

  const { error: deleteError } = await supabase
    .from("invoice_line_items")
    .delete()
    .eq("invoice_id", invoiceId);
  if (deleteError) throw new Error(deleteError.message);

  const { data: items, error: itemsError } = await supabase
    .from("invoice_line_items")
    .insert(lineItemInsertRows(invoiceId, input.lineItems))
    .select(INVOICE_LINE_ITEM_DB_COLUMNS);
  if (itemsError) throw new Error(itemsError.message ?? "Positionen konnten nicht gespeichert werden.");

  return {
    ...mapInvoiceRow(data as Record<string, unknown>),
    lineItems: ((items ?? []) as Record<string, unknown>[])
      .map(mapInvoiceLineItemRow)
      .sort((a, b) => a.position - b.position),
  };
}

/** Löschen nur für Entwürfe — Versendetes bleibt nachvollziehbar (stornieren statt löschen). */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data: existing, error: existingError } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) return;
  if (mapInvoiceStatus((existing as { status?: string }).status) !== "draft") {
    throw new Error("Nur Entwürfe können gelöscht werden — versendete Rechnungen stornieren.");
  }

  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) throw new Error(error.message);
}

/**
 * Rechnungs-Status setzen (Matrix serverseitig validiert); setzt sent_at/paid_at.
 * `paidAt` überschreibt das Bezahlt-Datum (z. B. Valuta-Datum aus einem camt-Import) —
 * ohne Angabe wird "jetzt" verwendet.
 */
export async function setInvoiceStatus(
  invoiceId: string,
  projectId: string,
  status: InvoiceStatus,
  opts?: { sentToEmail?: string; paidAt?: string },
): Promise<Invoice> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data: existing, error: existingError } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", invoiceId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Rechnung nicht gefunden.");
  assertAllowedInvoiceStatusTransition(
    mapInvoiceStatus((existing as { status?: string }).status),
    status,
  );

  const patch: Record<string, unknown> = { status };
  if (status === "sent") {
    patch.sent_at = new Date().toISOString();
    if (opts?.sentToEmail) {
      patch.sent_to_email = opts.sentToEmail;
    }
  }
  if (status === "paid") {
    patch.paid_at = opts?.paidAt ?? new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", invoiceId)
    .eq("project_id", projectId)
    .select(INVOICE_DB_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Status konnte nicht gesetzt werden.");

  const { data: items } = await supabase
    .from("invoice_line_items")
    .select(INVOICE_LINE_ITEM_DB_COLUMNS)
    .eq("invoice_id", invoiceId)
    .order("position", { ascending: true });

  return {
    ...mapInvoiceRow(data as Record<string, unknown>),
    lineItems: ((items ?? []) as Record<string, unknown>[]).map(mapInvoiceLineItemRow),
  };
}

/** Bexio-Push-Status setzen (Teil B) — Erfolg löscht einen evtl. vorherigen Fehler. */
export async function updateInvoiceBexioSync(
  invoiceId: string,
  result: { bexioInvoiceId: number; bexioSyncedAt: string } | { bexioSyncError: string },
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const patch =
    "bexioSyncError" in result
      ? { bexio_sync_error: result.bexioSyncError }
      : {
          bexio_invoice_id: result.bexioInvoiceId,
          bexio_synced_at: result.bexioSyncedAt,
          bexio_sync_error: null,
        };

  const { error } = await supabase.from("invoices").update(patch).eq("id", invoiceId);
  if (error) throw new Error(error.message);
}

/** Minimaldaten für den Bexio-Kontakt-Abgleich (Teil B) — Titel als Kontaktname. */
export const getProjectForBexio = cache(async function getProjectForBexio(
  projectId: string,
): Promise<{ id: string; title: string; bexioContactId: number | null } | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("id, title, bexio_contact_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    title: row.title != null ? String(row.title) : "Kunde",
    bexioContactId: row.bexio_contact_id != null ? Number(row.bexio_contact_id) : null,
  };
});
