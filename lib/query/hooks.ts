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
import { useMutation, useInfiniteQuery, useQuery, useQueryClient, keepPreviousData, type QueryClient } from "@tanstack/react-query";
import type { ProjectCore } from "@/lib/db/repository";
import type {
  OrderFormTemplate,
  ProjectAttachment,
  ProjectStatus,
  TechnicianAbsence,
  TimeEntry,
  UserProfile,
  WeekTaskItem,
} from "@/lib/domain/types";
import {
  addAppointmentAction,
  deleteAppointmentAction,
  reassignAppointmentTechnicianAction,
  deleteProjectAction,
  deleteReportAction,
  fetchProjekteBootstrapAction,
  fetchProjekteListPageAction,
  getProjectSheetBootstrapAction,
  getProjectSheetDetailsAction,
  getProjectSheetHeadAction,
  listAssignableProfilesAction,
  setGarantiefallAction,
  updateProjectStammdatenAction,
  updateProjectStatusAction,
  updateTechnicianReportAction,
} from "@/app/(app)/projekte/actions";
import { listTeamMembersAction } from "@/app/(app)/einstellungen/actions";
import { deactivateTeamMemberAction } from "@/app/(app)/einstellungen/team-member-actions";
import {
  createAbsenceAction,
  deleteAbsenceAction,
  listAbsencesAction,
} from "@/app/(app)/mitarbeiter/absence-actions";
import {
  createTimeEntryAction,
  deleteTimeEntryAction,
  listMyTimeEntriesAction,
  listOrgTimeEntriesAction,
  updateTimeEntryAction,
} from "@/app/(app)/zeiterfassung/actions";
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
import { fetchOrganizationBrandingAction, fetchEinstellungenPageDataAction } from "@/app/(app)/layout-actions";
import type { EinstellungenPageData } from "@/lib/einstellungen/types";
import type { OrganizationBrandingSnapshot, ProjekteBootstrapData, ProjekteListPageSnapshot } from "@/lib/projekte/bootstrap-types";
import { projekteListSearchKey } from "@/lib/projekte/list-page";
import {
  PROJEKTE_BOOTSTRAP_STALE_MS,
  primeProjekteBootstrapCache,
  type ProjekteListInfiniteData,
} from "@/lib/query/projekt-bootstrap-cache";
import {
  DEFAULT_PROJEKTE_LIST_FILTER,
  projekteBootstrapStatusKey,
  type ProjekteListFilter,
} from "@/lib/projekte/list-filter";
import { submitTechnicianReportAction } from "@/app/(tech)/actions";
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
  afterProjectCoreChange,
  afterProjectDeleted,
  afterTimeEntryChange,
  patchAttachmentAdded,
  patchAttachmentNotesUpdated,
  patchAttachmentRemoved,
  invalidateProjectAdjacencies,
  invalidateProjectListCaches,
  invalidateReportAdjacencies,
} from "./invalidations";
import { notifyOtherTabs } from "./cross-tab-broadcast";
import { queryKeys } from "./keys";
import { availabilityRangeKeyBounds } from "./availability-range-bounds";
import { getTabId } from "./tab-id";
import { appointmentSchema, reassignAppointmentTechnicianSchema, technicianReportSchema } from "@/lib/validations/forms";
import type { z } from "zod";

type AppointmentInput = z.infer<typeof appointmentSchema>;
type ReassignAppointmentTechnicianInput = z.infer<typeof reassignAppointmentTechnicianSchema>;
type TechnicianReportInput = z.infer<typeof technicianReportSchema>;

type MutationSuccessResult = { success: true } | { success: false; error: string };
type UploadResult =
  | { success: true; attachment: ProjectAttachment }
  | { success: false; error: string };

// ───────── Queries ─────────

export type ProjectCoreQueryResult = {
  data: ProjectCore | undefined;
  isLoading: boolean;
  /** Anhänge/Rapporte laden noch (Kopf bereits da). */
  isDetailsLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  isSuccess: boolean;
};

