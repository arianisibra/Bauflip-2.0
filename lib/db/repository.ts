import "server-only";

import { cache } from "react";
import type {
  Appointment,
  OfficeProjectListItem,
  OrderFormTemplate,
  OrganizationBranding,
  Project,
  ProjectAttachment,
  ProjectStatus,
  ProjectStatusUpdateSource,
  RapportNextStep,
  RoleType,
  TechnicianAbsence,
  TechnicianAbsenceKind,
  TechnicianReport,
  TechnicianReportOrderFormEntry,
  TechnicianReportOutcome,
  TimeEntry,
  UserProfile,
  WeekTaskItem,
} from "@/lib/domain/types";
import {
  RAPPORT_NEXT_STEP_BEHOBEN,
  appointmentEndsInFutureOrNow,
  assertAllowedProjectStatusTransition,
  nextProjectStatusAfterAppointmentBooked,
  projectStatusAfterLastAppointmentDeleted,
  projectStatuses,
} from "@/lib/domain/types";
import { parseOrderFormFieldsJson } from "@/lib/order-forms/schema";
import { getWeekBounds } from "@/lib/date/week-bounds";
import { resolveCalendarColor } from "@/lib/calendar/team-colors";
import type { BusyBlock } from "@/lib/calendar/availability-conflicts";
import { getBusyEventsForOrgRange } from "@/lib/db/busy-calendar";
import { formatServiceAddressFields } from "@/lib/tech/bundle-display";
import type { TeamMemberListItem } from "@/lib/mitarbeiter/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withSlowLog } from "@/lib/observability/slow-log";
import type { ProjekteStatusCountsSnapshot } from "@/lib/projekte/bootstrap-types";
import {
  DEFAULT_PROJEKTE_LIST_FILTER,
  matchesProjekteListFilter,
  type ProjekteListFilter,
} from "@/lib/projekte/list-filter";
import {
  decodeProjekteListCursor,
  encodeProjekteListCursor,
  PROJEKTE_ABGEMACHT_MAX_ROWS,
  PROJEKTE_LIST_PAGE_SIZE,
  type ProjekteListPageResult,
} from "@/lib/projekte/list-page";
import { sortAbgemachtOfficeProjects } from "@/lib/projekte/list-sort";
import {
  mockAppointments,
  mockProfiles,
  mockProjectAttachments,
  mockProjects,
  mockReports,
} from "@/lib/db/mock-data";

export { mapUserProfileRow } from "./repository-map";

/** DB-Spaltenliste — kein select('*') für Projektkern. */
const PROJECT_DB_COLUMNS =
  "id, organization_id, title, type, status, status_updated_source, status_revert_on_appointment_clear, next_owner_role, next_owner_user_id, source, intake_original_text, access_notes, created_at, updated_at, closed_at, reference_code, hints_and_notes, tenant_name, tenant_phone, tenant_email, management_name, management_phone, management_email, cost_ceiling_text, service_street, service_postal_code, service_city, service_country, warranty_note, warranty_opened_at, warranty_opened_by, warranty_opened_by_display_name";

const APPOINTMENT_DB_COLUMNS =
  "id, project_id, kind, starts_at, ends_at, assigned_technician_id, assigned_technician_id_2, planning_notes, created_at";

const PROJECT_LIST_COLUMNS =
  "id, title, type, status, tenant_name, created_at";

const ATTACHMENT_DB_COLUMNS =
  "id, project_id, file_path, file_name, mime_type, size_bytes, uploaded_by, notes, created_at";

const TECH_REPORT_DB_COLUMNS =
  "id, project_id, outcome, summary, measurements_json, work_description, time_spent_minutes, created_at, created_by, created_by_display_name, has_signature, signed_by_name";

/** Ein `current_organization_id`-RPC pro Request — mehrere Repo-Aufrufe teilen sich das Ergebnis. */
export const getCachedCurrentOrganizationId = cache(async function getCachedCurrentOrganizationId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: oid } = await supabase.rpc("current_organization_id");
  return (oid as string | null) ?? null;
});

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isRoleType(v: unknown): v is RoleType {
  return v === "admin" || v === "office" || v === "technician";
}

function mapProjectRow(row: Record<string, unknown>): Project {
  const rawStatusUpdateSource = row.status_updated_source;
  const statusUpdateSource: ProjectStatusUpdateSource | null =
    rawStatusUpdateSource === "manual" || rawStatusUpdateSource === "appointment_automation"
      ? rawStatusUpdateSource
      : null;
  return {
    id: String(row.id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    title: String(row.title ?? ""),
    type: row.type as Project["type"],
    status: row.status as ProjectStatus,
    nextOwnerRole: row.next_owner_role as Project["nextOwnerRole"],
    nextOwnerUserId: row.next_owner_user_id ? String(row.next_owner_user_id) : null,
    source: row.source as Project["source"],
    intakeOriginalText: String(row.intake_original_text ?? ""),
    accessNotes: row.access_notes != null ? String(row.access_notes) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    closedAt: row.closed_at ? String(row.closed_at) : null,
    referenceCode: row.reference_code != null ? String(row.reference_code) : null,
    hintsAndNotes: row.hints_and_notes != null ? String(row.hints_and_notes) : null,
    tenantName: row.tenant_name != null ? String(row.tenant_name) : null,
    tenantPhone: row.tenant_phone != null ? String(row.tenant_phone) : null,
    tenantEmail: row.tenant_email != null ? String(row.tenant_email) : null,
    managementName: row.management_name != null ? String(row.management_name) : null,
    managementPhone: row.management_phone != null ? String(row.management_phone) : null,
    managementEmail: row.management_email != null ? String(row.management_email) : null,
    costCeilingText: row.cost_ceiling_text != null ? String(row.cost_ceiling_text) : null,
    serviceStreet: row.service_street != null ? String(row.service_street) : null,
    servicePostalCode: row.service_postal_code != null ? String(row.service_postal_code) : null,
    serviceCity: row.service_city != null ? String(row.service_city) : null,
    serviceCountry: String(row.service_country ?? "CH"),
    statusUpdateSource,
    statusRevertOnAppointmentClear:
      row.status_revert_on_appointment_clear != null &&
      projectStatuses.includes(row.status_revert_on_appointment_clear as ProjectStatus)
        ? (row.status_revert_on_appointment_clear as ProjectStatus)
        : null,
    warrantyNote: row.warranty_note != null ? String(row.warranty_note) : null,
    warrantyOpenedAt: row.warranty_opened_at ? String(row.warranty_opened_at) : null,
    warrantyOpenedByUserId: row.warranty_opened_by != null ? String(row.warranty_opened_by) : null,
    warrantyOpenedByDisplayName:
      row.warranty_opened_by_display_name != null ? String(row.warranty_opened_by_display_name) : null,
  };
}

function mapAppointmentRow(row: Record<string, unknown>): Appointment {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? ""),
    kind: (String(row.kind) as Appointment["kind"]) ?? "besichtigung",
    startsAt: String(row.starts_at ?? ""),
    endsAt: String(row.ends_at ?? ""),
    assignedTechnicianId: (row.assigned_technician_id as string | null) ?? null,
    assignedTechnicianId2: (row.assigned_technician_id_2 as string | null) ?? null,
    planningNotes: (row.planning_notes as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function valuesJsonToStringRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null) continue;
    out[k] = String(v);
  }
  return out;
}

function mapOrderFormTemplateRow(row: Record<string, unknown>): OrderFormTemplate {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? ""),
    supplierName: row.supplier_name != null ? String(row.supplier_name).trim() || null : null,
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    description: row.description != null ? String(row.description) : null,
    fields: parseOrderFormFieldsJson(row.fields),
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
  };
}

function mapTechnicianReportRow(row: Record<string, unknown>): TechnicianReport {
  const o = String(row.outcome ?? "schaden_aufgenommen");
  const outcome: TechnicianReportOutcome =
    o === "schaden_behoben" || o === "schaden_aufgenommen" ? o : "schaden_aufgenommen";
  const rawMeas = row.measurements_json;
  const measurementsJson =
    typeof rawMeas === "string" ? rawMeas : rawMeas != null ? JSON.stringify(rawMeas) : "{}";
  const dn = row.created_by_display_name;
  const createdByDisplayName =
    dn != null && String(dn).trim() ? String(dn).trim() : null;
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? ""),
    outcome,
    summary: String(row.summary ?? ""),
    measurementsJson,
    workDescription: String(row.work_description ?? ""),
    timeSpentMinutes:
      row.time_spent_minutes != null ? Number(row.time_spent_minutes) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    createdByProfileId: row.created_by != null ? String(row.created_by) : null,
    createdByDisplayName,
    signatureDataUrl:
      row.signature_data_url != null && String(row.signature_data_url).startsWith("data:image/")
        ? String(row.signature_data_url)
        : null,
    hasSignature: Boolean(row.has_signature) || row.signature_data_url != null,
    signedByName:
      row.signed_by_name != null && String(row.signed_by_name).trim()
        ? String(row.signed_by_name).trim()
        : null,
    orderForms: [],
  };
}

function mapProjectAttachmentRow(row: Record<string, unknown>): ProjectAttachment {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? ""),
    fileName: String(row.file_name ?? ""),
    fileType: String(row.mime_type ?? row.file_type ?? "application/octet-stream"),
    filePath: String(row.file_path ?? ""),
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    uploadedBy: row.uploaded_by ? String(row.uploaded_by) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

export type ProjectCoreHead = {
  project: Project;
  appointments: Appointment[];
};

export type ProjectCoreDetails = {
  attachments: ProjectAttachment[];
  reports: TechnicianReport[];
};

export type ProjectCore = ProjectCoreHead & ProjectCoreDetails;

export const getOrganizationBranding = cache(async function getOrganizationBranding(
  organizationId: string | null,
): Promise<OrganizationBranding> {
  const fallbackName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Bauflip";
  if (!organizationId) {
    return { name: fallbackName, logoUrl: null };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { name: fallbackName, logoUrl: null };
  }
  const { data, error } = await supabase.from("organizations").select("name, logo_url").eq("id", organizationId).maybeSingle();
  if (error || !data) {
    return { name: fallbackName, logoUrl: null };
  }
  const row = data as { name?: string | null; logo_url?: string | null };
  const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : fallbackName;
  const logoUrl = row.logo_url && String(row.logo_url).trim() ? String(row.logo_url).trim() : null;
  return { name, logoUrl };
});

export const listProjectStatusCountsForOffice = cache(async function listProjectStatusCountsForOffice(
  organizationId?: string | null,
): Promise<ProjekteStatusCountsSnapshot> {
  const empty: ProjekteStatusCountsSnapshot = {
    byStatus: {},
    totalAll: 0,
    totalActive: 0,
    totalArchived: 0,
  };
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const byStatus: Partial<Record<ProjectStatus, number>> = {};
    for (const p of mockProjects) {
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    }
    const totalAll = mockProjects.length;
    return {
      byStatus,
      totalAll,
      totalActive: mockProjects.filter((p) => p.status !== "abgeschlossen").length,
      totalArchived: 0,
    };
  }
  const orgId = organizationId ?? (await getCachedCurrentOrganizationId());
  if (!orgId) return empty;

  const { data, error } = await supabase.rpc("project_status_counts_for_org", {
    p_org_id: orgId,
  });
  if (error || !data) {
    return listProjectStatusCountsForOfficeFallback(supabase, orgId);
  }

  const byStatus: Partial<Record<ProjectStatus, number>> = {};
  let totalAll = 0;
  for (const row of data as { status?: string; count?: number | string }[]) {
    const status = row.status;
    const countRaw = row.count;
    const count =
      typeof countRaw === "number" ? countRaw : Number.parseInt(String(countRaw ?? "0"), 10);
    if (typeof status !== "string" || !projectStatuses.includes(status as ProjectStatus)) continue;
    if (!Number.isFinite(count) || count < 0) continue;
    const key = status as ProjectStatus;
    byStatus[key] = count;
    totalAll += count;
  }
  let totalActive = 0;
  for (const [status, count] of Object.entries(byStatus)) {
    if (status !== "abgeschlossen" && typeof count === "number") {
      totalActive += count;
    }
  }
  return { byStatus, totalAll, totalActive, totalArchived: 0 };
});

