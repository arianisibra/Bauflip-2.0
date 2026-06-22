"use client";

/**
 * Query and mutation hooks for the project sheet.
 *
 * Rules:
 * - Components never call `invalidateQueries` directly. Use these hooks; they
 *   delegate to the central `invalidations` helpers.
 * - Mutations that return a fresh `ProjectCore` seed the cache via
 *   `setQueryData` before invalidating adjacent queries — no refetch of the
 *   just-mutated resource.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { ProjectCore } from "@/lib/db/repository";
import type {
  OrderFormTemplate,
  ProjectStatus,
  TechnicianAbsence,
  UserProfile,
  WeekTaskItem,
} from "@/lib/domain/types";
import {
  addAppointmentAction,
  deleteAppointmentAction,
  deleteProjectAction,
  deleteReportAction,
  fetchProjekteBootstrapAction,
  getProjectSheetDataAction,
  listAssignableProfilesAction,
  updateProjectStammdatenAction,
  updateProjectStatusAction,
  updateTechnicianReportAction,
} from "@/app/(app)/projekte/actions";
import { listTeamMembersAction } from "@/app/(app)/einstellungen/actions";
import {
  createAbsenceAction,
  deleteAbsenceAction,
  listAbsencesAction,
} from "@/app/(app)/mitarbeiter/absence-actions";
import {
  createIntakeAction,
  deleteAttachmentAction,
  updateAttachmentNotesAction,
  uploadProjectReportFileAction,
} from "@/app/(app)/actions";
import { fetchCalendarRangeTasksAction } from "@/app/(app)/kalender/actions";
import {
  fetchAvailabilityRangeAction,
  type AvailabilityBundle,
} from "@/app/(app)/kalender/availability-actions";
import { fetchOrganizationBrandingAction } from "@/app/(app)/layout-actions";
import type { OrganizationBrandingSnapshot } from "@/lib/projekte/bootstrap-types";
import { PROJEKTE_BOOTSTRAP_STALE_MS, primeProjekteBootstrapCache } from "@/lib/query/projekt-bootstrap-cache";
import { fetchAuftragProjectCoreAction } from "@/app/(tech)/auftrag-data-actions";
import { fetchTechMonthTasksAction, fetchWeekTasksAction } from "@/app/(tech)/wochenplan/actions";
import {
  createOrderFormCmsAction,
  updateOrderFormCmsAction,
} from "@/app/(app)/order-form-cms-actions";
import {
  deleteOrderFormTemplateAction,
  listOrderFormTemplatesForOrgAction,
} from "@/app/(app)/order-form-template-actions";
import {
  afterAbsenceChange,
  afterOrderFormTemplateChange,
  afterProjectDeleted,
  afterAttachmentChange,
  invalidateProjectAdjacencies,
  invalidateProjectListCaches,
  invalidateReportAdjacencies,
} from "./invalidations";
import { notifyOtherTabs } from "./cross-tab-broadcast";
import { queryKeys } from "./keys";
import { getTabId } from "./tab-id";

type UploadResult = { success: true } | { success: false; error: string };

// ───────── Queries ─────────

export function useProjectCore(projectId: string | null, enabled = true) {
  return useQuery<ProjectCore>({
    queryKey: projectId ? queryKeys.projects.core(projectId) : ["projects", "core", "__disabled"],
    enabled: Boolean(projectId) && enabled,
    queryFn: async () => {
      if (!projectId) throw new Error("projectId required");
      const { bundle } = await getProjectSheetDataAction(projectId);
      return bundle;
    },
    staleTime: 60_000,
  });
}

/** Auftragsseite: SSE `appointment.changed` invalidiert diesen Key; SSR-`initialCore` wird in den Cache gespiegelt. */
export function useAuftragProjectCore(projectId: string, initialCore: ProjectCore) {
  const qc = useQueryClient();

  useEffect(() => {
    qc.setQueryData(queryKeys.projects.auftragCore(projectId), initialCore);
  }, [qc, projectId, initialCore]);

  return useQuery<ProjectCore>({
    queryKey: queryKeys.projects.auftragCore(projectId),
    queryFn: () => fetchAuftragProjectCoreAction(projectId),
    initialData: initialCore,
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

/** /projekte: Liste + Branding (SSR-dehydriert oder Server Action bei Status-Wechsel). */
const ORGANIZATION_BRANDING_STALE_MS = 5 * 60 * 1000;

export type OrganizationBranding = OrganizationBrandingSnapshot;

/**
 * Org-Name/Logo im Header. Auf `/projekte` mit `fetch: false` — Bootstrap primt den Cache.
 * Sonst: nur Netzwerk wenn noch kein Cache-Eintrag (z. B. nach Bootstrap).
 */
export function useOrganizationBranding(options?: { fetch?: boolean }) {
  const qc = useQueryClient();
  const cached = qc.getQueryData<OrganizationBranding>(queryKeys.organizationBranding());
  const wantsNetwork = options?.fetch !== false;
  return useQuery<OrganizationBranding>({
    queryKey: queryKeys.organizationBranding(),
    queryFn: () => fetchOrganizationBrandingAction(),
    staleTime: ORGANIZATION_BRANDING_STALE_MS,
    enabled: wantsNetwork && cached == null,
    placeholderData: cached,
  });
}

export function useProjekteBootstrap(status?: ProjectStatus) {
  const statusKey = status ?? "all";
  const qc = useQueryClient();
  return useQuery({
    queryKey: queryKeys.projekteBootstrap(statusKey),
    queryFn: async () => {
      const data = await fetchProjekteBootstrapAction(status);
      primeProjekteBootstrapCache(qc, statusKey, data);
      return data;
    },
    staleTime: PROJEKTE_BOOTSTRAP_STALE_MS,
    refetchOnMount: false,
    select: (data) => data.projects,
  });
}

export function useAssignableProfiles(enabled = true) {
  return useQuery<UserProfile[]>({
    queryKey: queryKeys.assignableProfiles(),
    queryFn: () => listAssignableProfilesAction(),
    staleTime: PROJEKTE_BOOTSTRAP_STALE_MS,
    enabled,
    refetchOnMount: false,
  });
}

export function useTeamMembers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.teamMembers(),
    queryFn: () => listTeamMembersAction(),
    enabled,
    staleTime: 60_000,
  });
}