export function useProjectCore(projectId: string | null, enabled = true): ProjectCoreQueryResult {
  const isEnabled = Boolean(projectId) && enabled;

  const coreQuery = useQuery({
    queryKey: projectId ? queryKeys.projects.core(projectId) : ["projects", "core", "__disabled"],
    enabled: isEnabled,
    queryFn: async () => {
      const { core } = await getProjectSheetBootstrapAction(projectId!);
      return core;
    },
    staleTime: 60_000,
    refetchOnMount: false,
  });

  return {
    data: coreQuery.data,
    isLoading: coreQuery.isLoading,
    isDetailsLoading: false,
    isFetching: coreQuery.isFetching,
    isError: coreQuery.isError,
    error: coreQuery.error instanceof Error ? coreQuery.error : null,
    isSuccess: coreQuery.isSuccess,
  };
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

export type ProjekteBootstrapMeta = Pick<ProjekteBootstrapData, "statusCounts" | "listMeta">;

/**
 * Org-Name/Logo im Header. Layout SSR primt via Context; Query nur bei fehlendem Layout-Wert.
 */
export function useOrganizationBranding(options?: { fetch?: boolean; initialData?: OrganizationBranding }) {
  const qc = useQueryClient();
  const cached = qc.getQueryData<OrganizationBranding>(queryKeys.organizationBranding());
  const initialData = options?.initialData ?? cached ?? undefined;
  const wantsNetwork = options?.fetch !== false;
  return useQuery<OrganizationBranding>({
    queryKey: queryKeys.organizationBranding(),
    queryFn: () => fetchOrganizationBrandingAction(),
    staleTime: ORGANIZATION_BRANDING_STALE_MS,
    enabled: wantsNetwork && initialData == null,
    initialData,
  });
}

export function useEinstellungenPage() {
  return useQuery<EinstellungenPageData | null>({
    queryKey: queryKeys.einstellungenPage(),
    queryFn: () => fetchEinstellungenPageDataAction(),
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

export function useProjekteBootstrap(
  listFilter: ProjekteListFilter = DEFAULT_PROJEKTE_LIST_FILTER,
  searchQuery = "",
) {
  const statusKey = projekteBootstrapStatusKey(listFilter);
  const searchKey = projekteListSearchKey(searchQuery);
  const qc = useQueryClient();
  return useQuery<ProjekteBootstrapMeta>({
    queryKey: queryKeys.projekteBootstrap(statusKey, searchKey),
    queryFn: async () => {
      const data = await fetchProjekteBootstrapAction(listFilter, searchQuery);
      primeProjekteBootstrapCache(qc, statusKey, searchKey, data);
      return {
        statusCounts: data.statusCounts,
        listMeta: data.listMeta,
      };
    },
    staleTime: PROJEKTE_BOOTSTRAP_STALE_MS,
    refetchOnMount: false,
  });
}

export function useProjekteListInfinite(
  listFilter: ProjekteListFilter = DEFAULT_PROJEKTE_LIST_FILTER,
  searchQuery = "",
) {
  const statusKey = projekteBootstrapStatusKey(listFilter);
  const searchKey = projekteListSearchKey(searchQuery);
  const qc = useQueryClient();

  return useInfiniteQuery<
    ProjekteListPageSnapshot,
    Error,
    ProjekteListInfiniteData,
    ReturnType<typeof queryKeys.projekteList>,
    string | null
  >({
    queryKey: queryKeys.projekteList(statusKey, searchKey),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore && last.nextCursor ? last.nextCursor : undefined),
    queryFn: async ({ pageParam }) => {
      if (pageParam === null) {
        const cached = qc.getQueryData<ProjekteListInfiniteData>(
          queryKeys.projekteList(statusKey, searchKey),
        );
        if (cached?.pages[0]) {
          return cached.pages[0];
        }
        const data = await fetchProjekteBootstrapAction(listFilter, searchQuery);
        primeProjekteBootstrapCache(qc, statusKey, searchKey, data);
        return {
          projects: data.projects,
          nextCursor: data.nextCursor,
          hasMore: data.hasMore,
        };
      }
      return fetchProjekteListPageAction({
        listFilter,
        searchQuery,
        cursor: pageParam,
      });
    },
    staleTime: PROJEKTE_BOOTSTRAP_STALE_MS,
    refetchOnMount: false,
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
    refetchOnMount: false,
  });
}

export function useDeactivateTeamMember() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (userId) => deactivateTeamMemberAction(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teamMembers() });
    },
  });
}