async function listProjectStatusCountsForOfficeFallback(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  orgId: string,
): Promise<ProjekteStatusCountsSnapshot> {
  const empty: ProjekteStatusCountsSnapshot = {
    byStatus: {},
    totalAll: 0,
    totalActive: 0,
    totalArchived: 0,
  };
  const { data, error } = await supabase
    .from("projects")
    .select("status")
    .eq("organization_id", orgId);
  if (error || !data) return empty;

  const byStatus: Partial<Record<ProjectStatus, number>> = {};
  for (const row of data as { status?: string }[]) {
    const status = row.status;
    if (typeof status !== "string" || !projectStatuses.includes(status as ProjectStatus)) continue;
    const key = status as ProjectStatus;
    byStatus[key] = (byStatus[key] ?? 0) + 1;
  }
  const totalAll = data.length;
  let totalActive = 0;
  for (const [status, count] of Object.entries(byStatus)) {
    if (status !== "abgeschlossen" && typeof count === "number") {
      totalActive += count;
    }
  }
  return { byStatus, totalAll, totalActive, totalArchived: 0 };
}

function mapRpcStatusCounts(raw: unknown): ProjekteStatusCountsSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const sc = raw as {
    byStatus?: Record<string, unknown>;
    totalAll?: number | string;
    totalActive?: number | string;
    totalArchived?: number | string;
  };
  const byStatus: Partial<Record<ProjectStatus, number>> = {};
  if (sc.byStatus && typeof sc.byStatus === "object") {
    for (const [status, countRaw] of Object.entries(sc.byStatus)) {
      if (!projectStatuses.includes(status as ProjectStatus)) continue;
      const count =
        typeof countRaw === "number" ? countRaw : Number.parseInt(String(countRaw ?? "0"), 10);
      if (!Number.isFinite(count) || count < 0) continue;
      byStatus[status as ProjectStatus] = count;
    }
  }
  const totalAll =
    typeof sc.totalAll === "number"
      ? sc.totalAll
      : Number.parseInt(String(sc.totalAll ?? "0"), 10);
  const totalActive =
    typeof sc.totalActive === "number"
      ? sc.totalActive
      : Number.parseInt(String(sc.totalActive ?? "0"), 10);
  if (!Number.isFinite(totalAll) || !Number.isFinite(totalActive)) return null;
  const totalArchivedRaw =
    typeof sc.totalArchived === "number"
      ? sc.totalArchived
      : Number.parseInt(String(sc.totalArchived ?? "0"), 10);
  const totalArchived = Number.isFinite(totalArchivedRaw) && totalArchivedRaw >= 0 ? totalArchivedRaw : 0;
  return { byStatus, totalAll, totalActive, totalArchived };
}

export type ProjekteOfficeBootstrapResult = {
  page: ProjekteListPageResult;
  statusCounts: ProjekteStatusCountsSnapshot;
};

/** Combined page 1 + status counts via RPC. Returns null → caller uses parallel fallback. */
export const loadProjekteOfficeBootstrap = cache(async function loadProjekteOfficeBootstrap(
  organizationId: string,
  listFilter: ProjekteListFilter = DEFAULT_PROJEKTE_LIST_FILTER,
  searchQuery = "",
  limit: number = PROJEKTE_LIST_PAGE_SIZE,
): Promise<ProjekteOfficeBootstrapResult | null> {
  if (listFilter === "abgemacht") return null;

  return withSlowLog("loadProjekteOfficeBootstrap", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase.rpc("projekte_office_bootstrap", {
      p_org_id: organizationId,
      p_filter: listFilter,
      p_search: searchQuery || null,
      p_limit: limit,
    });

    if (error || !data || typeof data !== "object") {
      if (error) {
        console.warn("[bauflip] projekte_office_bootstrap:", error.message);
      }
      return null;
    }

    const payload = data as Record<string, unknown>;
    if (payload.deferred === true) return null;

    const statusCounts = mapRpcStatusCounts(payload.statusCounts);
    if (!statusCounts) return null;

    const projectsRaw = payload.projects;
    const projects = Array.isArray(projectsRaw)
      ? projectsRaw.map((row) => mapProjectListRow(row as Record<string, unknown>))
      : [];
    // Termine sind Listen-Spalte — auch für die per RPC geladene erste Seite anhängen.
    await attachNextAppointmentsForProjects(supabase, organizationId, projects);

    let hasMore = payload.hasMore === true;
    let nextCursor: string | null = null;
    const lastCreatedAt = payload.lastCreatedAt != null ? String(payload.lastCreatedAt) : null;
    const lastId = payload.lastId != null ? String(payload.lastId) : null;

    if (hasMore && lastCreatedAt && lastId) {
      nextCursor = encodeProjekteListCursor({
        kind: "keyset",
        segment: listFilter === "all" ? "open" : undefined,
        createdAt: lastCreatedAt,
        id: lastId,
      });
    } else if (
      listFilter === "all" &&
      !hasMore &&
      projects.length > 0 &&
      statusCounts.totalAll > statusCounts.totalActive
    ) {
      hasMore = true;
      nextCursor = encodeProjekteListCursor({ kind: "keyset", segment: "closed" });
    } else if (
      listFilter === "all" &&
      projects.length === 0 &&
      statusCounts.totalAll > statusCounts.totalActive
    ) {
      return null;
    }

    if (process.env.NODE_ENV === "development") {
      console.info(
        JSON.stringify({
          type: "loadProjekteOfficeBootstrap",
          listFilter,
          searchQuery: searchQuery || null,
          projectCount: projects.length,
          hasMore,
          rpc: "projekte_office_bootstrap",
        }),
      );
    }

    return {
      page: { projects, hasMore, nextCursor },
      statusCounts,
    };
  });
});

function mapProjectListRow(row: Record<string, unknown>): OfficeProjectListItem {
  const tenant = row.tenant_name != null ? String(row.tenant_name).trim() : "";
  const title = tenant || String(row.title ?? "");
  return {
    id: String(row.id),
    title,
    type: row.type as OfficeProjectListItem["type"],
    status: row.status as ProjectStatus,
    createdAt: String(row.created_at ?? new Date(0).toISOString()),
  };
}

