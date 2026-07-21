import "server-only";

import { cache } from "react";
import type { ProjectStatus, QuoteStatus } from "@/lib/domain/types";
import { projectStatuses, quoteStatuses } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DAY_MS = 86_400_000;

/** Alters-Buckets für offene Projekte (Tage seit `created_at`). */
export const PROJECT_AGE_BUCKETS = ["0-7", "8-30", "31-90", "90+"] as const;
export type ProjectAgeBucket = (typeof PROJECT_AGE_BUCKETS)[number];

function ageBucketForDays(days: number): ProjectAgeBucket {
  if (days <= 7) return "0-7";
  if (days <= 30) return "8-30";
  if (days <= 90) return "31-90";
  return "90+";
}

export type ProjectAgeSummary = {
  byBucket: Record<ProjectAgeBucket, number>;
  totalOpen: number;
};

/** Offene Projekte (Status ≠ abgeschlossen) nach Alter seit Erstellung. */
export const getProjectAgeSummary = cache(async function getProjectAgeSummary(
  organizationId: string,
): Promise<ProjectAgeSummary> {
  const empty: ProjectAgeSummary = {
    byBucket: { "0-7": 0, "8-30": 0, "31-90": 0, "90+": 0 },
    totalOpen: 0,
  };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from("projects")
    .select("created_at")
    .eq("organization_id", organizationId)
    .neq("status", "abgeschlossen");
  if (error || !data) return empty;

  const now = Date.now();
  const byBucket = { ...empty.byBucket };
  for (const row of data as { created_at: string }[]) {
    const created = Date.parse(row.created_at);
    if (!Number.isFinite(created)) continue;
    const days = Math.floor((now - created) / DAY_MS);
    byBucket[ageBucketForDays(days)] += 1;
  }
  return { byBucket, totalOpen: data.length };
});

/** Ø Durchlaufzeit (Tage, `created_at` → `closed_at`) für kürzlich abgeschlossene Projekte. */
export const getAverageCycleTimeDays = cache(async function getAverageCycleTimeDays(
  organizationId: string,
  sinceDays = 90,
): Promise<{ averageDays: number | null; sampleSize: number }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { averageDays: null, sampleSize: 0 };

  const sinceIso = new Date(Date.now() - sinceDays * DAY_MS).toISOString();
  const { data, error } = await supabase
    .from("projects")
    .select("created_at, closed_at")
    .eq("organization_id", organizationId)
    .eq("status", "abgeschlossen")
    .not("closed_at", "is", null)
    .gte("closed_at", sinceIso);
  if (error || !data || data.length === 0) return { averageDays: null, sampleSize: 0 };

  const rows = data as { created_at: string; closed_at: string }[];
  const totalDays = rows.reduce((sum, r) => {
    const created = Date.parse(r.created_at);
    const closed = Date.parse(r.closed_at);
    if (!Number.isFinite(created) || !Number.isFinite(closed)) return sum;
    return sum + Math.max(0, (closed - created) / DAY_MS);
  }, 0);

  return { averageDays: Math.round((totalDays / rows.length) * 10) / 10, sampleSize: rows.length };
});

export type QuotePipelineSummary = {
  countByStatus: Record<QuoteStatus, number>;
  valueByStatus: Record<QuoteStatus, number>;
  /** approved / (approved + rejected), null wenn keine Entscheidung vorliegt. */
  conversionRate: number | null;
};

/** Offerten-Pipeline: Anzahl + Wert je Status, Annahmequote. */
export const getQuotePipelineSummary = cache(async function getQuotePipelineSummary(
  organizationId: string,
): Promise<QuotePipelineSummary> {
  const countByStatus = Object.fromEntries(quoteStatuses.map((s) => [s, 0])) as Record<
    QuoteStatus,
    number
  >;
  const valueByStatus = Object.fromEntries(quoteStatuses.map((s) => [s, 0])) as Record<
    QuoteStatus,
    number
  >;
  const empty: QuotePipelineSummary = { countByStatus, valueByStatus, conversionRate: null };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from("quotes")
    .select("status, total_gross")
    .eq("organization_id", organizationId);
  if (error || !data) return empty;

  for (const row of data as { status: string; total_gross: number | null }[]) {
    if (!quoteStatuses.includes(row.status as QuoteStatus)) continue;
    const status = row.status as QuoteStatus;
    countByStatus[status] += 1;
    valueByStatus[status] += Number(row.total_gross ?? 0);
  }

  const decided = countByStatus.approved + countByStatus.rejected;
  const conversionRate = decided > 0 ? Math.round((countByStatus.approved / decided) * 1000) / 10 : null;

  return { countByStatus, valueByStatus, conversionRate };
});

