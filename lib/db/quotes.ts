import "server-only";

import { cache } from "react";
import type { Quote, QuoteLineItem, QuoteStatus } from "@/lib/domain/types";
import {
  assertAllowedQuoteStatusTransition,
  projectStatusAfterQuoteStatusChange,
  quoteStatuses,
} from "@/lib/domain/types";
import { computeQuoteTotals, type QuoteLineItemInput } from "@/lib/quotes/totals";
import { updateProject } from "@/lib/db/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const QUOTE_DB_COLUMNS =
  "id, organization_id, project_id, quote_number, status, valid_until, intro_text, outro_text, vat_rate, total_net, total_gross, sent_at, sent_to_email, created_by, created_by_display_name, submitted_for_approval_at, approval_decided_at, approved_by, approved_by_display_name, approval_note, created_at, updated_at";

const QUOTE_LINE_ITEM_DB_COLUMNS =
  "id, quote_id, position, description, quantity, unit, unit_price, line_total";

function mapQuoteStatus(raw: unknown): QuoteStatus {
  return quoteStatuses.includes(raw as QuoteStatus) ? (raw as QuoteStatus) : "draft";
}

function mapQuoteRow(row: Record<string, unknown>): Quote {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? ""),
    projectId: String(row.project_id ?? ""),
    quoteNumber: row.quote_number != null ? String(row.quote_number) : null,
    status: mapQuoteStatus(row.status),
    validUntil: row.valid_until != null ? String(row.valid_until) : null,
    introText: row.intro_text != null ? String(row.intro_text) : null,
    outroText: row.outro_text != null ? String(row.outro_text) : null,
    vatRate: Number(row.vat_rate ?? 0),
    totalNet: Number(row.total_net ?? 0),
    totalGross: Number(row.total_gross ?? 0),
    sentAt: row.sent_at != null ? String(row.sent_at) : null,
    sentToEmail: row.sent_to_email != null ? String(row.sent_to_email) : null,
    createdByProfileId: row.created_by != null ? String(row.created_by) : null,
    createdByDisplayName:
      row.created_by_display_name != null && String(row.created_by_display_name).trim()
        ? String(row.created_by_display_name).trim()
        : null,
    submittedForApprovalAt: row.submitted_for_approval_at != null ? String(row.submitted_for_approval_at) : null,
    approvalDecidedAt: row.approval_decided_at != null ? String(row.approval_decided_at) : null,
    approvedByProfileId: row.approved_by != null ? String(row.approved_by) : null,
    approvedByDisplayName:
      row.approved_by_display_name != null && String(row.approved_by_display_name).trim()
        ? String(row.approved_by_display_name).trim()
        : null,
    approvalNote:
      row.approval_note != null && String(row.approval_note).trim() ? String(row.approval_note).trim() : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    lineItems: [],
  };
}

function mapQuoteLineItemRow(row: Record<string, unknown>): QuoteLineItem {
  return {
    id: String(row.id),
    quoteId: String(row.quote_id ?? ""),
    position: Number(row.position ?? 1),
    description: String(row.description ?? ""),
    quantity: Number(row.quantity ?? 1),
    unit: row.unit != null && String(row.unit).trim() ? String(row.unit).trim() : null,
    unitPrice: Number(row.unit_price ?? 0),
    lineTotal: Number(row.line_total ?? 0),
  };
}

function lineItemInsertRows(quoteId: string, lineItems: readonly QuoteLineItemInput[]) {
  const { lineTotals } = computeQuoteTotals(lineItems, 0);
  return lineItems.map((item, i) => ({
    quote_id: quoteId,
    position: i + 1,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit?.trim() || null,
    unit_price: item.unitPrice,
    line_total: lineTotals[i],
  }));
}

/** Offerten eines Projekts inkl. Positionen (neueste zuerst). */
export const listQuotesForProject = cache(async function listQuotesForProject(
  projectId: string,
): Promise<Quote[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("quotes")
    .select(QUOTE_DB_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error || !data || data.length === 0) return [];

  const quotes = (data as Record<string, unknown>[]).map(mapQuoteRow);
  const { data: items } = await supabase
    .from("quote_line_items")
    .select(QUOTE_LINE_ITEM_DB_COLUMNS)
    .in(
      "quote_id",
      quotes.map((q) => q.id),
    )
    .order("position", { ascending: true });

  const byQuoteId = new Map<string, QuoteLineItem[]>();
  for (const row of (items ?? []) as Record<string, unknown>[]) {
    const item = mapQuoteLineItemRow(row);
    const list = byQuoteId.get(item.quoteId);
    if (list) list.push(item);
    else byQuoteId.set(item.quoteId, [item]);
  }
  return quotes.map((q) => ({ ...q, lineItems: byQuoteId.get(q.id) ?? [] }));
});