function escapeIlikePattern(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function attachNextAppointmentsForProjects(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  orgId: string,
  projects: OfficeProjectListItem[],
): Promise<void> {
  if (projects.length === 0) return;
  const projectIds = new Set(projects.map((p) => p.id));
  const nowIso = new Date().toISOString();
  const { data: apRows, error: apErr } = await supabase.rpc("next_appointment_starts_for_org", {
    p_org_id: orgId,
    p_now: nowIso,
  });
  if (apErr) {
    console.warn("[bauflip] next_appointment_starts_for_org:", apErr.message);
    return;
  }
  const nextByProject = new Map<string, { startsAt: string; technician: string | null }>();
  if (apRows?.length) {
    for (const raw of apRows as { project_id?: string; starts_at?: string; technician_name?: string | null }[]) {
      const pid = String(raw.project_id ?? "");
      const st = String(raw.starts_at ?? "");
      const tech = raw.technician_name != null && String(raw.technician_name).trim()
        ? String(raw.technician_name).trim()
        : null;
      if (pid && st && projectIds.has(pid)) nextByProject.set(pid, { startsAt: st, technician: tech });
    }
  }
  for (const p of projects) {
    const next = nextByProject.get(p.id);
    p.nextAppointmentStartsAt = next?.startsAt ?? null;
    p.nextAppointmentTechnician = next?.technician ?? null;
  }
}

function mockProjectsForFilter(listFilter: ProjekteListFilter): OfficeProjectListItem[] {
  return mockProjects
    .filter((p) => matchesProjekteListFilter(p.status, listFilter))
    .map((p) => ({
      id: p.id,
      title: p.tenantName?.trim() || p.title,
      type: p.type,
      status: p.status,
      createdAt: p.createdAt,
    }));
}

function paginateMockProjects(
  items: OfficeProjectListItem[],
  listFilter: ProjekteListFilter,
  searchQuery: string,
  limit: number,
  cursorRaw: string | null | undefined,
): ProjekteListPageResult {
  let sorted = [...items];
  if (listFilter === "abgemacht") {
    sorted = sortAbgemachtOfficeProjects(sorted);
  } else if (listFilter === "all") {
    sorted.sort((a, b) => {
      const aDone = a.status === "abgeschlossen";
      const bDone = b.status === "abgeschlossen";
      if (aDone !== bDone) return aDone ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  } else {
    sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  if (searchQuery) {
    const n = searchQuery.toLowerCase();
    sorted = sorted.filter((p) => p.title.toLowerCase().includes(n));
  }

  if (listFilter === "abgemacht") {
    const cursor = decodeProjekteListCursor(cursorRaw);
    const offset = cursor?.kind === "offset" ? cursor.offset : 0;
    const page = sorted.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    const hasMore = nextOffset < sorted.length;
    return {
      projects: page,
      hasMore,
      nextCursor: hasMore ? encodeProjekteListCursor({ kind: "offset", offset: nextOffset }) : null,
    };
  }

  const cursor = decodeProjekteListCursor(cursorRaw);
  let startIndex = 0;
  if (cursor?.kind === "keyset" && cursor.createdAt && cursor.id) {
    startIndex =
      sorted.findIndex((p) => p.createdAt === cursor.createdAt && p.id === cursor.id) + 1;
    if (startIndex < 0) startIndex = 0;
  } else if (cursor?.kind === "keyset" && cursor.segment === "closed" && listFilter === "all") {
    startIndex = sorted.findIndex((p) => p.status === "abgeschlossen");
    if (startIndex < 0) startIndex = sorted.length;
  }

  const page = sorted.slice(startIndex, startIndex + limit);
  const last = page[page.length - 1];
  const hasMore = startIndex + page.length < sorted.length;
  let nextCursor: string | null = null;
  if (hasMore && last) {
    if (listFilter === "all" && last.status !== "abgeschlossen") {
      const openRemaining = sorted
        .slice(startIndex + page.length)
        .some((p) => p.status !== "abgeschlossen");
      if (!openRemaining) {
        nextCursor = encodeProjekteListCursor({ kind: "keyset", segment: "closed" });
      } else {
        nextCursor = encodeProjekteListCursor({
          kind: "keyset",
          segment: "open",
          createdAt: last.createdAt,
          id: last.id,
        });
      }
    } else {
      nextCursor = encodeProjekteListCursor({
        kind: "keyset",
        segment: listFilter === "all" ? "closed" : undefined,
        createdAt: last.createdAt,
        id: last.id,
      });
    }
  }
  return { projects: page, hasMore, nextCursor };
}

export type ListProjectsForOfficePageOptions = {
  limit?: number;
  cursor?: string | null;
  searchQuery?: string;
};

export const listProjectsForOfficePage = cache(async function listProjectsForOfficePage(
  organizationId: string | null | undefined,
  listFilter: ProjekteListFilter = DEFAULT_PROJEKTE_LIST_FILTER,
  options: ListProjectsForOfficePageOptions = {},
): Promise<ProjekteListPageResult> {
  const limit = options.limit ?? PROJEKTE_LIST_PAGE_SIZE;
  const searchQuery = options.searchQuery?.trim() ?? "";
  const cursorRaw = options.cursor ?? null;

  return withSlowLog("listProjectsForOfficePage", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return paginateMockProjects(mockProjectsForFilter(listFilter), listFilter, searchQuery, limit, cursorRaw);
    }

    const orgId = organizationId ?? (await getCachedCurrentOrganizationId());
    if (!orgId) {
      return { projects: [], hasMore: false, nextCursor: null };
    }

    // «abgemacht» hat eine eigene, termin-sortierte Pagination — aber nur ohne Suche.
    // Bei aktiver Suche läuft es über den normalen, org-weiten Suchpfad unten.
    if (listFilter === "abgemacht" && !searchQuery) {
      return listAbgemachtProjectsPage(supabase, orgId, limit, cursorRaw);
    }

    const cursor = decodeProjekteListCursor(cursorRaw);
    let segment: "open" | "closed" | null = null;
    // Bei aktiver Suche keine open/closed-Segmentierung — die Suche läuft statusweit
    // und flach (siehe Status-Filter unten + RPC-Fix).
    if (listFilter === "all" && !searchQuery) {
      if (cursor?.kind === "keyset" && cursor.segment === "closed") {
        segment = "closed";
      } else {
        segment = "open";
      }
    }

    let q = supabase.from("projects").select(PROJECT_LIST_COLUMNS).eq("organization_id", orgId);

    // Archiv-Trennung: Filter 'archived' zeigt nur archivierte, alle anderen nur aktive.
    if (listFilter === "archived") {
      q = q.not("archived_at", "is", null);
    } else {
      q = q.is("archived_at", null);
    }

    if (searchQuery) {
      const pattern = `%${escapeIlikePattern(searchQuery)}%`;
      q = q.or(
        [
          `title.ilike.${pattern}`,
          `tenant_name.ilike.${pattern}`,
          `service_street.ilike.${pattern}`,
          `service_city.ilike.${pattern}`,
          `service_postal_code.ilike.${pattern}`,
          `reference_code.ilike.${pattern}`,
        ].join(","),
      );
    }

    // Bei aktiver Suche wird der Status-Filter NICHT angewendet → org-weite Suche
    // über alle Status (die UI verspricht «durchsucht alle Projekte»). Das war der Bug:
    // vorher wurde die Suche mit dem Status-Filter UND-verknüpft.
    if (searchQuery || listFilter === "archived") {
      // statusweit — kein Status-Prädikat (Suche org-weit; Archiv zeigt alle Status)
    } else if (listFilter === "active" || (listFilter === "all" && segment === "open")) {
      q = q.neq("status", "abgeschlossen");
    } else if (listFilter === "all" && segment === "closed") {
      q = q.eq("status", "abgeschlossen");
    } else if (listFilter !== "all") {
      q = q.eq("status", listFilter);
    }

    q = q.order("created_at", { ascending: false }).order("id", { ascending: false });

    if (cursor?.kind === "keyset" && cursor.createdAt && cursor.id) {
      q = q.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
      );
    }

    q = q.limit(limit + 1);
    const { data, error } = await q;
    if (error || !data) {
      return { projects: [], hasMore: false, nextCursor: null };
    }

    let rows = data as Record<string, unknown>[];
    const hasMore = rows.length > limit;
    if (hasMore) rows = rows.slice(0, limit);

    if (
      listFilter === "all" &&
      segment === "open" &&
      !hasMore &&
      rows.length === 0 &&
      cursor?.kind !== "keyset"
    ) {
      return listProjectsForOfficePage(orgId, listFilter, {
        ...options,
        cursor: encodeProjekteListCursor({ kind: "keyset", segment: "closed" }),
      });
    }

    if (listFilter === "all" && segment === "open" && !hasMore && rows.length > 0) {
      const mappedOpen = rows.map(mapProjectListRow);
      await attachNextAppointmentsForProjects(supabase, orgId, mappedOpen); // Termine sind Listen-Spalte — für alle Filter laden
      const { count: closedCount } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "abgeschlossen")
        .is("archived_at", null);
      const hasClosed = (closedCount ?? 0) > 0;
      return {
        projects: mappedOpen,
        hasMore: hasClosed,
        nextCursor: hasClosed
          ? encodeProjekteListCursor({ kind: "keyset", segment: "closed" })
          : null,
      };
    }

    if (listFilter === "all" && segment === "open" && !hasMore && rows.length === 0) {
      return listProjectsForOfficePage(orgId, listFilter, {
        ...options,
        cursor: encodeProjekteListCursor({ kind: "keyset", segment: "closed" }),
      });
    }

    const mapped = rows.map(mapProjectListRow);
    await attachNextAppointmentsForProjects(supabase, orgId, mapped); // Termine sind Listen-Spalte — für alle Filter laden

    const last = rows[rows.length - 1];
    let nextCursor: string | null = null;
    if (hasMore && last) {
      nextCursor = encodeProjekteListCursor({
        kind: "keyset",
        segment: listFilter === "all" ? segment ?? undefined : undefined,
        createdAt: String(last.created_at),
        id: String(last.id),
      });
    } else if (listFilter === "all" && segment === "open" && !hasMore && last) {
      nextCursor = encodeProjekteListCursor({ kind: "keyset", segment: "closed" });
    }

    if (process.env.NODE_ENV === "development") {
      console.info(
        JSON.stringify({
          type: "listProjectsForOfficePage",
          listFilter,
          searchQuery: searchQuery || null,
          projectCount: mapped.length,
          hasMore,
          rpc: "next_appointment_starts_for_org",
        }),
      );
    }

    return { projects: mapped, hasMore, nextCursor };
  });
});

async function listAbgemachtProjectsPage(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  orgId: string,
  limit: number,
  cursorRaw: string | null | undefined,
): Promise<ProjekteListPageResult> {
  const cursor = decodeProjekteListCursor(cursorRaw);
  const offset = cursor?.kind === "offset" ? cursor.offset : 0;

  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_LIST_COLUMNS)
    .eq("organization_id", orgId)
    .eq("status", "abgemacht")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(PROJEKTE_ABGEMACHT_MAX_ROWS);

  if (error || !data) {
    return { projects: [], hasMore: false, nextCursor: null };
  }

  const mapped = (data as Record<string, unknown>[]).map(mapProjectListRow);
  await attachNextAppointmentsForProjects(supabase, orgId, mapped); // Termine sind Listen-Spalte — für alle Filter laden
  const sorted = sortAbgemachtOfficeProjects(mapped);
  const page = sorted.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < sorted.length;

  return {
    projects: page,
    hasMore,
    nextCursor: hasMore ? encodeProjekteListCursor({ kind: "offset", offset: nextOffset }) : null,
  };
}

export const getOfficeProjectListItemById = cache(async function getOfficeProjectListItemById(
  organizationId: string,
  projectId: string,
): Promise<OfficeProjectListItem | null> {
  return withSlowLog("getOfficeProjectListItemById", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      const p = mockProjects.find((x) => x.id === projectId);
      if (!p) return null;
      return {
        id: p.id,
        title: p.tenantName?.trim() || p.title,
        type: p.type,
        status: p.status,
        createdAt: p.createdAt,
      };
    }

    const { data, error } = await supabase
      .from("projects")
      .select(PROJECT_LIST_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("id", projectId)
      .maybeSingle();

    if (error || !data) return null;
    const item = mapProjectListRow(data as Record<string, unknown>);
    if (item.status === "abgemacht") {
      await attachNextAppointmentsForProjects(supabase, organizationId, [item]);
    }
    return item;
  });
});

function enrichMockAppointmentsWithTechnicianNames(appointments: Appointment[]): Appointment[] {
  return appointments.map((a) => ({
    ...a,
    assignedTechnicianDisplayName: a.assignedTechnicianId
      ? mockProfiles.find((p) => p.id === a.assignedTechnicianId)?.displayName ?? null
      : null,
  }));
}

async function enrichAppointmentsWithTechnicianDisplayNames(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  appointments: Appointment[],
): Promise<Appointment[]> {
  const techIds = [
    ...new Set(
      appointments.map((a) => a.assignedTechnicianId).filter((id): id is string => Boolean(id)),
    ),
  ];
  if (techIds.length === 0) return appointments;

  const { data } = await supabase.from("profiles").select("id, display_name").in("id", techIds);
  const nameById = new Map<string, string>();
  for (const row of data ?? []) {
    const r = row as { id: string; display_name?: string | null };
    const name = String(r.display_name ?? "").trim();
    if (name) nameById.set(String(r.id), name);
  }

  return appointments.map((a) => ({
    ...a,
    assignedTechnicianDisplayName: a.assignedTechnicianId
      ? nameById.get(a.assignedTechnicianId) ?? null
      : null,
  }));
}

async function loadProjectReportsWithOrderForms(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  projectId: string,
): Promise<TechnicianReport[]> {
  const { data: reports } = await supabase
    .from("technician_reports")
    .select(TECH_REPORT_DB_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at");

  const reportRows = ((reports as Record<string, unknown>[]) ?? []).map(mapTechnicianReportRow);
  if (reportRows.length === 0) return reportRows;

  const ids = reportRows.map((r) => r.id);
  const { data: ofRows } = await supabase
    .from("technician_report_order_forms")
    .select("technician_report_id, template_id, values_json, order_form_templates ( name, fields )")
    .in("technician_report_id", ids);

  const byReport = new Map<string, TechnicianReportOrderFormEntry[]>();
  for (const raw of ofRows ?? []) {
    const row = raw as Record<string, unknown>;
    const rid = String(row.technician_report_id ?? "");
    const tplWrap = row.order_form_templates as Record<string, unknown> | Record<string, unknown>[] | null;
    const t = Array.isArray(tplWrap) ? tplWrap[0] : tplWrap;
    if (!t || !rid) continue;
    const entry: TechnicianReportOrderFormEntry = {
      templateId: String(row.template_id ?? ""),
      templateName: String(t.name ?? ""),
      fields: parseOrderFormFieldsJson(t.fields),
      values: valuesJsonToStringRecord(row.values_json),
    };
    const list = byReport.get(rid) ?? [];
    list.push(entry);
    byReport.set(rid, list);
  }

  return reportRows.map((r) => ({ ...r, orderForms: byReport.get(r.id) ?? [] }));
}

function parseProjectCoreBootstrapOrderForm(raw: unknown): TechnicianReportOrderFormEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tplWrap = o.fields;
  return {
    templateId: String(o.templateId ?? o.template_id ?? ""),
    templateName: String(o.templateName ?? o.template_name ?? ""),
    fields: parseOrderFormFieldsJson(tplWrap),
    values: valuesJsonToStringRecord(o.values ?? o.values_json),
  };
}

function parseProjectCoreBootstrapRpc(payload: unknown): ProjectCore | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const projectRaw = root.project;
  if (!projectRaw || typeof projectRaw !== "object") return null;

  const appointments = (Array.isArray(root.appointments) ? root.appointments : []).map((row) => {
    const rec = row as Record<string, unknown>;
    const appt = mapAppointmentRow(rec);
    const techName = rec.technician_display_name;
    if (techName != null && String(techName).trim()) {
      appt.assignedTechnicianDisplayName = String(techName).trim();
    }
    return appt;
  });

  const attachments = (Array.isArray(root.attachments) ? root.attachments : []).map((row) =>
    mapProjectAttachmentRow(row as Record<string, unknown>),
  );

  const reports = (Array.isArray(root.reports) ? root.reports : []).map((row) => {
    const rec = row as Record<string, unknown>;
    const report = mapTechnicianReportRow(rec);
    const orderFormsRaw = rec.orderForms;
    const orderForms = Array.isArray(orderFormsRaw)
      ? orderFormsRaw
          .map(parseProjectCoreBootstrapOrderForm)
          .filter((e): e is TechnicianReportOrderFormEntry => e != null)
      : [];
    return { ...report, orderForms };
  });

  return {
    project: mapProjectRow(projectRaw as Record<string, unknown>),
    appointments,
    attachments,
    reports,
  };
}