export type MonthlyRevenuePoint = { monthKey: string; totalGross: number; quoteCount: number };

/** Umsatz (angenommene Offerten) nach Entscheidungsmonat, letzte `months` Monate. */
export const getMonthlyApprovedRevenue = cache(async function getMonthlyApprovedRevenue(
  organizationId: string,
  months = 6,
): Promise<MonthlyRevenuePoint[]> {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const points: MonthlyRevenuePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    points.push({
      monthKey: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      totalGross: 0,
      quoteCount: 0,
    });
  }
  if (!supabase) return points;

  const sinceIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1)).toISOString();
  const { data, error } = await supabase
    .from("quotes")
    .select("total_gross, decided_at")
    .eq("organization_id", organizationId)
    .eq("status", "approved")
    .not("decided_at", "is", null)
    .gte("decided_at", sinceIso);
  if (error || !data) return points;

  const byMonth = new Map(points.map((p) => [p.monthKey, p]));
  for (const row of data as { total_gross: number | null; decided_at: string }[]) {
    const decided = new Date(row.decided_at);
    const monthKey = `${decided.getUTCFullYear()}-${String(decided.getUTCMonth() + 1).padStart(2, "0")}`;
    const point = byMonth.get(monthKey);
    if (!point) continue;
    point.totalGross += Number(row.total_gross ?? 0);
    point.quoteCount += 1;
  }
  return points;
});

export type ReportOutcomeSummary = {
  behobenCount: number;
  aufgenommenCount: number;
  /** behoben / total — Anteil beim Erstbesuch erledigt. */
  fixedOnFirstVisitRate: number | null;
};

/** Rapport-Ausgang der letzten `sinceDays` Tage (Erledigungsquote Erstbesuch). */
export const getReportOutcomeSummary = cache(async function getReportOutcomeSummary(
  organizationId: string,
  sinceDays = 30,
): Promise<ReportOutcomeSummary> {
  const empty: ReportOutcomeSummary = { behobenCount: 0, aufgenommenCount: 0, fixedOnFirstVisitRate: null };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return empty;

  const sinceIso = new Date(Date.now() - sinceDays * DAY_MS).toISOString();
  // technician_reports hat keine organization_id-Spalte — Join über projects.
  const { data, error } = await supabase
    .from("technician_reports")
    .select("outcome, created_at, projects!inner(organization_id)")
    .eq("projects.organization_id", organizationId)
    .gte("created_at", sinceIso);
  if (error || !data) return empty;

  let behoben = 0;
  let aufgenommen = 0;
  for (const row of data as { outcome: string }[]) {
    if (row.outcome === "schaden_behoben") behoben += 1;
    else if (row.outcome === "schaden_aufgenommen") aufgenommen += 1;
  }
  const total = behoben + aufgenommen;
  return {
    behobenCount: behoben,
    aufgenommenCount: aufgenommen,
    fixedOnFirstVisitRate: total > 0 ? Math.round((behoben / total) * 1000) / 10 : null,
  };
});

export type OpenInvoicesSummary = {
  openCount: number;
  openTotalGross: number;
  overdueCount: number;
  overdueTotalGross: number;
};

/** Versendete, unbezahlte Rechnungen — überfällig = Fälligkeit vor heute. */
export const getOpenInvoicesSummary = cache(async function getOpenInvoicesSummary(
  organizationId: string,
): Promise<OpenInvoicesSummary> {
  const empty: OpenInvoicesSummary = {
    openCount: 0,
    openTotalGross: 0,
    overdueCount: 0,
    overdueTotalGross: 0,
  };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from("invoices")
    .select("total_gross, due_date")
    .eq("organization_id", organizationId)
    .eq("status", "sent");
  if (error || !data) return empty;

  const todayKey = new Date().toISOString().slice(0, 10);
  const summary = { ...empty };
  for (const row of data as { total_gross: number | null; due_date: string | null }[]) {
    const gross = Number(row.total_gross ?? 0);
    summary.openCount += 1;
    summary.openTotalGross += gross;
    if (row.due_date && row.due_date < todayKey) {
      summary.overdueCount += 1;
      summary.overdueTotalGross += gross;
    }
  }
  return summary;
});

export type TechnicianWorkloadPoint = { technicianId: string; displayName: string; appointmentCount: number };