/** Einzelne Offerte inkl. Positionen (PDF, Detail). */
export const getQuoteWithItems = cache(async function getQuoteWithItems(
  quoteId: string,
): Promise<Quote | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("quotes")
    .select(QUOTE_DB_COLUMNS)
    .eq("id", quoteId)
    .maybeSingle();
  if (error || !data) return null;

  const { data: items } = await supabase
    .from("quote_line_items")
    .select(QUOTE_LINE_ITEM_DB_COLUMNS)
    .eq("quote_id", quoteId)
    .order("position", { ascending: true });

  return {
    ...mapQuoteRow(data as Record<string, unknown>),
    lineItems: ((items ?? []) as Record<string, unknown>[]).map(mapQuoteLineItemRow),
  };
});

/** Schlanke Projekt-Kopfdaten für das Offerten-PDF (Adressblock). */
export type QuotePdfProjectHead = {
  title: string;
  referenceCode: string | null;
  tenantName: string | null;
  managementName: string | null;
  serviceStreet: string | null;
  servicePostalCode: string | null;
  serviceCity: string | null;
};

export const getQuotePdfProjectHead = cache(async function getQuotePdfProjectHead(
  projectId: string,
): Promise<QuotePdfProjectHead | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("title, reference_code, tenant_name, management_name, service_street, service_postal_code, service_city")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const s = (v: unknown) => (v != null && String(v).trim() ? String(v).trim() : null);
  return {
    title: String(row.title ?? ""),
    referenceCode: s(row.reference_code),
    tenantName: s(row.tenant_name),
    managementName: s(row.management_name),
    serviceStreet: s(row.service_street),
    servicePostalCode: s(row.service_postal_code),
    serviceCity: s(row.service_city),
  };
});

export type QuoteCreateInput = {
  projectId: string;
  validUntil: string | null;
  introText: string | null;
  outroText: string | null;
  vatRate: number;
  lineItems: QuoteLineItemInput[];
};

export async function createQuote(
  input: QuoteCreateInput,
  options: { createdByProfileId: string | null },
): Promise<Quote> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  // Org vom Projekt übernehmen (RLS stellt Sichtbarkeit sicher) — nicht
  // current_organization_id(), damit Mehrfach-Org-Mitglieder korrekt scopen.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  const organizationId = (project as { organization_id?: string | null } | null)?.organization_id;
  if (!organizationId) throw new Error("Projekt nicht gefunden oder ohne Organisation.");

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

  const { totalNet, totalGross } = computeQuoteTotals(input.lineItems, input.vatRate);

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      organization_id: organizationId,
      project_id: input.projectId,
      valid_until: input.validUntil,
      intro_text: input.introText,
      outro_text: input.outroText,
      vat_rate: input.vatRate,
      total_net: totalNet,
      total_gross: totalGross,
      created_by: options.createdByProfileId,
      created_by_display_name: createdByDisplayName,
    })
    .select(QUOTE_DB_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Offerte konnte nicht gespeichert werden.");
  }

  const quote = mapQuoteRow(data as Record<string, unknown>);
  const { data: items, error: itemsError } = await supabase
    .from("quote_line_items")
    .insert(lineItemInsertRows(quote.id, input.lineItems))
    .select(QUOTE_LINE_ITEM_DB_COLUMNS);
  if (itemsError) {
    // Best-effort-Aufräumen, damit keine leere Offerte zurückbleibt.
    await supabase.from("quotes").delete().eq("id", quote.id);
    throw new Error(itemsError.message ?? "Positionen konnten nicht gespeichert werden.");
  }

  return {
    ...quote,
    lineItems: ((items ?? []) as Record<string, unknown>[])
      .map(mapQuoteLineItemRow)
      .sort((a, b) => a.position - b.position),
  };
}

export type QuoteUpdateInput = Omit<QuoteCreateInput, "projectId">;