async function projectCorePostgrestFallback(projectId: string): Promise<ProjectCore | null> {
  const [head, details] = await Promise.all([
    getProjectCoreHead(projectId),
    getProjectCoreDetails(projectId),
  ]);
  if (!head || !details) return null;
  return { ...head, ...details };
}

export const loadProjectCoreBootstrap = cache(async function loadProjectCoreBootstrap(
  projectId: string,
): Promise<ProjectCore | null> {
  return withSlowLog("loadProjectCoreBootstrap", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      const project = mockProjects.find((x) => x.id === projectId);
      if (!project) return null;
      return {
        project,
        appointments: enrichMockAppointmentsWithTechnicianNames(
          mockAppointments.filter((a) => a.projectId === projectId),
        ),
        attachments: mockProjectAttachments.filter((a) => a.projectId === projectId),
        reports: mockReports.filter((r) => r.projectId === projectId),
      };
    }

    const { data, error } = await supabase.rpc("project_core_bootstrap", {
      p_project_id: projectId,
    });

    if (!error && data != null) {
      const parsed = parseProjectCoreBootstrapRpc(data);
      if (parsed) return parsed;
      console.warn("[bauflip] project_core_bootstrap_rpc_fallback parse");
    } else if (error) {
      console.warn("[bauflip] project_core_bootstrap_rpc_fallback", error.message);
    }

    return projectCorePostgrestFallback(projectId);
  });
});

export const getProjectCoreHead = cache(async function getProjectCoreHead(
  projectId: string,
): Promise<ProjectCoreHead | null> {
  return withSlowLog("getProjectCoreHead", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      const project = mockProjects.find((x) => x.id === projectId);
      if (!project) return null;
      const appts = enrichMockAppointmentsWithTechnicianNames(
        mockAppointments.filter((a) => a.projectId === projectId),
      );
      return { project, appointments: appts };
    }

    const [{ data: project }, { data: appointments }] = await Promise.all([
      supabase.from("projects").select(PROJECT_DB_COLUMNS).eq("id", projectId).maybeSingle(),
      supabase
        .from("appointments")
        .select(APPOINTMENT_DB_COLUMNS)
        .eq("project_id", projectId)
        .order("starts_at"),
    ]);

    if (!project) return null;

    const apptModels = ((appointments as Record<string, unknown>[]) ?? []).map(mapAppointmentRow);
    const enrichedAppointments = await enrichAppointmentsWithTechnicianDisplayNames(supabase, apptModels);

    return {
      project: mapProjectRow(project as Record<string, unknown>),
      appointments: enrichedAppointments,
    };
  });
});

export async function listProjectAttachmentsForProject(
  projectId: string,
): Promise<ProjectAttachment[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockProjectAttachments.filter((a) => a.projectId === projectId);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return [];

  const { data: attachments } = await supabase
    .from("project_attachments")
    .select(ATTACHMENT_DB_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at");

  return ((attachments as Record<string, unknown>[]) ?? []).map(mapProjectAttachmentRow);
}

export const getProjectCoreDetails = cache(async function getProjectCoreDetails(
  projectId: string,
): Promise<ProjectCoreDetails | null> {
  return withSlowLog("getProjectCoreDetails", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      const project = mockProjects.find((x) => x.id === projectId);
      if (!project) return null;
      return {
        attachments: mockProjectAttachments.filter((a) => a.projectId === projectId),
        reports: mockReports.filter((r) => r.projectId === projectId),
      };
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return null;

    const [attachments, reports] = await Promise.all([
      listProjectAttachmentsForProject(projectId),
      loadProjectReportsWithOrderForms(supabase, projectId),
    ]);

    return {
      attachments,
      reports,
    };
  });
});

export const getProjectCore = cache(async function getProjectCore(projectId: string): Promise<ProjectCore | null> {
  return loadProjectCoreBootstrap(projectId);
});

type OfficeCalendarNestedProject = {
  title: string;
  status: string;
  tenant_name?: string | null;
  service_street?: string | null;
  service_postal_code?: string | null;
  service_city?: string | null;
  service_country?: string | null;
};

type OfficeCalendarAppointmentRow = {
  id: string;
  project_id: string;
  kind: WeekTaskItem["kind"];
  starts_at: string;
  ends_at: string;
  assigned_technician_id: string | null;
  assigned_technician_id_2: string | null;
  projects: OfficeCalendarNestedProject | OfficeCalendarNestedProject[] | null;
};

async function weekTasksFromAppointmentRange(
  rangeStartIso: string,
  rangeEndIso: string,
  /** Nur gesetzt für Monteur-Pfade: weniger Zeilen aus der DB statt Filter nach dem Laden. */
  assignedTechnicianId?: string | null,
): Promise<WeekTaskItem[]> {
  return withSlowLog("weekTasksFromAppointmentRange", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const techFilter =
      assignedTechnicianId && assignedTechnicianId.length > 0 ? assignedTechnicianId : null;

    const { data: rpcData, error: rpcError } = await supabase.rpc("calendar_range_tasks_for_org", {
      p_range_start: rangeStartIso,
      p_range_end: rangeEndIso,
      p_technician_id: techFilter,
    });

    if (!rpcError && rpcData != null) {
      const rows = rpcData as Array<{
        appointmentId: string;
        startsAt: string;
        endsAt: string;
        kind: WeekTaskItem["kind"];
        projectId: string;
        projectTitle: string;
        projectStatus: string;
        assignedTechnicianId: string | null;
        technicianName: string | null;
        calendarColor: string | null;
        assignedTechnicianId2: string | null;
        technicianName2: string | null;
        calendarColor2: string | null;
        tenantDisplay: string | null;
        serviceStreet: string | null;
        servicePostalCode: string | null;
        serviceCity: string | null;
      }>;

      return rows
        .map((row) => {
          const displayTitle = String(row.projectTitle ?? "").trim();
          if (!displayTitle) return null;
          const tid = row.assignedTechnicianId;
          const tid2 = row.assignedTechnicianId2;
          const addrShort = formatServiceAddressFields({
            serviceStreet: row.serviceStreet,
            servicePostalCode: row.servicePostalCode,
            serviceCity: row.serviceCity,
          });
          return {
            appointmentId: row.appointmentId,
            startsAt: row.startsAt,
            endsAt: row.endsAt,
            kind: row.kind,
            projectId: row.projectId,
            projectTitle: displayTitle,
            projectStatus: row.projectStatus as ProjectStatus,
            assignedTechnicianId: tid,
            technicianName: row.technicianName ?? null,
            calendarColor: resolveCalendarColor(row.calendarColor ?? null, tid),
            assignedTechnicianId2: tid2,
            technicianName2: row.technicianName2 ?? null,
            calendarColor2: tid2 ? resolveCalendarColor(row.calendarColor2 ?? null, tid2) : null,
            tenantDisplay: row.tenantDisplay ?? null,
            serviceAddressShort: addrShort === "—" ? null : addrShort,
          };
        })
        .filter((x): x is WeekTaskItem => x !== null);
    }

    if (rpcError) {
      console.warn(
        JSON.stringify({
          type: "calendar_range_rpc_fallback",
          message: rpcError.message,
        }),
      );
    }

    let q = supabase
      .from("appointments")
      .select(
        `
      id,
      project_id,
      kind,
      starts_at,
      ends_at,
      assigned_technician_id,
      assigned_technician_id_2,
      projects (
        id,
        title,
        status,
        tenant_name,
        service_street,
        service_postal_code,
        service_city,
        service_country
      )
    `,
      )
      .gte("starts_at", rangeStartIso)
      .lte("starts_at", rangeEndIso);
    if (assignedTechnicianId) {
      q = q.or(
        `assigned_technician_id.eq.${assignedTechnicianId},assigned_technician_id_2.eq.${assignedTechnicianId}`,
      );
    }
    const { data, error } = await q.order("starts_at", { ascending: true });

    if (error || !data?.length) return [];

    const rows = data as OfficeCalendarAppointmentRow[];

    const techIds = [
      ...new Set(
        rows.flatMap((r) => [r.assigned_technician_id, r.assigned_technician_id_2]).filter(Boolean),
      ),
    ] as string[];
    const techMap = new Map<string, { display_name: string | null; calendar_color: string | null }>();
    if (techIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, calendar_color")
        .in("id", techIds);
      for (const p of profs ?? []) {
        const r = p as { id: string; display_name: string | null; calendar_color: string | null };
        techMap.set(r.id, { display_name: r.display_name, calendar_color: r.calendar_color });
      }
    }

    return rows
      .map((row) => {
        const raw = row.projects;
        const pr = Array.isArray(raw) ? raw[0] : raw;
        if (!pr) return null;
        const tid = row.assigned_technician_id;
        const tp = tid ? techMap.get(tid) : undefined;
        const tid2 = row.assigned_technician_id_2;
        const tp2 = tid2 ? techMap.get(tid2) : undefined;
        const tenantRaw = pr.tenant_name != null ? String(pr.tenant_name).trim() : "";
        const displayTitle = tenantRaw || String(pr.title ?? "").trim();
        if (!displayTitle) return null;
        const addrShort = formatServiceAddressFields({
          serviceStreet: pr.service_street,
          servicePostalCode: pr.service_postal_code,
          serviceCity: pr.service_city,
        });
        return {
          appointmentId: row.id,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          kind: row.kind,
          projectId: row.project_id,
          projectTitle: displayTitle,
          projectStatus: pr.status as ProjectStatus,
          assignedTechnicianId: tid,
          technicianName: tp?.display_name ?? null,
          calendarColor: resolveCalendarColor(tp?.calendar_color ?? null, tid),
          assignedTechnicianId2: tid2,
          technicianName2: tp2?.display_name ?? null,
          calendarColor2: tid2 ? resolveCalendarColor(tp2?.calendar_color ?? null, tid2) : null,
          tenantDisplay: tenantRaw || null,
          serviceAddressShort: addrShort === "—" ? null : addrShort,
        };
      })
      .filter((x): x is WeekTaskItem => x !== null);
  });
}

/** Büro-Kalender: Termine mit `starts_at` im halboffenen Bereich (über ISO-Strings, inkl. Enden). */
export const listCalendarRangeTasks = cache(async function listCalendarRangeTasks(
  rangeStartIso: string,
  rangeEndIso: string,
  assignedTechnicianId?: string | null,
): Promise<WeekTaskItem[]> {
  return weekTasksFromAppointmentRange(rangeStartIso, rangeEndIso, assignedTechnicianId);
});

export const listWeekTasks = cache(async function listWeekTasks(
  referenceDate = new Date(),
  /** Monteur: nur eigene Termine schon in SQL filtern (primitiv für `cache`-Tupel). */
  assignedTechnicianId?: string,
): Promise<WeekTaskItem[]> {
  const { start, end } = getWeekBounds(referenceDate);
  return listCalendarRangeTasks(start.toISOString(), end.toISOString(), assignedTechnicianId);
});