export function useWeekTasks(isoDate: string, enabled = true) {
  return useQuery<WeekTaskItem[]>({
    queryKey: queryKeys.weekTasks.byDate(isoDate),
    queryFn: () => fetchWeekTasksAction(isoDate),
    enabled,
    staleTime: 90_000,
  });
}

export function useTechMonthTasks(year: number, month: number, enabled = true) {
  return useQuery<WeekTaskItem[]>({
    queryKey: queryKeys.techMonthTasks.byYearMonth(year, month),
    queryFn: () => fetchTechMonthTasksAction(year, month),
    enabled,
    staleTime: 90_000,
  });
}

/** Büro-Kalender: Termine im Zeitraum [rangeStartIso, rangeEndIso] (starts_at). */
export function useCalendarRangeTasks(
  rangeStartIso: string | null,
  rangeEndIso: string | null,
  queryEnabled = true,
) {
  const enabled = Boolean(rangeStartIso && rangeEndIso) && queryEnabled;
  return useQuery<WeekTaskItem[]>({
    queryKey:
      enabled && rangeStartIso && rangeEndIso
        ? queryKeys.calendarRange.byStartEnd(rangeStartIso, rangeEndIso)
        : ["admin-calendar-range", "__disabled"],
    queryFn: () => fetchCalendarRangeTasksAction(rangeStartIso!, rangeEndIso!),
    enabled,
    staleTime: 90_000,
  });
}