/** Inhaltliche Änderung nur im Entwurf — versendete/entschiedene Offerten sind fixiert. */
export async function updateQuote(quoteId: string, input: QuoteUpdateInput): Promise<Quote> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data: existing, error: existingError } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("id", quoteId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Offerte nicht gefunden.");
  if (mapQuoteStatus((existing as { status?: string }).status) !== "draft") {
    throw new Error("Nur Entwürfe können bearbeitet werden.");
  }

  const { totalNet, totalGross } = computeQuoteTotals(input.lineItems, input.vatRate);

  const { data, error } = await supabase
    .from("quotes")
    .update({
      valid_until: input.validUntil,
      intro_text: input.introText,
      outro_text: input.outroText,
      vat_rate: input.vatRate,
      total_net: totalNet,
      total_gross: totalGross,
    })
    .eq("id", quoteId)
    .select(QUOTE_DB_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Offerte konnte nicht gespeichert werden.");

  const { error: deleteError } = await supabase
    .from("quote_line_items")
    .delete()
    .eq("quote_id", quoteId);
  if (deleteError) throw new Error(deleteError.message);

  const { data: items, error: itemsError } = await supabase
    .from("quote_line_items")
    .insert(lineItemInsertRows(quoteId, input.lineItems))
    .select(QUOTE_LINE_ITEM_DB_COLUMNS);
  if (itemsError) throw new Error(itemsError.message ?? "Positionen konnten nicht gespeichert werden.");

  return {
    ...mapQuoteRow(data as Record<string, unknown>),
    lineItems: ((items ?? []) as Record<string, unknown>[])
      .map(mapQuoteLineItemRow)
      .sort((a, b) => a.position - b.position),
  };
}

/** Löschen nur für Entwürfe und abgelehnte Offerten — Versendetes/Angenommenes bleibt nachvollziehbar. */
export async function deleteQuote(quoteId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const { data: existing, error: existingError } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("id", quoteId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) return;
  const status = mapQuoteStatus((existing as { status?: string }).status);
  if (status === "sent" || status === "approved") {
    throw new Error("Versendete oder angenommene Offerten können nicht gelöscht werden.");
  }

  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
  if (error) throw new Error(error.message);
}

/**
 * Offerten-Status setzen; koppelt den Projekt-Status
 * (sent → offerte_gesendet, approved → offerte_genehmigt).
 */
export async function setQuoteStatus(
  quoteId: string,
  projectId: string,
  status: QuoteStatus,
  opts?: {
    sentToEmail?: string;
    /** Admin, der freigibt (→ sent) oder zurückweist (→ draft mit approvalNote). */
    approvedByProfileId?: string | null;
    approvedByDisplayName?: string | null;
    /** Nur bei Zurückweisung (→ draft) gesetzt; grenzt vom normalen Kunden-Zurück-in-Entwurf ab. */
    approvalNote?: string | null;
  },
): Promise<Quote> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  // Übergang serverseitig validieren — die UI-Buttons sind nur Komfort.
  const { data: existing, error: existingError } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("id", quoteId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Offerte nicht gefunden.");
  assertAllowedQuoteStatusTransition(
    mapQuoteStatus((existing as { status?: string }).status),
    status,
  );

  const patch: Record<string, unknown> = { status };
  if (status === "pending_approval") {
    patch.submitted_for_approval_at = new Date().toISOString();
    // Frischer Freigabe-Durchlauf — alten Entscheid/Kommentar aus einer früheren
    // Zurückweisung nicht stehen lassen.
    patch.approval_decided_at = null;
    patch.approved_by = null;
    patch.approved_by_display_name = null;
    patch.approval_note = null;
  }
  if (status === "sent") {
    patch.sent_at = new Date().toISOString();
    if (opts?.sentToEmail) {
      patch.sent_to_email = opts.sentToEmail;
    }
    // Erreichen von "sent" bedeutet immer: ein Admin hat soeben freigegeben.
    patch.approval_decided_at = new Date().toISOString();
    if (opts?.approvedByProfileId) patch.approved_by = opts.approvedByProfileId;
    if (opts?.approvedByDisplayName) patch.approved_by_display_name = opts.approvedByDisplayName;
  }
  if (status === "draft" && opts?.approvalNote !== undefined) {
    // Interne Zurückweisung (Admin → Büro) — nicht zu verwechseln mit der
    // Kunden-Ablehnung (sent → rejected → draft), die opts nicht setzt.
    patch.approval_decided_at = new Date().toISOString();
    patch.approval_note = opts.approvalNote ?? null;
    if (opts?.approvedByProfileId) patch.approved_by = opts.approvedByProfileId;
    if (opts?.approvedByDisplayName) patch.approved_by_display_name = opts.approvedByDisplayName;
  }
  if (status === "approved" || status === "rejected") {
    patch.decided_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("quotes")
    .update(patch)
    .eq("id", quoteId)
    .eq("project_id", projectId)
    .select(QUOTE_DB_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Status konnte nicht gesetzt werden.");

  const nextProjectStatus = projectStatusAfterQuoteStatusChange(status);
  if (nextProjectStatus) {
    await updateProject(projectId, { status: nextProjectStatus, statusUpdateSource: "manual" });
  }

  const { data: items } = await supabase
    .from("quote_line_items")
    .select(QUOTE_LINE_ITEM_DB_COLUMNS)
    .eq("quote_id", quoteId)
    .order("position", { ascending: true });

  return {
    ...mapQuoteRow(data as Record<string, unknown>),
    lineItems: ((items ?? []) as Record<string, unknown>[]).map(mapQuoteLineItemRow),
  };
}