export const listMonthTasks = cache(async function listMonthTasks(year: number, month: number): Promise<WeekTaskItem[]> {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return listCalendarRangeTasks(start.toISOString(), end.toISOString());
});

const ABSENCE_DB_COLUMNS =
  "id, organization_id, technician_id, starts_at, ends_at, kind, note, created_at";

function isAbsenceKind(v: unknown): v is TechnicianAbsenceKind {
  return v === "ferien" || v === "krank" || v === "blocker";
}

function mapAbsenceRow(
  row: Record<string, unknown>,
  techNameById: Map<string, string | null>,
): TechnicianAbsence | null {
  const kind = row.kind;
  if (!isAbsenceKind(kind)) return null;
  const tid = String(row.technician_id);
  return {
    id: String(row.id),
    technicianId: tid,
    technicianName: techNameById.get(tid) ?? null,
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    kind,
    note: row.note != null ? String(row.note) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

/** Abwesenheiten, die mit dem Bereich [rangeStartIso, rangeEndIso] überlappen. */
export const listTechnicianAbsencesInRange = cache(async function listTechnicianAbsencesInRange(
  rangeStartIso: string,
  rangeEndIso: string,
  technicianId?: string | null,
): Promise<TechnicianAbsence[]> {
  return withSlowLog("listTechnicianAbsencesInRange", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const orgId = await getCachedCurrentOrganizationId();
    if (!orgId) return [];

    let q = supabase
      .from("technician_absences")
      .select(ABSENCE_DB_COLUMNS)
      .eq("organization_id", orgId)
      .lt("starts_at", rangeEndIso)
      .gt("ends_at", rangeStartIso);
    if (technicianId) q = q.eq("technician_id", technicianId);

    const { data, error } = await q.order("starts_at", { ascending: true });
    if (error || !data) return [];

    const rows = data as Record<string, unknown>[];
    const techIds = [...new Set(rows.map((r) => String(r.technician_id)).filter(Boolean))];
    const nameMap = new Map<string, string | null>();
    if (techIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", techIds);
      for (const p of profs ?? []) {
        const r = p as { id: string; display_name: string | null };
        nameMap.set(r.id, r.display_name ?? null);
      }
    }

    return rows
      .map((r) => mapAbsenceRow(r, nameMap))
      .filter((x): x is TechnicianAbsence => x !== null);
  });
});

function isTeamRole(v: unknown): v is TeamMemberListItem["role"] {
  return v === "admin" || v === "office" || v === "technician";
}

async function buildEmailByUserIdMap(userIds: string[]): Promise<Map<string, string>> {
  const emailByUserId = new Map<string, string>();
  if (userIds.length === 0) return emailByUserId;

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return emailByUserId;

  const wanted = new Set(userIds);
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    for (const user of data.users) {
      if (user.id && user.email && wanted.has(user.id)) {
        emailByUserId.set(user.id, user.email);
      }
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return emailByUserId;
}

function mapRpcTeamMemberRow(raw: Record<string, unknown>): TeamMemberListItem | null {
  const roleRaw = raw.role;
  if (!isTeamRole(roleRaw)) return null;
  const status = raw.status === "eingeladen" ? "eingeladen" : raw.status === "aktiv" ? "aktiv" : null;
  if (!status) return null;
  const userId = raw.userId != null ? String(raw.userId) : null;
  const email = String(raw.email ?? "—");
  const displayName = String(raw.displayName ?? "").trim() || email.split("@")[0] || "Mitarbeiter";
  const avatarRaw = raw.avatarUrl;
  const avatarUrl =
    avatarRaw != null && String(avatarRaw).trim() !== "" ? String(avatarRaw).trim() : null;
  return {
    key: String(raw.key ?? ""),
    userId,
    displayName,
    email,
    role: roleRaw,
    status,
    createdAt: raw.createdAt != null ? String(raw.createdAt) : null,
    avatarUrl,
  };
}

function mapRpcAbsenceRow(raw: Record<string, unknown>): TechnicianAbsence | null {
  const kind = raw.kind;
  if (!isAbsenceKind(kind)) return null;
  return {
    id: String(raw.id ?? ""),
    technicianId: String(raw.technicianId ?? ""),
    technicianName: raw.technicianName != null ? String(raw.technicianName) : null,
    startsAt: String(raw.startsAt ?? ""),
    endsAt: String(raw.endsAt ?? ""),
    kind,
    note: raw.note != null ? String(raw.note) : null,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

export const listTeamMembersForOrg = cache(async function listTeamMembersForOrg(
  organizationId: string,
): Promise<TeamMemberListItem[]> {
  return withSlowLog("listTeamMembersForOrg", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const [membershipsResult, invitationsResult] = await Promise.all([
      supabase
        .from("organization_memberships")
        .select("user_id, role, is_active, created_at, profiles(display_name, avatar_url)")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("invitations")
        .select("id, email, role, created_at")
        .eq("organization_id", organizationId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false }),
    ]);

    const memberships = (membershipsResult.data as Array<{
      user_id: string;
      role: TeamMemberListItem["role"];
      created_at: string | null;
      profiles?:
        | { display_name?: string | null; avatar_url?: string | null }
        | Array<{ display_name?: string | null; avatar_url?: string | null }>
        | null;
    }> | null) ?? [];
    const invitations = (invitationsResult.data as Array<{
      id: string;
      email: string;
      role: TeamMemberListItem["role"];
      created_at: string | null;
    }> | null) ?? [];

    const emailByUserId = await buildEmailByUserIdMap(memberships.map((m) => m.user_id));

    const activeItems: TeamMemberListItem[] = memberships.map((m) => {
      const profileRaw = Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles ?? null;
      const displayName = String(profileRaw?.display_name ?? "").trim();
      const email = emailByUserId.get(m.user_id) ?? "—";
      const rawAvatar = profileRaw?.avatar_url;
      const avatarUrl = rawAvatar != null && String(rawAvatar).trim() !== "" ? String(rawAvatar).trim() : null;
      return {
        key: `member:${m.user_id}`,
        userId: m.user_id,
        displayName: displayName || email.split("@")[0] || "Mitarbeiter",
        email,
        role: m.role,
        status: "aktiv",
        createdAt: m.created_at ?? null,
        avatarUrl,
      };
    });

    const pendingItems: TeamMemberListItem[] = invitations.map((inv) => ({
      key: `invite:${inv.id}`,
      userId: null,
      displayName: inv.email.split("@")[0] || "Einladung",
      email: inv.email,
      role: inv.role,
      status: "eingeladen",
      createdAt: inv.created_at ?? null,
      avatarUrl: null,
    }));

    return [...activeItems, ...pendingItems];
  });
});

export type MitarbeiterOfficeBootstrapResult = {
  team: TeamMemberListItem[];
  absences: TechnicianAbsence[];
};

export const loadMitarbeiterOfficeBootstrap = cache(async function loadMitarbeiterOfficeBootstrap(
  organizationId: string,
): Promise<MitarbeiterOfficeBootstrapResult | null> {
  return withSlowLog("loadMitarbeiterOfficeBootstrap", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase.rpc("mitarbeiter_office_bootstrap", {
      p_org_id: organizationId,
    });

    if (error || data == null || typeof data !== "object") {
      if (error) {
        console.warn(
          JSON.stringify({
            type: "mitarbeiter_bootstrap_rpc_fallback",
            message: error.message,
          }),
        );
      }
      return null;
    }

    const payload = data as Record<string, unknown>;
    const teamRaw = payload.team;
    const absencesRaw = payload.absences;
    const team = Array.isArray(teamRaw)
      ? teamRaw
          .map((row) => mapRpcTeamMemberRow(row as Record<string, unknown>))
          .filter((x): x is TeamMemberListItem => x !== null && x.key.length > 0)
      : [];
    const absences = Array.isArray(absencesRaw)
      ? absencesRaw
          .map((row) => mapRpcAbsenceRow(row as Record<string, unknown>))
          .filter((x): x is TechnicianAbsence => x !== null)
      : [];

    return { team, absences };
  });
});

export async function loadMitarbeiterBootstrapData(
  organizationId: string,
): Promise<MitarbeiterOfficeBootstrapResult> {
  const rpcResult = await loadMitarbeiterOfficeBootstrap(organizationId);
  if (rpcResult) return rpcResult;

  const [team, absences] = await Promise.all([
    listTeamMembersForOrg(organizationId),
    listAllTechnicianAbsencesForOrg(organizationId),
  ]);
  return { team, absences };
}

/** Alle Abwesenheiten der Organisation (alle Zeiträume). */
export const listAllTechnicianAbsencesForOrg = cache(async function listAllTechnicianAbsencesForOrg(
  organizationId: string,
  technicianId?: string | null,
): Promise<TechnicianAbsence[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  let q = supabase
    .from("technician_absences")
    .select(ABSENCE_DB_COLUMNS)
    .eq("organization_id", organizationId);
  if (technicianId) q = q.eq("technician_id", technicianId);

  const { data, error } = await q.order("starts_at", { ascending: false });
  if (error || !data) return [];

  const rows = data as Record<string, unknown>[];
  const techIds = [...new Set(rows.map((r) => String(r.technician_id)).filter(Boolean))];
  const nameMap = new Map<string, string | null>();
  if (techIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", techIds);
    for (const p of profs ?? []) {
      const r = p as { id: string; display_name: string | null };
      nameMap.set(r.id, r.display_name ?? null);
    }
  }

  return rows
    .map((r) => mapAbsenceRow(r, nameMap))
    .filter((x): x is TechnicianAbsence => x !== null);
});

export const listAllTechnicianAbsences = cache(async function listAllTechnicianAbsences(
  technicianId?: string | null,
): Promise<TechnicianAbsence[]> {
  const orgId = await getCachedCurrentOrganizationId();
  if (!orgId) return [];
  return listAllTechnicianAbsencesForOrg(orgId, technicianId);
});

export type TechnicianAbsenceCreateInput = {
  technicianId: string;
  startsAt: string;
  endsAt: string;
  kind: TechnicianAbsenceKind;
  note: string | null;
};

export async function createTechnicianAbsence(
  input: TechnicianAbsenceCreateInput,
  createdByProfileId: string | null,
): Promise<TechnicianAbsence> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase nicht verfügbar.");
  }
  const orgId = await getCachedCurrentOrganizationId();
  if (!orgId) throw new Error("Keine Organisation.");

  const { data, error } = await supabase
    .from("technician_absences")
    .insert({
      organization_id: orgId,
      technician_id: input.technicianId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      kind: input.kind,
      note: input.note ?? null,
      created_by: createdByProfileId,
    })
    .select(ABSENCE_DB_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Abwesenheit konnte nicht gespeichert werden.");
  }

  const techNameMap = new Map<string, string | null>();
  const { data: prof } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", input.technicianId)
    .maybeSingle();
  if (prof) {
    const r = prof as { id: string; display_name: string | null };
    techNameMap.set(r.id, r.display_name ?? null);
  }
  const mapped = mapAbsenceRow(data as Record<string, unknown>, techNameMap);
  if (!mapped) throw new Error("Unerwartetes Format.");
  return mapped;
}

export async function deleteTechnicianAbsence(absenceId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("technician_absences")
    .delete()
    .eq("id", absenceId);
  if (error) throw new Error(error.message);
}

const TIME_ENTRY_DB_COLUMNS =
  "id, organization_id, user_id, entry_date, starts_at, ends_at, hours, note, created_at, updated_at";