export function useWeekTasks(isoDate: string, enabled = true) {
  return useQuery<WeekTaskItem[]>({
    queryKey: queryKeys.weekTasks.byDate(isoDate),
    queryFn: () => fetchWeekTasksAction(isoDate),
    enabled,
    staleTime: 90_000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  });
}

export function useTechMonthTasks(year: number, month: number, enabled = true) {
  return useQuery<WeekTaskItem[]>({
    queryKey: queryKeys.techMonthTasks.byYearMonth(year, month),
    queryFn: () => fetchTechMonthTasksAction(year, month),
    enabled,
    staleTime: 90_000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
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
    refetchOnMount: false,
    refetchOnWindowFocus: true,
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
  const keyBounds =
    enabled && rangeStartIso && rangeEndIso
      ? availabilityRangeKeyBounds(rangeStartIso, rangeEndIso)
      : null;
  return useQuery<AvailabilityBundle>({
    queryKey: keyBounds
      ? queryKeys.availabilityRange.byStartEnd(keyBounds.startIso, keyBounds.endIso)
      : ["availability-range", "__disabled"],
    queryFn: () => fetchAvailabilityRangeAction(rangeStartIso!, rangeEndIso!),
    enabled,
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
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
    refetchOnMount: false,
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

/** Eigene Zeiterfassungs-Einträge im Datumsbereich (jede Rolle). */
export function useMyTimeEntries(startDate: string, endDate: string, enabled = true) {
  return useQuery<TimeEntry[]>({
    queryKey: queryKeys.timeEntries.mine(startDate, endDate),
    queryFn: () => listMyTimeEntriesAction(startDate, endDate),
    enabled,
    staleTime: 30_000,
    refetchOnMount: false,
  });
}

/** Team-Übersicht: alle Einträge der Organisation (nur Büro/Admin). */
export function useOrgTimeEntries(startDate: string, endDate: string, enabled = true) {
  return useQuery<TimeEntry[]>({
    queryKey: queryKeys.timeEntries.org(startDate, endDate),
    queryFn: () => listOrgTimeEntriesAction(startDate, endDate),
    enabled,
    staleTime: 30_000,
    refetchOnMount: false,
  });
}

export function useCreateTimeEntry() {
  const qc = useQueryClient();
  return useMutation<
    TimeEntry,
    Error,
    { entryDate: string; startsAt?: string | null; endsAt?: string | null; hours: number; note?: string | null }
  >({
    mutationFn: (input) => createTimeEntryAction(input, getTabId()),
    onSuccess: () => {
      afterTimeEntryChange(qc, { refetchType: "all" });
      notifyOtherTabs({ type: "time_entry.changed" });
    },
  });
}

export function useUpdateTimeEntry() {
  const qc = useQueryClient();
  return useMutation<
    TimeEntry,
    Error,
    {
      id: string;
      entryDate: string;
      startsAt?: string | null;
      endsAt?: string | null;
      hours: number;
      note?: string | null;
    }
  >({
    mutationFn: (input) => updateTimeEntryAction(input, getTabId()),
    onSuccess: () => {
      afterTimeEntryChange(qc, { refetchType: "all" });
      notifyOtherTabs({ type: "time_entry.changed" });
    },
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, { timeEntryId: string }>({
    mutationFn: ({ timeEntryId }) => deleteTimeEntryAction(timeEntryId, getTabId()),
    onSuccess: () => {
      afterTimeEntryChange(qc, { refetchType: "all" });
      notifyOtherTabs({ type: "time_entry.changed" });
    },
  });
}

export function useOrderFormTemplates(initialData?: OrderFormTemplate[], enabled = true) {
  return useQuery<OrderFormTemplate[]>({
    queryKey: queryKeys.orderFormTemplates.all(),
    queryFn: () => listOrderFormTemplatesForOrgAction(),
    initialData,
    enabled,
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

function sortOrderFormTemplates(templates: OrderFormTemplate[]): OrderFormTemplate[] {
  return [...templates].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de-CH"),
  );
}

// ───────── Mutation helpers ─────────

/** Seed head, details, and merged core after mutations — no refetch of the just-mutated resource. */
function primeCore(qc: QueryClient, projectId: string, core: ProjectCore) {
  qc.setQueryData(queryKeys.projects.core(projectId), core);
  qc.setQueryData(queryKeys.projects.coreHead(projectId), {
    project: core.project,
    appointments: core.appointments,
  });
  qc.setQueryData(queryKeys.projects.coreDetails(projectId), {
    attachments: core.attachments,
    reports: core.reports,
  });
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
  return useMutation<{ core: ProjectCore }, Error, AppointmentInput>({
    mutationFn: (input) => addAppointmentAction(input, getTabId()),
    onSuccess: ({ core }) => {
      primeCore(qc, core.project.id, core);
      // Buchen kann den Projektstatus promoten (→ abgemacht). Der Status steht auf
      // ALLEN Kalender-Kacheln des Projekts, nicht nur im Fenster des neuen Termins
      // (z. B. der bereits sichtbare Ersttermin in einer anderen Woche). Deshalb breit
      // invalidieren — wie useUpdateProjectStatus und der SSE-Pfad.
      invalidateProjectAdjacencies(qc, core.project.id, { refetchType: "all" });
      notifyOtherTabs({ type: "appointment.changed", projectId: core.project.id });
    },
  });
}

type DeleteAppointmentContext = {
  appointmentWindow?: { startsAt: string; endsAt: string };
};

export function useReassignAppointmentTechnician() {
  const qc = useQueryClient();
  return useMutation<
    { core: ProjectCore },
    Error,
    ReassignAppointmentTechnicianInput,
    DeleteAppointmentContext
  >({
    mutationFn: (input) => reassignAppointmentTechnicianAction(input, getTabId()),
    onMutate: ({ appointmentId, projectId }) => {
      const core = qc.getQueryData<ProjectCore>(queryKeys.projects.core(projectId));
      const appt = core?.appointments.find((a) => a.id === appointmentId);
      if (!appt) return {};
      return { appointmentWindow: { startsAt: appt.startsAt, endsAt: appt.endsAt } };
    },
    onSuccess: ({ core }, _variables, context) => {
      primeCore(qc, core.project.id, core);
      invalidateProjectAdjacencies(qc, core.project.id, {
        appointmentWindow: context?.appointmentWindow,
        refetchType: "all",
      });
      notifyOtherTabs({ type: "appointment.changed", projectId: core.project.id });
    },
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation<
    { core: ProjectCore },
    Error,
    { appointmentId: string; projectId: string }
  >({
    mutationFn: ({ appointmentId, projectId }) =>
      deleteAppointmentAction(appointmentId, projectId, getTabId()),
    onSuccess: ({ core }) => {
      primeCore(qc, core.project.id, core);
      // Löschen des letzten bevorstehenden Termins kann den Status zurücksetzen
      // (abgemacht → vorher). Wie beim Buchen betrifft das den projektweiten Status
      // auf allen Kacheln → breit invalidieren statt nur das gelöschte Fenster.
      invalidateProjectAdjacencies(qc, core.project.id, { refetchType: "all" });
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
      // Status shows on calendar tiles — invalidate adjacencies, not just the list.
      invalidateProjectAdjacencies(qc, core.project.id, { refetchType: "all" });
      notifyOtherTabs({ type: "project.core_changed", projectId: core.project.id });
    },
  });
}

export function useSetGarantiefall() {
  const qc = useQueryClient();
  return useMutation<{ core: ProjectCore }, Error, { projectId: string; note: string }>({
    mutationFn: ({ projectId, note }) => setGarantiefallAction(projectId, note, getTabId()),
    onSuccess: ({ core }) => {
      primeCore(qc, core.project.id, core);
      invalidateProjectAdjacencies(qc, core.project.id, { refetchType: "all" });
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
  return useMutation<{ id: string; template: OrderFormTemplate }, Error, CmsPayload>({
    mutationFn: (payload) => createOrderFormCmsAction(payload, getTabId()),
    onSuccess: ({ template }) => {
      qc.setQueryData<OrderFormTemplate[]>(queryKeys.orderFormTemplates.all(), (old) =>
        sortOrderFormTemplates([...(old ?? []), template]),
      );
    },
  });
}

export function useUpdateOrderFormTemplate() {
  const qc = useQueryClient();
  return useMutation<OrderFormTemplate, Error, { templateId: string; payload: CmsPayload }>({
    mutationFn: ({ templateId, payload }) => updateOrderFormCmsAction(templateId, payload, getTabId()),
    onSuccess: (template) => {
      qc.setQueryData<OrderFormTemplate[]>(queryKeys.orderFormTemplates.all(), (old) =>
        old ? sortOrderFormTemplates(old.map((t) => (t.id === template.id ? template : t))) : [template],
      );
    },
  });
}

export function useDeleteOrderFormTemplate() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (templateId) => deleteOrderFormTemplateAction(templateId, getTabId()),
    onSuccess: (_, templateId) => {
      qc.setQueryData<OrderFormTemplate[]>(queryKeys.orderFormTemplates.all(), (old) =>
        old ? old.filter((t) => t.id !== templateId) : [],
      );
    },
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation<UploadResult, Error, { formData: FormData; projectId: string }>({
    mutationFn: ({ formData }) => uploadProjectReportFileAction(formData, getTabId()),
    onSuccess: (result, { projectId }) => {
      if (result.success) patchAttachmentAdded(qc, projectId, result.attachment);
    },
  });
}

export function useUpdateAttachmentNotes() {
  const qc = useQueryClient();
  return useMutation<MutationSuccessResult, Error, { attachmentId: string; notes: string; projectId: string }>({
    mutationFn: ({ attachmentId, notes }) => updateAttachmentNotesAction(attachmentId, notes, getTabId()),
    onSuccess: (result, { projectId, attachmentId, notes }) => {
      if (result.success) {
        patchAttachmentNotesUpdated(qc, projectId, attachmentId, notes.trim() || null);
      }
    },
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation<MutationSuccessResult, Error, { attachmentId: string; filePath: string; projectId: string }>({
    mutationFn: ({ attachmentId, filePath }) => deleteAttachmentAction(attachmentId, filePath, getTabId()),
    onSuccess: (result, { projectId, attachmentId }) => {
      if (result.success) patchAttachmentRemoved(qc, projectId, attachmentId);
    },
  });
}

export function useSubmitTechnicianReport() {
  const qc = useQueryClient();
  return useMutation<MutationSuccessResult, Error, TechnicianReportInput>({
    mutationFn: (values) => submitTechnicianReportAction(values, getTabId()),
    onSuccess: (result, values) => {
      if (result.success) {
        afterProjectCoreChange(qc, values.projectId, { refetchType: "all" });
      }
    },
  });
}
