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
  RapportNextStep,
  RoleType,
  TechnicianReport,
  TechnicianReportOrderFormEntry,
  TechnicianReportOutcome,
  UserProfile,
  WeekTaskItem,
} from "@/lib/domain/types";
import {
  RAPPORT_NEXT_STEP_BEHOBEN,
  appointmentEndsInFutureOrNow,
  nextProjectStatusAfterAppointmentBooked,
  projectStatusAfterLastAppointmentDeleted,
} from "@/lib/domain/types";
import { parseOrderFormFieldsJson } from "@/lib/order-forms/schema";
import { getWeekBounds } from "@/lib/date/week-bounds";
import { resolveCalendarColor } from "@/lib/calendar/team-colors";
import { formatServiceAddressFields } from "@/lib/tech/bundle-display";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withSlowLog } from "@/lib/observability/slow-log";
import {
  mockAppointments,
  mockProfiles,
  mockProjectAttachments,
  mockProjects,
  mockReports,
} from "@/lib/db/mock-data";

/** Optional safety cap for office project list (server env). Unset = no limit. */
function projectListMaxRows(): number | undefined {
  const raw = process.env.PROJECT_LIST_MAX_ROWS?.trim();
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.min(n, 50_000);
}

export { mapUserProfileRow } from "./repository-map";

function sortOfficeProjects(items: OfficeProjectListItem[]): OfficeProjectListItem[] {
  return [...items].sort((a, b) => {
    const aDone = a.status === "abgeschlossen";
    const bDone = b.status === "abgeschlossen";
    if (aDone === bDone) return 0;
    return aDone ? 1 : -1;
  });
}

/** DB-Spaltenliste — kein select('*') für Projektkern. */
const PROJECT_DB_COLUMNS =
  "id, organization_id, title, type, status, next_owner_role, next_owner_user_id, source, intake_original_text, access_notes, created_at, updated_at, closed_at, reference_code, hints_and_notes, tenant_name, tenant_phone, tenant_email, management_name, management_phone, management_email, cost_ceiling_text, service_street, service_postal_code, service_city, service_country";

const APPOINTMENT_DB_COLUMNS =
  "id, project_id, kind, starts_at, ends_at, assigned_technician_id, planning_notes, created_at";

const PROJECT_LIST_COLUMNS = "id, title, type, status, tenant_name, service_street, service_postal_code, service_city, created_at";

const ATTACHMENT_DB_COLUMNS =
  "id, project_id, file_path, file_name, mime_type, size_bytes, uploaded_by, notes, created_at";

const TECH_REPORT_DB_COLUMNS =
  "id, project_id, outcome, summary, measurements_json, work_description, time_spent_minutes, created_at, created_by, created_by_display_name";

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

export type ProjectCore = {
  project: Project;
  appointments: Appointment[];
  attachments: ProjectAttachment[];
  reports: TechnicianReport[];
};

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

export const listProjectsForOffice = cache(async function listProjectsForOffice(): Promise<OfficeProjectListItem[]> {
  return withSlowLog("listProjectsForOffice", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return sortOfficeProjects(mockProjects.map((p) => ({
        id: p.id,
        title: p.tenantName?.trim() || p.title,
        type: p.type,
        status: p.status,
        displayLabel: p.tenantName?.trim() || p.title,
        serviceAddressShort: null,
      })));
    }
    const orgId = await getCachedCurrentOrganizationId();
    let q = supabase
      .from("projects")
      .select(PROJECT_LIST_COLUMNS)
      .order("created_at", { ascending: false });
    if (orgId) {
      q = q.eq("organization_id", orgId);
    }
    const maxRows = projectListMaxRows();
    if (maxRows) {
      q = q.limit(maxRows);
    }
    const { data, error } = await q;
    if (error || !data) {
      return [];
    }
    const mapped = (data as Record<string, unknown>[]).map((row) => {
      const tenant = row.tenant_name != null ? String(row.tenant_name).trim() : "";
      const title = tenant || String(row.title ?? "");
      const addrShort = formatServiceAddressFields({
        serviceStreet: row.service_street as string | null,
        servicePostalCode: row.service_postal_code as string | null,
        serviceCity: row.service_city as string | null,
      });
      return {
        id: String(row.id),
        title,
        type: row.type as OfficeProjectListItem["type"],
        status: row.status as ProjectStatus,
        displayLabel: tenant || title,
        serviceAddressShort: addrShort === "—" ? null : addrShort,
      };
    });

    return sortOfficeProjects(mapped);
  });
});