function normalizeTimeOfDay(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function mapTimeEntryRow(
  row: Record<string, unknown>,
  nameById: Map<string, string | null>,
): TimeEntry {
  const uid = String(row.user_id);
  return {
    id: String(row.id),
    userId: uid,
    userDisplayName: nameById.get(uid) ?? null,
    entryDate: String(row.entry_date),
    startsAt: normalizeTimeOfDay(row.starts_at),
    endsAt: normalizeTimeOfDay(row.ends_at),
    hours: Number(row.hours ?? 0),
    note: row.note != null ? String(row.note) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

async function nameMapForUserIds(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const nameMap = new Map<string, string | null>();
  if (userIds.length === 0) return nameMap;
  const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
  for (const p of profs ?? []) {
    const r = p as { id: string; display_name: string | null };
    nameMap.set(r.id, r.display_name ?? null);
  }
  return nameMap;
}

/** Eigene Zeiterfassungs-Einträge im Datumsbereich [startDate, endDate] (inklusive, YYYY-MM-DD). */
export const listTimeEntriesForUser = cache(async function listTimeEntriesForUser(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<TimeEntry[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const orgId = await getCachedCurrentOrganizationId();
  if (!orgId) return [];

  const { data, error } = await supabase
    .from("time_entries")
    .select(TIME_ENTRY_DB_COLUMNS)
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .gte("entry_date", startDate)
    .lte("entry_date", endDate)
    .order("entry_date", { ascending: false });
  if (error || !data) return [];

  const rows = data as Record<string, unknown>[];
  const nameMap = await nameMapForUserIds(supabase, [userId]);
  return rows.map((r) => mapTimeEntryRow(r, nameMap));
});

/** Alle Zeiterfassungs-Einträge der Organisation im Datumsbereich (Team-Übersicht, Office/Admin). */
export const listTimeEntriesForOrg = cache(async function listTimeEntriesForOrg(
  organizationId: string,
  startDate: string,
  endDate: string,
): Promise<TimeEntry[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("time_entries")
    .select(TIME_ENTRY_DB_COLUMNS)
    .eq("organization_id", organizationId)
    .gte("entry_date", startDate)
    .lte("entry_date", endDate)
    .order("entry_date", { ascending: false });
  if (error || !data) return [];

  const rows = data as Record<string, unknown>[];
  const userIds = [...new Set(rows.map((r) => String(r.user_id)).filter(Boolean))];
  const nameMap = await nameMapForUserIds(supabase, userIds);
  return rows.map((r) => mapTimeEntryRow(r, nameMap));
});

export type TimeEntryCreateInput = {
  entryDate: string;
  startsAt: string | null;
  endsAt: string | null;
  hours: number;
  note: string | null;
};

export async function createTimeEntry(
  input: TimeEntryCreateInput,
  userId: string,
  createdByProfileId: string | null,
): Promise<TimeEntry> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");
  const orgId = await getCachedCurrentOrganizationId();
  if (!orgId) throw new Error("Keine Organisation.");

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      organization_id: orgId,
      user_id: userId,
      entry_date: input.entryDate,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      hours: input.hours,
      note: input.note ?? null,
      created_by: createdByProfileId,
    })
    .select(TIME_ENTRY_DB_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Eintrag konnte nicht gespeichert werden.");
  }

  const nameMap = await nameMapForUserIds(supabase, [userId]);
  return mapTimeEntryRow(data as Record<string, unknown>, nameMap);
}

export type TimeEntryUpdateInput = Partial<TimeEntryCreateInput>;

export async function updateTimeEntry(
  timeEntryId: string,
  patch: TimeEntryUpdateInput,
): Promise<TimeEntry> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht verfügbar.");

  const row: Record<string, unknown> = {};
  if (patch.entryDate !== undefined) row.entry_date = patch.entryDate;
  if (patch.startsAt !== undefined) row.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) row.ends_at = patch.endsAt;
  if (patch.hours !== undefined) row.hours = patch.hours;
  if (patch.note !== undefined) row.note = patch.note;

  const { data, error } = await supabase
    .from("time_entries")
    .update(row)
    .eq("id", timeEntryId)
    .select(TIME_ENTRY_DB_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Eintrag nicht gefunden.");

  const userId = String((data as Record<string, unknown>).user_id);
  const nameMap = await nameMapForUserIds(supabase, [userId]);
  return mapTimeEntryRow(data as Record<string, unknown>, nameMap);
}

export async function deleteTimeEntry(timeEntryId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  const { error } = await supabase.from("time_entries").delete().eq("id", timeEntryId);
  if (error) throw new Error(error.message);
}

/** Verfügbarkeits-Ansicht: Termine + Abwesenheiten + Monteur-Stammdaten in einem Roundtrip-Bündel. */
export const listAvailabilityForRange = cache(async function listAvailabilityForRange(
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<{
  technicians: UserProfile[];
  appointments: WeekTaskItem[];
  absences: TechnicianAbsence[];
  externalBusy: BusyBlock[];
}> {
  const orgId = await getCachedCurrentOrganizationId();
  const [technicians, appointments, absences, busyRows] = await Promise.all([
    listAssignableProfiles(),
    listCalendarRangeTasks(rangeStartIso, rangeEndIso),
    listTechnicianAbsencesInRange(rangeStartIso, rangeEndIso),
    orgId ? getBusyEventsForOrgRange(orgId, rangeStartIso, rangeEndIso) : Promise.resolve([]),
  ]);
  const externalBusy: BusyBlock[] = busyRows.map((r) => ({
    technicianId: r.technicianId,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
  }));
  return { technicians, appointments, absences, externalBusy };
});

export const listAssignableProfiles = cache(async function listAssignableProfiles(
  organizationId?: string | null,
): Promise<UserProfile[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockProfiles.filter((p) => p.role === "technician" || p.role === "admin" || p.role === "office");
  }
  const orgId = organizationId ?? (await getCachedCurrentOrganizationId());
  if (!orgId) return [];
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("user_id, profiles!inner(id, display_name, role, avatar_url, calendar_color, calendar_position)")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .in("role", ["technician", "admin", "office"]);
  if (error || !data) return [];
  const out: UserProfile[] = [];
  for (const row of data as { user_id: string; profiles: Record<string, unknown> | Record<string, unknown>[] }[]) {
    const pr = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!pr) continue;
    const role = isRoleType(pr.role) ? pr.role : "technician";
    out.push({
      id: String(pr.id),
      displayName: String(pr.display_name ?? ""),
      email: "",
      role,
      avatarUrl: pr.avatar_url != null ? String(pr.avatar_url) : null,
      calendarColor: pr.calendar_color != null ? String(pr.calendar_color) : "#6366f1",
      calendarPosition: typeof pr.calendar_position === "number" ? pr.calendar_position : 0,
    });
  }
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName, "de-CH"));
});

export const listProfilesByRole = cache(async function listProfilesByRole(role: RoleType): Promise<UserProfile[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockProfiles.filter((p) => p.role === role);
  }
  const orgId = await getCachedCurrentOrganizationId();
  if (!orgId) {
    return [];
  }
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("user_id, profiles!inner(id, display_name, role, avatar_url, calendar_color, calendar_position)")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .eq("role", role);

  if (error || !data) {
    return [];
  }

  const out: UserProfile[] = [];
  for (const row of data as { user_id: string; profiles: Record<string, unknown> | Record<string, unknown>[] }[]) {
    const pr = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!pr) continue;
    out.push({
      id: String(pr.id),
      displayName: String(pr.display_name ?? ""),
      email: "",
      role: isRoleType(pr.role) ? pr.role : role,
      avatarUrl: pr.avatar_url != null ? String(pr.avatar_url) : null,
      calendarColor: pr.calendar_color != null ? String(pr.calendar_color) : null,
      calendarPosition: Number(pr.calendar_position ?? 0),
    });
  }
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName, "de-CH"));
});

export type ProjectCreateInput = Omit<
  Project,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "closedAt"
  | "referenceCode"
  | "statusUpdateSource"
  | "statusRevertOnAppointmentClear"
  | "warrantyNote"
  | "warrantyOpenedAt"
  | "warrantyOpenedByUserId"
  | "warrantyOpenedByDisplayName"
> & { referenceCode?: string | null };

export async function createProject(input: ProjectCreateInput): Promise<Project> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const now = new Date().toISOString();
    const p: Project = {
      ...input,
      id: id("p"),
      referenceCode: input.referenceCode?.trim() || `${new Date().getFullYear()}-1001`,
      createdAt: now,
      updatedAt: now,
      closedAt: null,
      statusUpdateSource: null,
      statusRevertOnAppointmentClear: null,
      warrantyNote: null,
      warrantyOpenedAt: null,
      warrantyOpenedByUserId: null,
      warrantyOpenedByDisplayName: null,
    };
    mockProjects.push(p);
    return p;
  }

  const orgId = (await getCachedCurrentOrganizationId()) ?? input.organizationId;
  if (!orgId) {
    throw new Error("Keine Organisation.");
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      organization_id: orgId,
    title: input.title,
    type: input.type,
    status: input.status,
    next_owner_role: input.nextOwnerRole,
    next_owner_user_id: input.nextOwnerUserId,
    source: input.source,
    intake_original_text: input.intakeOriginalText,
    access_notes: input.accessNotes,
    hints_and_notes: input.hintsAndNotes,
      tenant_name: input.tenantName,
      tenant_phone: input.tenantPhone,
      tenant_email: input.tenantEmail,
      management_name: input.managementName,
      management_phone: input.managementPhone,
      management_email: input.managementEmail,
      cost_ceiling_text: input.costCeilingText,
      service_street: input.serviceStreet,
      service_postal_code: input.servicePostalCode,
      service_city: input.serviceCity,
      service_country: input.serviceCountry ?? "CH",
      reference_code: input.referenceCode?.trim() || null,
      status_updated_source: null,
    })
    .select(PROJECT_DB_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Auftrag konnte nicht erstellt werden.");
  }
  return mapProjectRow(data as Record<string, unknown>);
}

export type ProjectPatch = Partial<
  Pick<
    Project,
    | "title"
    | "status"
    | "nextOwnerUserId"
    | "intakeOriginalText"
    | "accessNotes"
    | "hintsAndNotes"
    | "tenantName"
    | "tenantPhone"
    | "tenantEmail"
    | "managementName"
    | "managementPhone"
    | "managementEmail"
    | "costCeilingText"
    | "serviceStreet"
    | "servicePostalCode"
    | "serviceCity"
    | "serviceCountry"
    | "statusUpdateSource"
    | "statusRevertOnAppointmentClear"
    | "warrantyNote"
    | "warrantyOpenedAt"
    | "warrantyOpenedByUserId"
    | "warrantyOpenedByDisplayName"
  >
>;

