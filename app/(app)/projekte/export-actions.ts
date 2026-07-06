"use server";

import { requireOfficeSession } from "@/lib/auth/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Zeile im Abrechnungs-Export: Projekte im Status «abrechnen» + Rapportzeit + Offerte. */
export type AbrechnungExportRow = {
  referenceCode: string | null;
  title: string;
  tenantName: string | null;
  tenantPhone: string | null;
  tenantEmail: string | null;
  address: string;
  createdAt: string;
  /** Summe `time_spent_minutes` aller Rapporte des Projekts. */
  reportMinutes: number;
  approvedQuoteNumber: string | null;
  approvedQuoteGross: number | null;
};

export async function fetchAbrechnungExportAction(): Promise<AbrechnungExportRow[]> {
  await requireOfficeSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  // RLS begrenzt auf die eigene Organisation.
  const { data: projects, error } = await supabase
    .from("projects")
    .select(
      "id, reference_code, title, tenant_name, tenant_phone, tenant_email, service_street, service_postal_code, service_city, created_at",
    )
    .eq("status", "abrechnen")
    .order("created_at", { ascending: true });
  if (error || !projects || projects.length === 0) return [];

  const projectIds = projects.map((p) => String((p as Record<string, unknown>).id));

  const [reportsRes, quotesRes] = await Promise.all([
    supabase
      .from("technician_reports")
      .select("project_id, time_spent_minutes")
      .in("project_id", projectIds),
    supabase
      .from("quotes")
      .select("project_id, quote_number, total_gross, created_at")
      .in("project_id", projectIds)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
  ]);

  const minutesByProject = new Map<string, number>();
  for (const row of (reportsRes.data ?? []) as Record<string, unknown>[]) {
    const pid = String(row.project_id);
    const minutes = row.time_spent_minutes != null ? Number(row.time_spent_minutes) : 0;
    minutesByProject.set(pid, (minutesByProject.get(pid) ?? 0) + minutes);
  }

  // Neueste angenommene Offerte pro Projekt (Liste ist absteigend sortiert).
  const quoteByProject = new Map<string, { number: string | null; gross: number }>();
  for (const row of (quotesRes.data ?? []) as Record<string, unknown>[]) {
    const pid = String(row.project_id);
    if (quoteByProject.has(pid)) continue;
    quoteByProject.set(pid, {
      number: row.quote_number != null ? String(row.quote_number) : null,
      gross: Number(row.total_gross ?? 0),
    });
  }

  return projects.map((raw) => {
    const p = raw as Record<string, unknown>;
    const pid = String(p.id);
    const s = (v: unknown) => (v != null && String(v).trim() ? String(v).trim() : null);
    const address = [
      s(p.service_street),
      [s(p.service_postal_code), s(p.service_city)].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ");
    const quote = quoteByProject.get(pid);
    return {
      referenceCode: s(p.reference_code),
      title: String(p.title ?? ""),
      tenantName: s(p.tenant_name),
      tenantPhone: s(p.tenant_phone),
      tenantEmail: s(p.tenant_email),
      address,
      createdAt: String(p.created_at ?? ""),
      reportMinutes: minutesByProject.get(pid) ?? 0,
      approvedQuoteNumber: quote?.number ?? null,
      approvedQuoteGross: quote?.gross ?? null,
    };
  });
}