export const getProjectCore = cache(async function getProjectCore(projectId: string): Promise<ProjectCore | null> {
  return withSlowLog("getProjectCore", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      const project = mockProjects.find((x) => x.id === projectId);
      if (!project) return null;
      const appts = mockAppointments.filter((a) => a.projectId === projectId);
      return {
        project,
        appointments: appts,
        attachments: mockProjectAttachments.filter((a) => a.projectId === projectId),
        reports: mockReports.filter((r) => r.projectId === projectId),
      };
    }

    const [{ data: project }, { data: appointments }, { data: attachments }, { data: reports }] = await Promise.all([
      supabase.from("projects").select(PROJECT_DB_COLUMNS).eq("id", projectId).maybeSingle(),
      supabase
        .from("appointments")
        .select(APPOINTMENT_DB_COLUMNS)
        .eq("project_id", projectId)
        .order("starts_at"),
      supabase.from("project_attachments").select(ATTACHMENT_DB_COLUMNS).eq("project_id", projectId).order("created_at"),
      supabase.from("technician_reports").select(TECH_REPORT_DB_COLUMNS).eq("project_id", projectId).order("created_at"),
    ]);

    if (!project) return null;

    const projectModel = mapProjectRow(project as Record<string, unknown>);
    const apptModels = ((appointments as Record<string, unknown>[]) ?? []).map(mapAppointmentRow);

    const reportRows = ((reports as Record<string, unknown>[]) ?? []).map(mapTechnicianReportRow);

    let mergedReports = reportRows;
    if (reportRows.length > 0) {
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
      mergedReports = reportRows.map((r) => ({ ...r, orderForms: byReport.get(r.id) ?? [] }));
    }

    return {
      project: projectModel,
      appointments: apptModels,
      attachments: ((attachments as Record<string, unknown>[]) ?? []).map(mapProjectAttachmentRow),
      reports: mergedReports,
    };
  });
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
  projects: OfficeCalendarNestedProject | OfficeCalendarNestedProject[] | null;
};