export async function updateProject(projectId: string, patch: ProjectPatch): Promise<Project> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const p = mockProjects.find((x) => x.id === projectId);
    if (!p) throw new Error("Projekt nicht gefunden.");
    const priorStatus = p.status;
    if (patch.status !== undefined && patch.status !== p.status) {
      assertAllowedProjectStatusTransition(p.status, patch.status);
    }
    Object.assign(p, patch);
    p.updatedAt = new Date().toISOString();
    if (patch.status !== undefined && patch.status !== "abgeschlossen" && priorStatus === "abgeschlossen") {
      p.closedAt = null;
    }
    if (
      patch.status !== undefined &&
      patch.status !== priorStatus &&
      patch.statusUpdateSource !== "manual"
    ) {
      const promoted = await promoteToAbgemachtIfUpcomingAppointment(projectId, p.status);
      if (promoted) return promoted;
    }
    return p;
  }

  let priorStatus: ProjectStatus | undefined;
  if (patch.status !== undefined) {
    const { data: currentRow, error: currentErr } = await supabase
      .from("projects")
      .select("status")
      .eq("id", projectId)
      .maybeSingle();
    if (currentErr) throw new Error(currentErr.message);
    if (!currentRow) throw new Error("Projekt nicht gefunden.");
    priorStatus = (currentRow.status as ProjectStatus | undefined) ?? "offen";
    if (patch.status !== priorStatus) {
      assertAllowedProjectStatusTransition(priorStatus, patch.status);
    }
  }

  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.nextOwnerUserId !== undefined) row.next_owner_user_id = patch.nextOwnerUserId;
  if (patch.intakeOriginalText !== undefined) row.intake_original_text = patch.intakeOriginalText;
  if (patch.accessNotes !== undefined) row.access_notes = patch.accessNotes;
  if (patch.hintsAndNotes !== undefined) row.hints_and_notes = patch.hintsAndNotes;
  if (patch.tenantName !== undefined) row.tenant_name = patch.tenantName;
  if (patch.tenantPhone !== undefined) row.tenant_phone = patch.tenantPhone;
  if (patch.tenantEmail !== undefined) row.tenant_email = patch.tenantEmail;
  if (patch.managementName !== undefined) row.management_name = patch.managementName;
  if (patch.managementPhone !== undefined) row.management_phone = patch.managementPhone;
  if (patch.managementEmail !== undefined) row.management_email = patch.managementEmail;
  if (patch.costCeilingText !== undefined) row.cost_ceiling_text = patch.costCeilingText;
  if (patch.serviceStreet !== undefined) row.service_street = patch.serviceStreet;
  if (patch.servicePostalCode !== undefined) row.service_postal_code = patch.servicePostalCode;
  if (patch.serviceCity !== undefined) row.service_city = patch.serviceCity;
  if (patch.serviceCountry !== undefined) row.service_country = patch.serviceCountry;
  if (patch.statusUpdateSource !== undefined) row.status_updated_source = patch.statusUpdateSource;
  if (patch.statusRevertOnAppointmentClear !== undefined) {
    row.status_revert_on_appointment_clear = patch.statusRevertOnAppointmentClear;
  }
  if (patch.warrantyNote !== undefined) row.warranty_note = patch.warrantyNote;
  if (patch.warrantyOpenedAt !== undefined) row.warranty_opened_at = patch.warrantyOpenedAt;
  if (patch.warrantyOpenedByUserId !== undefined) row.warranty_opened_by = patch.warrantyOpenedByUserId;
  if (patch.warrantyOpenedByDisplayName !== undefined) {
    row.warranty_opened_by_display_name = patch.warrantyOpenedByDisplayName;
  }
  if (patch.statusUpdateSource === "manual") {
    row.status_revert_on_appointment_clear = null;
  }
  if (patch.status === "abgeschlossen") {
    row.closed_at = new Date().toISOString();
  } else if (patch.status !== undefined && priorStatus === "abgeschlossen") {
    row.closed_at = null;
  }

  const { data, error } = await supabase
    .from("projects")
    .update(row)
    .eq("id", projectId)
    .select(PROJECT_DB_COLUMNS)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) throw new Error("Projekt nicht gefunden.");
  const result = mapProjectRow(data as Record<string, unknown>);
  // Auto-Promotion auf «abgemacht» nur für automatisierte Statuswechsel.
  // Manuelle Wechsel (Büro-«Setzen», Stammdaten, Rapport-nextStatus) gewinnen —
  // sonst wird die Nutzerwahl bei bevorstehendem Termin still zurückgestellt.
  if (
    patch.status !== undefined &&
    priorStatus !== undefined &&
    patch.status !== priorStatus &&
    patch.statusUpdateSource !== "manual"
  ) {
    const promoted = await promoteToAbgemachtIfUpcomingAppointment(projectId, result.status);
    if (promoted) return promoted;
  }
  return result;
}

async function projectHasUpcomingAppointment(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  projectId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .gte("ends_at", now);
  return (count ?? 0) > 0;
}

async function promoteToAbgemachtIfUpcomingAppointment(
  projectId: string,
  currentStatus: ProjectStatus,
  appointmentIsUpcoming?: boolean,
): Promise<Project | null> {
  let hasUpcoming = appointmentIsUpcoming;
  if (hasUpcoming === undefined) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      const now = new Date().toISOString();
      hasUpcoming = mockAppointments.some(
        (a) => a.projectId === projectId && a.endsAt >= now,
      );
    } else {
      hasUpcoming = await projectHasUpcomingAppointment(supabase, projectId);
    }
  }
  const nextStatus = nextProjectStatusAfterAppointmentBooked(currentStatus, {
    appointmentIsUpcoming: hasUpcoming,
  });
  if (nextStatus === null || nextStatus === currentStatus) {
    return null;
  }
  return updateProject(projectId, {
    status: nextStatus,
    statusUpdateSource: "appointment_automation",
    statusRevertOnAppointmentClear: currentStatus,
  });
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus): Promise<Project> {
  return updateProject(projectId, { status, statusUpdateSource: "manual" });
}

/** Projekt archivieren (Soft): raus aus der aktiven Liste, wiederherstellbar. */
export async function archiveProject(projectId: string, archivedBy: string | null): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString(), archived_by: archivedBy })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
}

/** Archiviertes Projekt wiederherstellen (zurück in die aktive Liste). */
export async function restoreProject(projectId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: null, archived_by: null })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
}

/** Endgültiges Löschen (Hard-Delete, Kaskade). Bewusster Extra-Schritt (nur Admin). */
export async function deleteProject(projectId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockProjects.findIndex((p) => p.id === projectId);
    if (idx !== -1) mockProjects.splice(idx, 1);
    return;
  }
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);
}

/** Ferien blockiert eine Terminbuchung hart — Krank/Blocker bleiben nur eine Warnung (UI). */
async function assertNoFerienConflict(
  technicianId: string | null | undefined,
  startsAt: string,
  endsAt: string,
): Promise<void> {
  if (!technicianId) return;
  const absences = await listTechnicianAbsencesInRange(startsAt, endsAt, technicianId);
  if (absences.some((a) => a.kind === "ferien")) {
    throw new Error("Diese Person ist in diesem Zeitraum in den Ferien.");
  }
}

export async function addAppointment(input: Omit<Appointment, "id" | "createdAt">): Promise<Appointment> {
  if (!input.assignedTechnicianId?.trim()) {
    throw new Error("Bitte eine zuständige Person wählen.");
  }
  await assertNoFerienConflict(input.assignedTechnicianId, input.startsAt, input.endsAt);
  await assertNoFerienConflict(input.assignedTechnicianId2, input.startsAt, input.endsAt);
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const appointmentIsUpcoming = appointmentEndsInFutureOrNow(input.endsAt);
    const a: Appointment = { ...input, id: id("a"), createdAt: new Date().toISOString() };
    mockAppointments.push(a);
    const mockP = mockProjects.find((p) => p.id === input.projectId);
    if (mockP) {
      await promoteToAbgemachtIfUpcomingAppointment(
        input.projectId,
        mockP.status,
        appointmentIsUpcoming,
      );
    }
    return a;
  }

  const appointmentIsUpcoming = appointmentEndsInFutureOrNow(input.endsAt);

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      project_id: input.projectId,
      kind: input.kind,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      assigned_technician_id: input.assignedTechnicianId,
      assigned_technician_id_2: input.assignedTechnicianId2,
      planning_notes: input.planningNotes,
    })
    .select(APPOINTMENT_DB_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Termin konnte nicht gespeichert werden.");

  const { data: statusRow } = await supabase.from("projects").select("status").eq("id", input.projectId).maybeSingle();
  const currentStatus = (statusRow?.status as ProjectStatus | undefined) ?? "offen";
  await promoteToAbgemachtIfUpcomingAppointment(input.projectId, currentStatus, appointmentIsUpcoming);

  return mapAppointmentRow(data as Record<string, unknown>);
}

export async function reassignAppointmentTechnician(
  appointmentId: string,
  projectId: string,
  assignedTechnicianId: string | null,
  slot: 1 | 2 = 1,
): Promise<void> {
  if (slot === 1 && !assignedTechnicianId?.trim()) {
    throw new Error("Bitte eine zuständige Person wählen.");
  }
  const column = slot === 2 ? "assignedTechnicianId2" : "assignedTechnicianId";
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const appt = mockAppointments.find((a) => a.id === appointmentId && a.projectId === projectId);
    if (!appt) throw new Error("Termin nicht gefunden.");
    await assertNoFerienConflict(assignedTechnicianId, appt.startsAt, appt.endsAt);
    appt[column] = assignedTechnicianId;
    return;
  }

  const { data: apptRow, error: apptError } = await supabase
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("id", appointmentId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (apptError) throw new Error(apptError.message);
  if (!apptRow) throw new Error("Termin nicht gefunden.");
  await assertNoFerienConflict(
    assignedTechnicianId,
    String(apptRow.starts_at),
    String(apptRow.ends_at),
  );

  const dbColumn = slot === 2 ? "assigned_technician_id_2" : "assigned_technician_id";
  const { data, error } = await supabase
    .from("appointments")
    .update({ [dbColumn]: assignedTechnicianId })
    .eq("id", appointmentId)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Termin nicht gefunden.");
}

export async function deleteAppointment(appointmentId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    // Mock: remove appointment, then check if project still has upcoming appointments
    const idx = mockAppointments.findIndex((a) => a.id === appointmentId);
    if (idx === -1) return;
    const projectId = mockAppointments[idx].projectId;
    mockAppointments.splice(idx, 1);
    const mockP = mockProjects.find((p) => p.id === projectId);
    if (mockP) {
      const now = new Date().toISOString();
      const hasUpcoming = mockAppointments.some((a) => a.projectId === projectId && a.endsAt >= now);
      if (!hasUpcoming) {
        const revert = projectStatusAfterLastAppointmentDeleted(
          mockP.status,
          mockP.statusRevertOnAppointmentClear,
        );
        const canRevert = mockP.statusUpdateSource === "appointment_automation";
        if (revert !== null && canRevert) {
          mockP.status = revert;
          mockP.statusRevertOnAppointmentClear = null;
          mockP.statusUpdateSource = "appointment_automation";
          mockP.updatedAt = new Date().toISOString();
        }
      }
    }
    return;
  }

  // Fetch project_id before deleting so we can check afterwards
  const { data: apptRow } = await supabase
    .from("appointments")
    .select("project_id")
    .eq("id", appointmentId)
    .maybeSingle();
  const projectId = (apptRow as { project_id?: string } | null)?.project_id;

  const { error } = await supabase.from("appointments").delete().eq("id", appointmentId);
  if (error) throw new Error(error.message);

  if (!projectId) return;

  // Check if any upcoming appointments remain for this project
  const now = new Date().toISOString();
  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .gte("ends_at", now);

  if ((count ?? 0) === 0) {
    const { data: statusRow } = await supabase
      .from("projects")
      .select("status, status_updated_source, status_revert_on_appointment_clear")
      .eq("id", projectId)
      .maybeSingle();
    const currentStatus = (statusRow?.status as ProjectStatus | undefined) ?? "offen";
    const statusUpdatedSource = (statusRow?.status_updated_source as ProjectStatusUpdateSource | undefined) ?? null;
    const rawRevert = statusRow?.status_revert_on_appointment_clear;
    const revertStatus =
      rawRevert != null && projectStatuses.includes(rawRevert as ProjectStatus)
        ? (rawRevert as ProjectStatus)
        : null;
    const revert = projectStatusAfterLastAppointmentDeleted(currentStatus, revertStatus);
    const canRevert = statusUpdatedSource === "appointment_automation";
    if (revert !== null && revert !== currentStatus && canRevert) {
      await updateProject(projectId, {
        status: revert,
        statusUpdateSource: "appointment_automation",
        statusRevertOnAppointmentClear: null,
      });
    }
  }
}

