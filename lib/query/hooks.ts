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
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { ProjectCore } from "@/lib/db/repository";
import type {
  OfficeProjectListItem,
  OrderFormTemplate,
  ProjectStatus,
  UserProfile,
  WeekTaskItem,
} from "@/lib/domain/types";
import {
  addAppointmentAction,
  deleteAppointmentAction,
  deleteProjectAction,
  deleteReportAction,
  getProjectSheetDataAction,
  listAssignableProfilesAction,
  listProjectsForOfficeAction,
  updateProjectStammdatenAction,
  updateProjectStatusAction,
} from "@/app/(app)/projekte/actions";
import {
  createIntakeAction,
  deleteAttachmentAction,
  updateAttachmentNotesAction,
  uploadProjectReportFileAction,
} from "@/app/(app)/actions";
import { fetchMonthTasksAction } from "@/app/(app)/kalender/actions";
import { fetchWeekTasksAction } from "@/app/(tech)/wochenplan/actions";
import {
  createOrderFormCmsAction,
  updateOrderFormCmsAction,
} from "@/app/(app)/order-form-cms-actions";
import {
  deleteOrderFormTemplateAction,
  listOrderFormTemplatesForOrgAction,
} from "@/app/(app)/order-form-template-actions";
import {
  afterOrderFormTemplateChange,
  afterProjectDeleted,
  invalidateAttachmentAdjacencies,
  invalidateProjectAdjacencies,
  invalidateReportAdjacencies,
} from "./invalidations";
import { queryKeys } from "./keys";
import { broadcast } from "./realtime";

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
  });
}

export function useProjectsList(initialData?: OfficeProjectListItem[]) {
  return useQuery<OfficeProjectListItem[]>({
    queryKey: queryKeys.projects.list(),
    queryFn: () => listProjectsForOfficeAction(),
    initialData,
  });
}

export function useAssignableProfiles(initialData?: UserProfile[]) {
  return useQuery<UserProfile[]>({
    queryKey: queryKeys.assignableProfiles(),
    queryFn: () => listAssignableProfilesAction(),
    initialData,
  });
}

export function useWeekTasks(isoDate: string) {
  return useQuery<WeekTaskItem[]>({
    queryKey: queryKeys.weekTasks.byDate(isoDate),
    queryFn: () => fetchWeekTasksAction(isoDate),
  });
}

export function useMonthTasks(year: number, month: number) {
  return useQuery<WeekTaskItem[]>({
    queryKey: queryKeys.monthTasks.byYearMonth(year, month),
    queryFn: () => fetchMonthTasksAction(year, month),
  });
}

export function useOrderFormTemplates(initialData?: OrderFormTemplate[]) {
  return useQuery<OrderFormTemplate[]>({
    queryKey: queryKeys.orderFormTemplates.all(),
    queryFn: () => listOrderFormTemplatesForOrgAction(),
    initialData,
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
    mutationFn: (values) => updateProjectStammdatenAction(values),
    onSuccess: ({ core }) => {
      primeCore(qc, core.project.id, core);
      invalidateProjectAdjacencies(qc, core.project.id);
      broadcast({ type: "project.core_changed", projectId: core.project.id });
    },
  });
}

export function useAddAppointment() {
  const qc = useQueryClient();
  return useMutation<{ core: ProjectCore }, Error, Parameters<typeof addAppointmentAction>[0]>({
    mutationFn: (input) => addAppointmentAction(input),
    onSuccess: ({ core }) => {
      primeCore(qc, core.project.id, core);
      invalidateProjectAdjacencies(qc, core.project.id);
      broadcast({ type: "appointment.changed", projectId: core.project.id });
    },
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation<{ core: ProjectCore }, Error, { appointmentId: string; projectId: string }>({
    mutationFn: ({ appointmentId, projectId }) => deleteAppointmentAction(appointmentId, projectId),
    onSuccess: ({ core }) => {
      primeCore(qc, core.project.id, core);
      invalidateProjectAdjacencies(qc, core.project.id);
      broadcast({ type: "appointment.changed", projectId: core.project.id });
    },
  });
}

export function useUpdateProjectStatus() {
  const qc = useQueryClient();
  return useMutation<{ core: ProjectCore }, Error, { projectId: string; status: ProjectStatus }>({
    mutationFn: ({ projectId, status }) => updateProjectStatusAction(projectId, status),
    onSuccess: ({ core }) => {
      primeCore(qc, core.project.id, core);
      invalidateProjectAdjacencies(qc, core.project.id);
      broadcast({ type: "project.core_changed", projectId: core.project.id });
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
      broadcast({ type: "report.changed", projectId: core.project.id });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (projectId) => deleteProjectAction(projectId),
    onSuccess: (_, projectId) => {
      afterProjectDeleted(qc, projectId);
      broadcast({ type: "project.deleted", projectId });
    },
  });
}

export function useCreateIntake() {
  const qc = useQueryClient();
  return useMutation<{ projectId: string }, Error, FormData>({
    mutationFn: (formData) => createIntakeAction(formData),
    onSuccess: ({ projectId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.list() });
      // Reuse `project.core_changed` — receivers will invalidate the list.
      broadcast({ type: "project.core_changed", projectId });
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
      broadcast({ type: "order_form_template.changed" });
    },
  });
}

export function useUpdateOrderFormTemplate() {
  const qc = useQueryClient();
  return useMutation<void, Error, { templateId: string; payload: CmsPayload }>({
    mutationFn: ({ templateId, payload }) => updateOrderFormCmsAction(templateId, payload),
    onSuccess: () => {
      afterOrderFormTemplateChange(qc);
      broadcast({ type: "order_form_template.changed" });
    },
  });
}

export function useDeleteOrderFormTemplate() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (templateId) => deleteOrderFormTemplateAction(templateId),
    onSuccess: () => {
      afterOrderFormTemplateChange(qc);
      broadcast({ type: "order_form_template.changed" });
    },
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation<UploadResult, Error, { formData: FormData; projectId: string }>({
    mutationFn: ({ formData }) => uploadProjectReportFileAction(formData),
    onSuccess: (result, { projectId }) => {
      if (result.success) invalidateAttachmentAdjacencies(qc, projectId);
    },
  });
}

export function useUpdateAttachmentNotes() {
  const qc = useQueryClient();
  return useMutation<UploadResult, Error, { attachmentId: string; notes: string; projectId: string }>({
    mutationFn: ({ attachmentId, notes }) => updateAttachmentNotesAction(attachmentId, notes),
    onSuccess: (result, { projectId }) => {
      if (result.success) invalidateAttachmentAdjacencies(qc, projectId);
    },
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation<UploadResult, Error, { attachmentId: string; filePath: string; projectId: string }>({
    mutationFn: ({ attachmentId, filePath }) => deleteAttachmentAction(attachmentId, filePath),
    onSuccess: (result, { projectId }) => {
      if (result.success) invalidateAttachmentAdjacencies(qc, projectId);
    },
  });
}