async function weekTasksFromAppointmentRange(
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<WeekTaskItem[]> {
  return withSlowLog("weekTasksFromAppointmentRange", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("appointments")
      .select(
        `
      id,
      project_id,
      kind,
      starts_at,
      ends_at,
      assigned_technician_id,
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
      .lte("starts_at", rangeEndIso)
      .order("starts_at", { ascending: true });

    if (error || !data?.length) return [];

    const rows = data as OfficeCalendarAppointmentRow[];

    const techIds = [...new Set(rows.map((r) => r.assigned_technician_id).filter(Boolean))] as string[];
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
): Promise<WeekTaskItem[]> {
  return weekTasksFromAppointmentRange(rangeStartIso, rangeEndIso);
});

export const listWeekTasks = cache(async function listWeekTasks(referenceDate = new Date()): Promise<WeekTaskItem[]> {
  const { start, end } = getWeekBounds(referenceDate);
  return listCalendarRangeTasks(start.toISOString(), end.toISOString());
});

export const listMonthTasks = cache(async function listMonthTasks(year: number, month: number): Promise<WeekTaskItem[]> {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return listCalendarRangeTasks(start.toISOString(), end.toISOString());
});

export const listAssignableProfiles = cache(async function listAssignableProfiles(): Promise<UserProfile[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockProfiles.filter((p) => p.role === "technician" || p.role === "admin" || p.role === "office");
  }
  const orgId = await getCachedCurrentOrganizationId();
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
  "id" | "createdAt" | "updatedAt" | "closedAt" | "referenceCode"
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
  >
>;

export async function updateProject(projectId: string, patch: ProjectPatch): Promise<Project> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const p = mockProjects.find((x) => x.id === projectId);
    if (!p) throw new Error("Projekt nicht gefunden.");
    Object.assign(p, patch);
    p.updatedAt = new Date().toISOString();
    return p;
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
  if (patch.status === "abgeschlossen") {
    row.closed_at = new Date().toISOString();
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
  return mapProjectRow(data as Record<string, unknown>);
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus): Promise<Project> {
  return updateProject(projectId, { status });
}

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

export async function addAppointment(input: Omit<Appointment, "id" | "createdAt">): Promise<Appointment> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const isFirstAppointmentForProject =
      mockAppointments.filter((x) => x.projectId === input.projectId).length === 0;
    const appointmentIsUpcoming = appointmentEndsInFutureOrNow(input.endsAt);
    const a: Appointment = { ...input, id: id("a"), createdAt: new Date().toISOString() };
    mockAppointments.push(a);
    const mockP = mockProjects.find((p) => p.id === input.projectId);
    if (mockP) {
      const next = nextProjectStatusAfterAppointmentBooked(mockP.status, {
        isFirstAppointmentForProject,
        appointmentIsUpcoming,
      });
      if (next !== null && next !== mockP.status) {
        mockP.status = next;
        mockP.updatedAt = new Date().toISOString();
      }
    }
    return a;
  }

  const { count: priorCount, error: countError } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("project_id", input.projectId);
  if (countError) throw new Error(countError.message);
  const isFirstAppointmentForProject = (priorCount ?? 0) === 0;
  const appointmentIsUpcoming = appointmentEndsInFutureOrNow(input.endsAt);

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      project_id: input.projectId,
      kind: input.kind,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      assigned_technician_id: input.assignedTechnicianId,
      planning_notes: input.planningNotes,
    })
    .select(APPOINTMENT_DB_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Termin konnte nicht gespeichert werden.");

  const { data: statusRow } = await supabase.from("projects").select("status").eq("id", input.projectId).maybeSingle();
  const currentStatus = (statusRow?.status as ProjectStatus | undefined) ?? "offen";
  const nextStatus = nextProjectStatusAfterAppointmentBooked(currentStatus, {
    isFirstAppointmentForProject,
    appointmentIsUpcoming,
  });
  if (nextStatus !== null && nextStatus !== currentStatus) {
    await updateProject(input.projectId, { status: nextStatus });
  }

  return mapAppointmentRow(data as Record<string, unknown>);
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
        const revert = projectStatusAfterLastAppointmentDeleted(mockP.status);
        if (revert !== null) {
          mockP.status = revert;
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
      .select("status")
      .eq("id", projectId)
      .maybeSingle();
    const currentStatus = (statusRow?.status as ProjectStatus | undefined) ?? "offen";
    const revert = projectStatusAfterLastAppointmentDeleted(currentStatus);
    if (revert !== null && revert !== currentStatus) {
      await updateProject(projectId, { status: revert });
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
  const { data } = await supabase.storage.from("project-files").createSignedUrls(paths, 3600);
  if (!data) return attachments;
  return attachments.map((a, i) => ({
    ...a,
    signedUrl: data[i]?.signedUrl ?? undefined,
  }));
}

export async function addTechnicianReport(
  input: Omit<TechnicianReport, "id" | "createdAt" | "orderForms" | "createdByProfileId" | "createdByDisplayName">,
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
  await updateProject(input.projectId, { status });

  return {
    ...input,
    id: reportId,
    createdAt: now,
    orderForms: [],
    createdByProfileId: authorId,
    createdByDisplayName,
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

  const { error: upErr } = await supabase
    .from("technician_reports")
    .update({
      outcome: input.outcome,
      summary: input.summary,
      measurements_json: parsedMeasurements,
      work_description: input.workDescription,
    })
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
): Promise<void> {
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
  const { error } = await supabase.from("order_form_templates").update(dbPatch).eq("id", templateId);
  if (error) throw new Error(error.message);
}

export async function deleteOrderFormTemplate(templateId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase nicht konfiguriert.");
  const { error } = await supabase.from("order_form_templates").delete().eq("id", templateId);
  if (error) throw new Error(error.message);
}