export async function addProjectAttachment(
  input: Omit<ProjectAttachment, "id" | "createdAt"> & { uploadedBy: string | null },
): Promise<ProjectAttachment> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const a: ProjectAttachment = {
      ...input,
      id: id("att"),
      createdAt: new Date().toISOString(),
    };
    mockProjectAttachments.push(a);
    return a;
  }
  const attachmentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("project_attachments")
    .insert({
      id: attachmentId,
      project_id: input.projectId,
      file_path: input.filePath,
      file_name: input.fileName,
      mime_type: input.fileType,
      size_bytes: input.sizeBytes,
      uploaded_by: input.uploadedBy,
      notes: input.notes ?? null,
    });
  if (error) throw new Error(error.message);
  return { ...input, id: attachmentId, createdAt: now };
}

export async function deleteProjectAttachment(attachmentId: string, filePath: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  await supabase.storage.from("project-files").remove([filePath]);
  const { error } = await supabase.from("project_attachments").delete().eq("id", attachmentId);
  if (error) throw new Error(error.message);
}

export async function updateAttachmentNotes(attachmentId: string, notes: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("project_attachments")
    .update({ notes })
    .eq("id", attachmentId);
  if (error) throw new Error(error.message);
}

export async function signAttachmentUrls(attachments: ProjectAttachment[]): Promise<ProjectAttachment[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase || attachments.length === 0) return attachments;
  const paths = attachments.map((a) => a.filePath);
  const { data, error } = await supabase.storage.from("project-files").createSignedUrls(paths, 3600);
  if (error || !data) return attachments;
  return attachments.map((a, i) => {
    const row = data[i];
    const signedUrl =
      row && !row.error && typeof row.signedUrl === "string" && row.signedUrl.length > 0 ? row.signedUrl : undefined;
    return { ...a, signedUrl };
  });
}

export async function addTechnicianReport(
  input: Omit<
    TechnicianReport,
    "id" | "createdAt" | "orderForms" | "createdByProfileId" | "createdByDisplayName" | "hasSignature"
  >,
  options?: {
    createdByProfileId: string | null;
    orderFormSubmissions?: { templateId: string; valuesJson: Record<string, string> }[];
    /** Vom Monteur/Admin gewählter nächster Schritt (nur bei outcome=schaden_aufgenommen) */
    nextStatus?: RapportNextStep;
  },
): Promise<TechnicianReport> {
  const supabase = await createSupabaseServerClient();
  const authorId = options?.createdByProfileId ?? null;
  if (!supabase) {
    const authorName =
      authorId != null
        ? mockProfiles.find((p) => p.id === authorId)?.displayName?.trim() || null
        : null;
    const r: TechnicianReport = {
      ...input,
      id: id("r"),
      createdAt: new Date().toISOString(),
      orderForms: [],
      createdByProfileId: authorId,
      createdByDisplayName: authorName,
      hasSignature: Boolean(input.signatureDataUrl),
    };
    mockReports.push(r);
    return r;
  }
  let parsedMeasurements: unknown = {};
  try {
    parsedMeasurements = JSON.parse(input.measurementsJson || "{}");
  } catch {
    parsedMeasurements = {};
  }

  let createdByDisplayName: string | null = null;
  if (authorId) {
    const { data: authorProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", authorId)
      .maybeSingle();
    const rawName = (authorProfile as { display_name?: string | null } | null)?.display_name;
    createdByDisplayName =
      typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;
  }

  const reportId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("technician_reports")
    .insert({
      id: reportId,
      project_id: input.projectId,
      outcome: input.outcome,
      summary: input.summary,
      measurements_json: parsedMeasurements,
      work_description: input.workDescription,
      time_spent_minutes: input.timeSpentMinutes,
      created_by: authorId,
      created_by_display_name: createdByDisplayName,
      signature_data_url: input.signatureDataUrl,
      signed_by_name: input.signedByName,
    });
  if (error) throw new Error(error.message);

  const submissions = options?.orderFormSubmissions?.filter((s) => Object.keys(s.valuesJson).length > 0) ?? [];
  if (submissions.length > 0) {
    const { error: ofError } = await supabase.from("technician_report_order_forms").insert(
      submissions.map((s) => ({
        technician_report_id: reportId,
        template_id: s.templateId,
        values_json: s.valuesJson,
      })),
    );
    if (ofError) throw new Error(ofError.message ?? "Bestellformular konnte nicht gespeichert werden.");
  }

  let status: ProjectStatus;
  if (input.outcome === "schaden_behoben") {
    status = RAPPORT_NEXT_STEP_BEHOBEN; // "abrechnen"
  } else if (options?.nextStatus) {
    status = options.nextStatus;
  } else {
    status = "einsatz_offen"; // Fallback für Rückwärtskompatibilität
  }
  await updateProject(input.projectId, { status, statusUpdateSource: "manual" });

  return {
    ...input,
    id: reportId,
    createdAt: now,
    orderForms: [],
    createdByProfileId: authorId,
    createdByDisplayName,
    hasSignature: Boolean(input.signatureDataUrl),
  };
}

/** Kundensignatur eines Rapports on-demand (nicht in Listen-Payloads). */
export async function getReportSignature(
  reportId: string,
): Promise<{ signatureDataUrl: string | null; signedByName: string | null } | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("technician_reports")
    .select("signature_data_url, signed_by_name")
    .eq("id", reportId)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as { signature_data_url?: string | null; signed_by_name?: string | null };
  return {
    signatureDataUrl:
      row.signature_data_url != null && String(row.signature_data_url).startsWith("data:image/")
        ? String(row.signature_data_url)
        : null,
    signedByName:
      row.signed_by_name != null && String(row.signed_by_name).trim()
        ? String(row.signed_by_name).trim()
        : null,
  };
}

/**
 * Rapport nachträglich anpassen (Büro) — Projekt-Status bleibt unverändert.
 * Ersetzt alle Bestellformular-Zeilen, wenn `orderFormSubmissions` gesetzt ist.
 */
export async function updateTechnicianReport(
  reportId: string,
  input: {
    projectId: string;
    outcome: TechnicianReportOutcome;
    summary: string;
    measurementsJson: string;
    workDescription: string;
    timeSpentMinutes?: number | null;
    orderFormSubmissions?: { templateId: string; valuesJson: Record<string, string> }[];
  },
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockReports.findIndex((r) => r.id === reportId && r.projectId === input.projectId);
    if (idx === -1) throw new Error("Rapport nicht gefunden.");
    const prev = mockReports[idx]!;
    mockReports[idx] = {
      ...prev,
      outcome: input.outcome,
      summary: input.summary,
      measurementsJson: input.measurementsJson,
      workDescription: input.workDescription,
      ...(input.timeSpentMinutes !== undefined
        ? { timeSpentMinutes: input.timeSpentMinutes }
        : {}),
    };
    return;
  }

  let parsedMeasurements: unknown = {};
  try {
    parsedMeasurements = JSON.parse(input.measurementsJson || "{}");
  } catch {
    parsedMeasurements = {};
  }

  const { data: existing, error: findErr } = await supabase
    .from("technician_reports")
    .select("id")
    .eq("id", reportId)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!existing) throw new Error("Rapport nicht gefunden.");

  const rowPatch: Record<string, unknown> = {
    outcome: input.outcome,
    summary: input.summary,
    measurements_json: parsedMeasurements,
    work_description: input.workDescription,
  };
  if (input.timeSpentMinutes !== undefined) {
    rowPatch.time_spent_minutes = input.timeSpentMinutes;
  }

  const { error: upErr } = await supabase
    .from("technician_reports")
    .update(rowPatch)
    .eq("id", reportId)
    .eq("project_id", input.projectId);
  if (upErr) throw new Error(upErr.message);

  if (input.orderFormSubmissions === undefined) {
    return;
  }

  const { error: delErr } = await supabase
    .from("technician_report_order_forms")
    .delete()
    .eq("technician_report_id", reportId);
  if (delErr) throw new Error(delErr.message);

  const submissions = input.orderFormSubmissions.filter((s) => Object.keys(s.valuesJson).length > 0);
  if (submissions.length === 0) {
    return;
  }
  const { error: ofError } = await supabase.from("technician_report_order_forms").insert(
    submissions.map((s) => ({
      technician_report_id: reportId,
      template_id: s.templateId,
      values_json: s.valuesJson,
    })),
  );
  if (ofError) throw new Error(ofError.message ?? "Bestellformular konnte nicht gespeichert werden.");
}

export async function deleteTechnicianReport(reportId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockReports.findIndex((r) => r.id === reportId);
    if (idx !== -1) mockReports.splice(idx, 1);
    return;
  }
  await supabase.from("technician_report_order_forms").delete().eq("technician_report_id", reportId);
  const { error } = await supabase.from("technician_reports").delete().eq("id", reportId);
  if (error) throw new Error(error.message);
}

export async function listActiveOrderFormTemplatesForOrg(organizationId: string): Promise<OrderFormTemplate[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
    const { data, error } = await supabase
    .from("order_form_templates")
    .select("id, organization_id, supplier_name, name, slug, description, fields, sort_order, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapOrderFormTemplateRow);
}

export async function listOrderFormTemplatesForOrg(organizationId: string): Promise<OrderFormTemplate[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("order_form_templates")
    .select("id, organization_id, supplier_name, name, slug, description, fields, sort_order, is_active")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapOrderFormTemplateRow);
}

export async function insertOrderFormTemplate(row: {
  organizationId: string;
  supplierName: string | null;
  name: string;
  slug: string;
  description: string | null;
  fields: unknown;
  sortOrder: number;
  isActive: boolean;
}): Promise<OrderFormTemplate> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht konfiguriert.");
  const { data, error } = await supabase
    .from("order_form_templates")
    .insert({
      organization_id: row.organizationId,
      supplier_name: row.supplierName,
      name: row.name,
      slug: row.slug,
      description: row.description,
      fields: row.fields,
      sort_order: row.sortOrder,
      is_active: row.isActive,
    })
    .select("id, organization_id, supplier_name, name, slug, description, fields, sort_order, is_active")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Vorlage konnte nicht angelegt werden.");
  return mapOrderFormTemplateRow(data as Record<string, unknown>);
}

export async function updateOrderFormTemplate(
  templateId: string,
  patch: Partial<{
    supplierName: string | null;
  name: string;
    slug: string;
    description: string | null;
    fields: unknown;
    sortOrder: number;
    isActive: boolean;
  }>,
): Promise<OrderFormTemplate> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht konfiguriert.");
  const dbPatch: Record<string, unknown> = {};
  if (patch.supplierName !== undefined) dbPatch.supplier_name = patch.supplierName;
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.slug !== undefined) dbPatch.slug = patch.slug;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.fields !== undefined) dbPatch.fields = patch.fields;
  if (patch.sortOrder !== undefined) dbPatch.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  dbPatch.updated_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("order_form_templates")
    .update(dbPatch)
    .eq("id", templateId)
    .select("id, organization_id, supplier_name, name, slug, description, fields, sort_order, is_active")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Vorlage konnte nicht aktualisiert werden.");
  return mapOrderFormTemplateRow(data as Record<string, unknown>);
}

export async function deleteOrderFormTemplate(templateId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht konfiguriert.");
  const { error } = await supabase.from("order_form_templates").delete().eq("id", templateId);
  if (error) throw new Error(error.message);
}