/** Verfügbarkeit (Termine + Abwesenheiten + Monteure) für einen Bereich. */
export function useAvailabilityRange(
  rangeStartIso: string | null,
  rangeEndIso: string | null,
  /** Zusätzlich zu Start/Ende gesetzt — z. B. nur laden wenn Monteur gewählt. */
  queryEnabled = true,
) {
  const enabled = Boolean(rangeStartIso && rangeEndIso) && queryEnabled;
  return useQuery<AvailabilityBundle>({
    queryKey:
      enabled && rangeStartIso && rangeEndIso
        ? queryKeys.availabilityRange.byStartEnd(rangeStartIso, rangeEndIso)
        : ["availability-range", "__disabled"],
    queryFn: () => fetchAvailabilityRangeAction(rangeStartIso!, rangeEndIso!),
    enabled,
    staleTime: 60_000,
  });
}

export function useAbsences(initialDataOrEnabled?: TechnicianAbsence[] | boolean) {
  const enabled = typeof initialDataOrEnabled === "boolean" ? initialDataOrEnabled : true;
  const initialData = Array.isArray(initialDataOrEnabled) ? initialDataOrEnabled : undefined;
  return useQuery<TechnicianAbsence[]>({
    queryKey: queryKeys.absences.all(),
    queryFn: () => listAbsencesAction(),
    enabled,
    initialData,
    staleTime: 60_000,
  });
}

export function useCreateAbsence() {
  const qc = useQueryClient();
  return useMutation<
    TechnicianAbsence,
    Error,
    { technicianId: string; startsAt: string; endsAt: string; kind: TechnicianAbsence["kind"]; note?: string | null }
  >({
    mutationFn: (input) => createAbsenceAction(input),
    onSuccess: () => {
      afterAbsenceChange(qc);
    },
  });
}

export function useDeleteAbsence() {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, { absenceId: string }>({
    mutationFn: ({ absenceId }) => deleteAbsenceAction(absenceId),
    onSuccess: () => {
      afterAbsenceChange(qc);
    },
  });
}