/** Anzahl Termine je Monteur in den nächsten `days` Tagen (Auslastungs-Vorschau). */
export const getTechnicianWorkload = cache(async function getTechnicianWorkload(
  organizationId: string,
  days = 7,
): Promise<TechnicianWorkloadPoint[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const nowIso = new Date().toISOString();
  const untilIso = new Date(Date.now() + days * DAY_MS).toISOString();

  const [{ data: technicians }, { data: appointments }] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("user_id, profiles!inner(display_name)")
      .eq("organization_id", organizationId)
      .eq("role", "technician")
      .eq("is_active", true),
    supabase
      .from("appointments")
      .select("assigned_technician_id, assigned_technician_id_2, projects!inner(organization_id)")
      .eq("projects.organization_id", organizationId)
      .gte("starts_at", nowIso)
      .lte("starts_at", untilIso),
  ]);
  if (!technicians) return [];

  const nameById = new Map<string, string>();
  for (const row of technicians as { user_id: string; profiles: Record<string, unknown> | Record<string, unknown>[] | null }[]) {
    const pr = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const displayName = pr?.display_name != null ? String(pr.display_name).trim() : "";
    nameById.set(row.user_id, displayName || "Unbekannt");
  }

  const countById = new Map<string, number>();
  for (const row of (appointments ?? []) as { assigned_technician_id: string | null; assigned_technician_id_2: string | null }[]) {
    for (const techId of [row.assigned_technician_id, row.assigned_technician_id_2]) {
      if (!techId || !nameById.has(techId)) continue;
      countById.set(techId, (countById.get(techId) ?? 0) + 1);
    }
  }

  return Array.from(nameById.entries())
    .map(([technicianId, displayName]) => ({
      technicianId,
      displayName,
      appointmentCount: countById.get(technicianId) ?? 0,
    }))
    .sort((a, b) => b.appointmentCount - a.appointmentCount);
});

export type DashboardData = {
  statusCounts: Partial<Record<ProjectStatus, number>>;
  totalActiveProjects: number;
  projectAge: ProjectAgeSummary;
  cycleTime: { averageDays: number | null; sampleSize: number };
  quotePipeline: QuotePipelineSummary;
  monthlyRevenue: MonthlyRevenuePoint[];
  reportOutcome: ReportOutcomeSummary;
  technicianWorkload: TechnicianWorkloadPoint[];
  openInvoices: OpenInvoicesSummary;
};

/** Für Sessions ohne Organisation (z. B. frisch onboarded). */
export const emptyDashboardData: DashboardData = {
  statusCounts: {},
  totalActiveProjects: 0,
  projectAge: { byBucket: { "0-7": 0, "8-30": 0, "31-90": 0, "90+": 0 }, totalOpen: 0 },
  cycleTime: { averageDays: null, sampleSize: 0 },
  quotePipeline: {
    countByStatus: { draft: 0, pending_approval: 0, sent: 0, approved: 0, rejected: 0 },
    valueByStatus: { draft: 0, pending_approval: 0, sent: 0, approved: 0, rejected: 0 },
    conversionRate: null,
  },
  monthlyRevenue: [],
  reportOutcome: { behobenCount: 0, aufgenommenCount: 0, fixedOnFirstVisitRate: null },
  technicianWorkload: [],
  openInvoices: { openCount: 0, openTotalGross: 0, overdueCount: 0, overdueTotalGross: 0 },
};

/** Liest alle Dashboard-Kennzahlen parallel — die Projektstatus-Zählung nutzt den bestehenden RPC-Helper. */
export async function loadDashboardData(
  organizationId: string,
  loadStatusCounts: () => Promise<{ byStatus: Partial<Record<ProjectStatus, number>>; totalActive: number }>,
): Promise<DashboardData> {
  const [statusCounts, projectAge, cycleTime, quotePipeline, monthlyRevenue, reportOutcome, technicianWorkload, openInvoices] =
    await Promise.all([
      loadStatusCounts(),
      getProjectAgeSummary(organizationId),
      getAverageCycleTimeDays(organizationId),
      getQuotePipelineSummary(organizationId),
      getMonthlyApprovedRevenue(organizationId),
      getReportOutcomeSummary(organizationId),
      getTechnicianWorkload(organizationId),
      getOpenInvoicesSummary(organizationId),
    ]);

  return {
    statusCounts: statusCounts.byStatus,
    totalActiveProjects: statusCounts.totalActive,
    projectAge,
    cycleTime,
    quotePipeline,
    monthlyRevenue,
    reportOutcome,
    technicianWorkload,
    openInvoices,
  };
}

// Re-export für Konsumenten, die nur die Enum-Liste brauchen (UI-Reihenfolge).
export { projectStatuses };