export function useOrderFormTemplates(initialData?: OrderFormTemplate[], enabled = true) {
  return useQuery<OrderFormTemplate[]>({
    queryKey: queryKeys.orderFormTemplates.all(),
    queryFn: () => listOrderFormTemplatesForOrgAction(),
    initialData,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

// ───────── Mutation helpers ─────────

/** Seed the core cache with a fresh bundle so the sheet re-renders without a refetch. */
function primeCore(qc: QueryClient, projectId: string, core: ProjectCore) {
  qc.setQueryData(queryKeys.projects.core(projectId), core);
}

// ───────── Mutations ─────────

export function useUpdateStammdaten() {
  const qc = useQueryClient();
  return useMutation<{ core: ProjectCore }, Error, Parameters<typeof updateProjectStammdatenAction>[0]>({
    mutationFn: (values) => updateProjectStammdatenAction(values, getTabId()),
    onSuccess: ({ core }) => {
      primeCore(qc, core.project.id, core);
      invalidateProjectListCaches(qc);
      notifyOtherTabs({ type: "project.core_changed", projectId: core.project.id });
    },
  });
}

export function useAddAppointment() {
  const qc = useQueryClient();
  return useMutation<{ core: ProjectCore }, Error, Parameters<typeof addAppointmentAction>[0]>({
    mutationFn: (input) => addAppointmentAction(input, getTabId()),
    onSuccess: ({ core }) => {
      primeCore(qc, core.project.id, core);
      invalidateProjectAdjacencies(qc, core.project.id);
      notifyOtherTabs({ type: "appointment.changed", projectId: core.project.id });
    },
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation<{ core: ProjectCore }, Error, { appointmentId: string; projectId: string }>({
    mutationFn: ({ appointmentId, projectId }) =>
      deleteAppointmentAction(appointmentId, projectId, getTabId()),
    onSuccess: ({ core }) => {
      primeCore(qc, core.project.id, core);
      invalidateProjectAdjacencies(qc, core.project.id);
      notifyOtherTabs({ type: "appointment.changed", projectId: core.project.id });
    },
  });
}

export function useUpdateProjectStatus() {
  const qc = useQueryClient();
  return useMutation<{ core: ProjectCore }, Error, { projectId: string; status: ProjectStatus }>({
    mutationFn: ({ projectId, status }) =>
      updateProjectStatusAction(projectId, status, getTabId()),
    onSuccess: ({ core }) => {
      primeCore(qc, core.project.id, core);
      invalidateProjectListCaches(qc);
      notifyOtherTabs({ type: "project.core_changed", projectId: core.project.id });
    },
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation<{ core: ProjectCore }, Error, { reportId: string; projectId: string }>({
    mutationFn: ({ reportId, projectId }) => deleteReportAction(reportId, projectId),
    onSuccess: ({ core }) => {
      primeCore(qc, core.project.id, core);
      invalidateReportAdjacencies(qc, core.project.id);
    },
  });
}

export function useUpdateTechnicianReport() {
  const qc = useQueryClient();
  return useMutation<{ core: ProjectCore }, Error, Parameters<typeof updateTechnicianReportAction>[0]>({
    mutationFn: (values) => updateTechnicianReportAction(values, getTabId()),
    onSuccess: ({ core }) => {
      primeCore(qc, core.project.id, core);
      qc.setQueryData(queryKeys.projects.auftragCore(core.project.id), core);
      invalidateProjectListCaches(qc);
      invalidateReportAdjacencies(qc, core.project.id);
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (projectId) => deleteProjectAction(projectId, getTabId()),
    onSuccess: (_, projectId) => {
      afterProjectDeleted(qc, projectId);
      notifyOtherTabs({ type: "project.deleted", projectId });
    },
  });
}

export function useCreateIntake() {
  const qc = useQueryClient();
  return useMutation<{ projectId: string }, Error, FormData>({
    mutationFn: (formData) => createIntakeAction(formData, getTabId()),
    onSuccess: ({ projectId }) => {
      invalidateProjectListCaches(qc);
      notifyOtherTabs({ type: "project.core_changed", projectId });
    },
  });
}

// ───────── Order form template mutations ─────────

type CmsPayload = Parameters<typeof createOrderFormCmsAction>[0];

export function useCreateOrderFormTemplate() {
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, CmsPayload>({
    mutationFn: (payload) => createOrderFormCmsAction(payload),
    onSuccess: () => {
      afterOrderFormTemplateChange(qc);
    },
  });
}

export function useUpdateOrderFormTemplate() {
  const qc = useQueryClient();
  return useMutation<void, Error, { templateId: string; payload: CmsPayload }>({
    mutationFn: ({ templateId, payload }) => updateOrderFormCmsAction(templateId, payload),
    onSuccess: () => {
      afterOrderFormTemplateChange(qc);
    },
  });
}

export function useDeleteOrderFormTemplate() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (templateId) => deleteOrderFormTemplateAction(templateId),
    onSuccess: () => {
      afterOrderFormTemplateChange(qc);
    },
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation<UploadResult, Error, { formData: FormData; projectId: string }>({
    mutationFn: ({ formData }) => uploadProjectReportFileAction(formData, getTabId()),
    onSuccess: (result, { projectId }) => {
      if (result.success) afterAttachmentChange(qc, projectId);
    },
  });
}

export function useUpdateAttachmentNotes() {
  const qc = useQueryClient();
  return useMutation<UploadResult, Error, { attachmentId: string; notes: string; projectId: string }>({
    mutationFn: ({ attachmentId, notes }) => updateAttachmentNotesAction(attachmentId, notes, getTabId()),
    onSuccess: (result, { projectId }) => {
      if (result.success) afterAttachmentChange(qc, projectId);
    },
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation<UploadResult, Error, { attachmentId: string; filePath: string; projectId: string }>({
    mutationFn: ({ attachmentId, filePath }) => deleteAttachmentAction(attachmentId, filePath, getTabId()),
    onSuccess: (result, { projectId }) => {
      if (result.success) afterAttachmentChange(qc, projectId);
    },
  });
}
