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
  PriceBookItem,
  ProjectAttachment,
  ProjectStatus,
  Quote,
  QuoteStatus,
  TechnicianAbsence,
  TimeEntry,
  UserProfile,
  WeekTaskItem,
} from "@/lib/domain/types";
import {
  addAppointmentAction,
  deleteAppointmentAction,
  reassignAppointmentTechnicianAction,
  archiveProjectAction,
  restoreProjectAction,
  deleteProjectPermanentlyAction,
  deleteReportAction,
  fetchProjekteBootstrapAction,
  fetchProjekteListPageAction,
  getProjectSheetBootstrapAction,
  getProjectSheetDetailsAction,
  getProjectSheetHeadAction,
  getReportSignatureAction,
  listAssignableProfilesAction,
  setGarantiefallAction,
  updateProjectStammdatenAction,
  updateProjectStatusAction,
  updateTechnicianReportAction,
} from "@/app/(app)/projekte/actions";
import {
  createQuoteAction,
  deleteQuoteAction,
  getQuoteMailConfigAction,
  listQuotesAction,
  rejectQuoteApprovalAction,
  sendQuoteAction,
  setQuoteStatusAction,
  updateQuoteAction,
} from "@/app/(app)/projekte/quote-actions";
import {
  createPriceBookItemAction,
  deletePriceBookItemAction,
  listPriceBookItemsAction,
  updatePriceBookItemAction,
} from "@/app/(app)/projekte/price-book-actions";
import {
  createContactAction,
  deleteContactAction,
  listContactProjectsAction,
  listContactsAction,
  updateContactAction,
} from "@/app/(app)/kontakte/actions";
import type { ContactProjectRow } from "@/lib/db/contacts";
import { sendAppointmentConfirmationAction } from "@/app/(app)/projekte/appointment-mail-actions";
import { fetchDashboardDataAction } from "@/app/(app)/dashboard/actions";
import type { DashboardData } from "@/lib/db/dashboard";
import {
  connectBexioAction,
  disconnectBexioAction,
  getBexioMappingOptionsAction,
  getBexioSettingsAction,
  isBexioConnectedAction,
  saveBexioMappingAction,
  type BexioMappingOptions,
} from "@/app/(app)/einstellungen/bexio-actions";
import {
  deleteDocumentTemplateAction,
  hasOfferDocumentTemplateAction,
  hasAuftragDocumentTemplateAction,
  hasRapportDocumentTemplateAction,
  listDocumentTemplatesAction,
  setDefaultDocumentTemplateAction,
  uploadDocumentTemplateAction,
} from "@/app/(app)/einstellungen/document-template-actions";
import {
  getBillingSettingsAction,
  updateBillingSettingsAction,
} from "@/app/(app)/einstellungen/billing-actions";
import {
  getInvitePreferenceAction,
  setInvitePreferenceAction,
} from "@/app/(app)/einstellungen/invite-preference-actions";
import {
  getBusyCalendarStatusAction,
  saveBusyCalendarAction,
  syncBusyCalendarAction,
} from "@/app/(app)/einstellungen/busy-calendar-actions";
import type { BusyCalendarConfig } from "@/lib/db/busy-calendar";
import {
  createInvoiceAction,
  deleteInvoiceAction,
  listInvoicesAction,
  pushInvoiceToBexioAction,
  sendInvoiceAction,
  setInvoiceStatusAction,
  updateInvoiceAction,
} from "@/app/(app)/projekte/invoice-actions";
import {
  confirmPaymentImportAction,
  listPaymentImportsAction,
  previewPaymentImportAction,
  type ConfirmPaymentImportResult,
  type PaymentImportPreview,
} from "@/app/(app)/zahlungen/actions";
import type { BexioSettings, Contact, DocumentTemplate, DocumentTemplateKind, Invoice, InvoiceStatus, OrganizationBillingSettings, PaymentImport } from "@/lib/domain/types";
import { listTeamMembersAction } from "@/app/(app)/einstellungen/actions";
import { deactivateTeamMemberAction, revokeInvitationAction } from "@/app/(app)/einstellungen/team-member-actions";
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
  afterContactChange,
  afterInvoiceChange,
  afterPriceBookChange,
  afterProjectCoreChange,
  afterProjectDeleted,
  afterProjectArchiveChanged,
  afterQuoteChange,
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
        // Erste Seite: den vom Bootstrap geprimten Cache wiederverwenden — ABER nur,
        // solange der Query nicht invalidiert ist. Nach invalidateQueries (Archivieren/
        // Löschen/Anlegen) will React Query frische Daten; ohne diese Prüfung gäbe die
        // queryFn stur den alten Stand zurück und die Liste blieb bis zum Reload stehen.
        const listKey = queryKeys.projekteList(statusKey, searchKey);
        const cached = qc.getQueryData<ProjekteListInfiniteData>(listKey);
        const isInvalidated = qc.getQueryState(listKey)?.isInvalidated ?? false;
        if (cached?.pages[0] && !isInvalidated) {
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

export function useRevokeInvitation() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (email) => revokeInvitationAction(email),
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

/** Offerten eines Projekts (Büro-Sheet). */
export function useProjectQuotes(projectId: string | null, enabled = true) {
  return useQuery<Quote[]>({
    queryKey: queryKeys.quotes.byProject(projectId ?? "none"),
    queryFn: () => listQuotesAction(projectId as string),
    enabled: enabled && Boolean(projectId),
    staleTime: 30_000,
    refetchOnMount: false,
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation<Quote, Error, Parameters<typeof createQuoteAction>[0]>({
    mutationFn: (input) => createQuoteAction(input, getTabId()),
    onSuccess: (quote) => {
      afterQuoteChange(qc, quote.projectId, { refetchType: "all" });
      notifyOtherTabs({ type: "quote.changed", projectId: quote.projectId });
    },
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation<Quote, Error, Parameters<typeof updateQuoteAction>[0]>({
    mutationFn: (input) => updateQuoteAction(input, getTabId()),
    onSuccess: (quote) => {
      afterQuoteChange(qc, quote.projectId, { refetchType: "all" });
      notifyOtherTabs({ type: "quote.changed", projectId: quote.projectId });
    },
  });
}

export function useSetQuoteStatus() {
  const qc = useQueryClient();
  return useMutation<Quote, Error, { quoteId: string; projectId: string; status: QuoteStatus }>({
    mutationFn: (input) => setQuoteStatusAction(input, getTabId()),
    onSuccess: (quote) => {
      afterQuoteChange(qc, quote.projectId, { refetchType: "all" });
      notifyOtherTabs({ type: "quote.changed", projectId: quote.projectId });
    },
  });
}

/** Admin weist eine Offerte im Freigabe-Workflow zurück (→ Entwurf, mit Kommentar fürs Büro). */
export function useRejectQuoteApproval() {
  const qc = useQueryClient();
  return useMutation<Quote, Error, { quoteId: string; projectId: string; note?: string | null }>({
    mutationFn: (input) => rejectQuoteApprovalAction(input, getTabId()),
    onSuccess: (quote) => {
      afterQuoteChange(qc, quote.projectId, { refetchType: "all" });
      notifyOtherTabs({ type: "quote.changed", projectId: quote.projectId });
    },
  });
}

/** Terminbestätigung per Mail — kein Cache-Effekt (ändert keine Daten). */
export function useSendAppointmentConfirmation() {
  return useMutation<
    { ok: true },
    Error,
    { appointmentId: string; projectId: string; recipientEmail: string }
  >({
    mutationFn: (input) => sendAppointmentConfirmationAction(input),
  });
}

/** Auswertungen — dehydrated vom Server geprimt; erneutes Laden per refetch(). */
export function useDashboardData() {
  return useQuery<DashboardData>({
    queryKey: queryKeys.dashboard(),
    queryFn: () => fetchDashboardDataAction(),
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

/** Rechnungen eines Projekts (Büro-Sheet). */
export function useProjectInvoices(projectId: string | null, enabled = true) {
  return useQuery<Invoice[]>({
    queryKey: queryKeys.invoices.byProject(projectId ?? "none"),
    queryFn: () => listInvoicesAction(projectId as string),
    enabled: enabled && Boolean(projectId),
    staleTime: 30_000,
    refetchOnMount: false,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation<Invoice, Error, Parameters<typeof createInvoiceAction>[0]>({
    mutationFn: (input) => createInvoiceAction(input, getTabId()),
    onSuccess: (invoice) => {
      afterInvoiceChange(qc, invoice.projectId, { refetchType: "all" });
      notifyOtherTabs({ type: "invoice.changed", projectId: invoice.projectId });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation<Invoice, Error, Parameters<typeof updateInvoiceAction>[0]>({
    mutationFn: (input) => updateInvoiceAction(input, getTabId()),
    onSuccess: (invoice) => {
      afterInvoiceChange(qc, invoice.projectId, { refetchType: "all" });
      notifyOtherTabs({ type: "invoice.changed", projectId: invoice.projectId });
    },
  });
}

export function useSetInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation<Invoice, Error, { invoiceId: string; projectId: string; status: InvoiceStatus }>({
    mutationFn: (input) => setInvoiceStatusAction(input, getTabId()),
    onSuccess: (invoice) => {
      afterInvoiceChange(qc, invoice.projectId, { refetchType: "all" });
      notifyOtherTabs({ type: "invoice.changed", projectId: invoice.projectId });
    },
  });
}

export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation<
    Invoice,
    Error,
    { invoiceId: string; projectId: string; recipientEmail: string; message?: string | null }
  >({
    mutationFn: (input) => sendInvoiceAction(input, getTabId()),
    onSuccess: (invoice) => {
      afterInvoiceChange(qc, invoice.projectId, { refetchType: "all" });
      notifyOtherTabs({ type: "invoice.changed", projectId: invoice.projectId });
    },
  });
}

/** Manueller Bexio-Retry-Button (Rechnungs-Sektion) — Teil B3. */
export function usePushInvoiceToBexio() {
  const qc = useQueryClient();
  return useMutation<Invoice, Error, string>({
    mutationFn: (invoiceId) => pushInvoiceToBexioAction(invoiceId, getTabId()),
    onSuccess: (invoice) => {
      afterInvoiceChange(qc, invoice.projectId, { refetchType: "all" });
      notifyOtherTabs({ type: "invoice.changed", projectId: invoice.projectId });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, { invoiceId: string; projectId: string }>({
    mutationFn: ({ invoiceId, projectId }) => deleteInvoiceAction(invoiceId, projectId, getTabId()),
    onSuccess: (_res, { projectId }) => {
      afterInvoiceChange(qc, projectId, { refetchType: "all" });
      notifyOtherTabs({ type: "invoice.changed", projectId });
    },
  });
}

/** Import-Historie Zahlungsabgleich (Protokoll, keine Datei-Inhalte). */
export function usePaymentImports(enabled = true) {
  return useQuery<PaymentImport[]>({
    queryKey: queryKeys.paymentImports(),
    queryFn: () => listPaymentImportsAction(),
    enabled,
    staleTime: 30_000,
    refetchOnMount: false,
  });
}

/** camt-Datei parsen + gegen offene/bezahlte Rechnungen abgleichen — keine Schreiboperation. */
export function usePreviewPaymentImport() {
  return useMutation<PaymentImportPreview, Error, FormData>({
    mutationFn: (formData) => previewPaymentImportAction(formData),
  });
}

/** Bestätigte Zuordnungen anwenden: Rechnungen auf bezahlt + Import-Protokoll. */
export function useConfirmPaymentImport() {
  const qc = useQueryClient();
  return useMutation<ConfirmPaymentImportResult, Error, Parameters<typeof confirmPaymentImportAction>[0]>({
    mutationFn: (input) => confirmPaymentImportAction(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.paymentImports() });
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

/** Termin-Einladungen per Mail an/aus (eigener Account, alle Rollen). */
export function useInvitePreference() {
  return useQuery<{ enabled: boolean }>({
    queryKey: queryKeys.invitePreference(),
    queryFn: () => getInvitePreferenceAction(),
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

export function useSetInvitePreference() {
  const qc = useQueryClient();
  return useMutation<{ enabled: boolean }, Error, boolean>({
    mutationFn: (enabled) => setInvitePreferenceAction(enabled),
    onSuccess: (result) => {
      qc.setQueryData(queryKeys.invitePreference(), result);
    },
  });
}

/** Privater Kalender als Busy-Blocker: eigener Status/Konfig. */
export function useBusyCalendarStatus(enabled = true) {
  return useQuery<BusyCalendarConfig>({
    queryKey: queryKeys.busyCalendar(),
    queryFn: () => getBusyCalendarStatusAction(),
    enabled,
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

export function useSaveBusyCalendar() {
  const qc = useQueryClient();
  return useMutation<BusyCalendarConfig, Error, { icsUrl: string | null; enabled: boolean }>({
    mutationFn: (input) => saveBusyCalendarAction(input),
    onSuccess: (result) => {
      qc.setQueryData(queryKeys.busyCalendar(), result);
      qc.invalidateQueries({ queryKey: queryKeys.availabilityRange.all() });
    },
  });
}

export function useSyncBusyCalendar() {
  const qc = useQueryClient();
  return useMutation<BusyCalendarConfig, Error, void>({
    mutationFn: () => syncBusyCalendarAction(),
    onSuccess: (result) => {
      qc.setQueryData(queryKeys.busyCalendar(), result);
      qc.invalidateQueries({ queryKey: queryKeys.availabilityRange.all() });
    },
  });
}

/** Zahlungsdaten (QR-Rechnung) — Admin-Formular in Einstellungen. */
export function useBillingSettings(enabled = true) {
  return useQuery<OrganizationBillingSettings>({
    queryKey: queryKeys.billingSettings(),
    queryFn: () => getBillingSettingsAction(),
    enabled,
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

export function useUpdateBillingSettings() {
  const qc = useQueryClient();
  return useMutation<OrganizationBillingSettings, Error, Parameters<typeof updateBillingSettingsAction>[0]>({
    mutationFn: (input) => updateBillingSettingsAction(input),
    onSuccess: (settings) => {
      qc.setQueryData(queryKeys.billingSettings(), settings);
    },
  });
}

/** Bexio-Verbindungsstatus + Mapping — Admin-Sektion in Einstellungen. */
export function useBexioSettings(enabled = true) {
  return useQuery<BexioSettings>({
    queryKey: queryKeys.bexioSettings(),
    queryFn: () => getBexioSettingsAction(),
    enabled,
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

/** Nur «ist Bexio verbunden?» (Office-Ebene) — für den «Nach Bexio»-Menüpunkt an Rechnungen. */
export function useBexioConnected(enabled = true) {
  return useQuery<boolean>({
    queryKey: queryKeys.bexioConnected(),
    queryFn: () => isBexioConnectedAction(),
    enabled,
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

export function useConnectBexio() {
  const qc = useQueryClient();
  return useMutation<BexioSettings, Error, string>({
    mutationFn: (token) => connectBexioAction(token),
    onSuccess: (settings) => {
      qc.setQueryData(queryKeys.bexioSettings(), settings);
    },
  });
}

export function useDisconnectBexio() {
  const qc = useQueryClient();
  return useMutation<BexioSettings, Error, void>({
    mutationFn: () => disconnectBexioAction(),
    onSuccess: (settings) => {
      qc.setQueryData(queryKeys.bexioSettings(), settings);
    },
  });
}

/** Live aus Bexio geladen (Konten/Steuersätze) — nur abrufen, wenn verbunden + Mapping offen. */
export function useBexioMappingOptions(enabled: boolean) {
  return useQuery<BexioMappingOptions>({
    queryKey: queryKeys.bexioMappingOptions(),
    queryFn: () => getBexioMappingOptionsAction(),
    enabled,
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

export function useSaveBexioMapping() {
  const qc = useQueryClient();
  return useMutation<BexioSettings, Error, Parameters<typeof saveBexioMappingAction>[0]>({
    mutationFn: (input) => saveBexioMappingAction(input),
    onSuccess: (settings) => {
      qc.setQueryData(queryKeys.bexioSettings(), settings);
    },
  });
}

/** Dokumentvorlagen (.docx) der Organisation — Admin-Verwaltung in Einstellungen. */
export function useDocumentTemplates(enabled = true) {
  return useQuery<DocumentTemplate[]>({
    queryKey: queryKeys.documentTemplates(),
    queryFn: () => listDocumentTemplatesAction(),
    enabled,
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

export function useUploadDocumentTemplate() {
  const qc = useQueryClient();
  return useMutation<DocumentTemplate, Error, FormData>({
    mutationFn: (formData) => uploadDocumentTemplateAction(formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documentTemplates() });
      qc.invalidateQueries({ queryKey: queryKeys.hasOfferDocumentTemplate() });
      qc.invalidateQueries({ queryKey: queryKeys.hasAuftragDocumentTemplate() });
      qc.invalidateQueries({ queryKey: queryKeys.hasRapportDocumentTemplate() });
    },
  });
}

export function useSetDefaultDocumentTemplate() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; kind: DocumentTemplateKind }>({
    mutationFn: (input) => setDefaultDocumentTemplateAction(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documentTemplates() });
    },
  });
}

export function useDeleteDocumentTemplate() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteDocumentTemplateAction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documentTemplates() });
      qc.invalidateQueries({ queryKey: queryKeys.hasOfferDocumentTemplate() });
      qc.invalidateQueries({ queryKey: queryKeys.hasAuftragDocumentTemplate() });
      qc.invalidateQueries({ queryKey: queryKeys.hasRapportDocumentTemplate() });
    },
  });
}

/** Existiert eine Offert-Vorlage? Steuert den «Als Word»-Eintrag in der Offerten-Sektion. */
export function useHasOfferDocumentTemplate(enabled = true) {
  return useQuery<boolean>({
    queryKey: queryKeys.hasOfferDocumentTemplate(),
    queryFn: () => hasOfferDocumentTemplateAction(),
    enabled,
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

/** Existiert eine Auftragsvorlage? Steuert den «Als Word (Auftrag)»-Button im Projekt-Sheet. */
export function useHasAuftragDocumentTemplate(enabled = true) {
  return useQuery<boolean>({
    queryKey: queryKeys.hasAuftragDocumentTemplate(),
    queryFn: () => hasAuftragDocumentTemplateAction(),
    enabled,
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

/** Existiert eine Rapportvorlage? Steuert den «Als Word (Rapport)»-Button je Rapport. */
export function useHasRapportDocumentTemplate(enabled = true) {
  return useQuery<boolean>({
    queryKey: queryKeys.hasRapportDocumentTemplate(),
    queryFn: () => hasRapportDocumentTemplateAction(),
    enabled,
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

/** Ist SMTP konfiguriert? Steuert die Sichtbarkeit des Senden-Formulars. */
/** Kundensignatur on-demand (aufgeklappte Rapport-Karte); Signaturen sind unveränderlich → Infinity. */
export function useReportSignature(reportId: string, enabled = true) {
  return useQuery<{ signatureDataUrl: string | null; signedByName: string | null }>({
    queryKey: queryKeys.reportSignature(reportId),
    queryFn: () => getReportSignatureAction(reportId),
    enabled,
    staleTime: Infinity,
    refetchOnMount: false,
  });
}

export function useQuoteMailConfig(enabled = true) {
  return useQuery<{ mailConfigured: boolean }>({
    queryKey: queryKeys.quoteMailConfig(),
    queryFn: () => getQuoteMailConfigAction(),
    enabled,
    staleTime: Infinity,
    refetchOnMount: false,
  });
}

export function useSendQuote() {
  const qc = useQueryClient();
  return useMutation<
    Quote,
    Error,
    { quoteId: string; projectId: string; recipientEmail: string; message?: string | null }
  >({
    mutationFn: (input) => sendQuoteAction(input, getTabId()),
    onSuccess: (quote) => {
      afterQuoteChange(qc, quote.projectId, { refetchType: "all" });
      notifyOtherTabs({ type: "quote.changed", projectId: quote.projectId });
    },
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, { quoteId: string; projectId: string }>({
    mutationFn: ({ quoteId, projectId }) => deleteQuoteAction(quoteId, projectId, getTabId()),
    onSuccess: (_res, { projectId }) => {
      afterQuoteChange(qc, projectId, { refetchType: "all" });
      notifyOtherTabs({ type: "quote.changed", projectId });
    },
  });
}

/** Preisstamm der Organisation (Offert-Editor + Verwaltung in Einstellungen). */
export function usePriceBookItems(enabled = true) {
  return useQuery<PriceBookItem[]>({
    queryKey: queryKeys.priceBook(),
    queryFn: () => listPriceBookItemsAction(),
    enabled,
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

export function useCreatePriceBookItem() {
  const qc = useQueryClient();
  return useMutation<PriceBookItem, Error, Parameters<typeof createPriceBookItemAction>[0]>({
    mutationFn: (input) => createPriceBookItemAction(input, getTabId()),
    onSuccess: () => {
      afterPriceBookChange(qc, { refetchType: "all" });
      notifyOtherTabs({ type: "price_book.changed" });
    },
  });
}

export function useUpdatePriceBookItem() {
  const qc = useQueryClient();
  return useMutation<PriceBookItem, Error, Parameters<typeof updatePriceBookItemAction>[0]>({
    mutationFn: (input) => updatePriceBookItemAction(input, getTabId()),
    onSuccess: () => {
      afterPriceBookChange(qc, { refetchType: "all" });
      notifyOtherTabs({ type: "price_book.changed" });
    },
  });
}

export function useDeletePriceBookItem() {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, { itemId: string }>({
    mutationFn: ({ itemId }) => deletePriceBookItemAction(itemId, getTabId()),
    onSuccess: () => {
      afterPriceBookChange(qc, { refetchType: "all" });
      notifyOtherTabs({ type: "price_book.changed" });
    },
  });
}

// ───────── Kontakte (Verzeichnis) ─────────

export function useContacts(enabled = true) {
  return useQuery<Contact[]>({
    queryKey: queryKeys.contacts(),
    queryFn: () => listContactsAction(),
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation<Contact, Error, Parameters<typeof createContactAction>[0]>({
    mutationFn: (values) => createContactAction(values, getTabId()),
    onSuccess: () => {
      afterContactChange(qc, { refetchType: "all" });
      notifyOtherTabs({ type: "contact.changed" });
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation<Contact, Error, Parameters<typeof updateContactAction>[0]>({
    mutationFn: (values) => updateContactAction(values, getTabId()),
    onSuccess: () => {
      afterContactChange(qc, { refetchType: "all" });
      notifyOtherTabs({ type: "contact.changed" });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (contactId) => deleteContactAction(contactId, getTabId()),
    onSuccess: () => {
      afterContactChange(qc, { refetchType: "all" });
      notifyOtherTabs({ type: "contact.changed" });
    },
  });
}

/** Verknüpfte Projekte eines Kontakts (Historie) — on-demand beim Öffnen. */
export function useContactProjects(contactId: string | null, enabled: boolean) {
  return useQuery<ContactProjectRow[]>({
    queryKey: queryKeys.contactProjects(contactId ?? "__none"),
    queryFn: () => listContactProjectsAction(contactId!),
    enabled: enabled && Boolean(contactId),
    staleTime: 30_000,
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

/** Projekt archivieren (Soft, Büro+Admin) — verschwindet aus der aktiven Liste. */
export function useArchiveProject() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (projectId) => archiveProjectAction(projectId, getTabId()),
    onSuccess: (_, projectId) => {
      afterProjectArchiveChanged(qc, projectId);
      notifyOtherTabs({ type: "project.archived", projectId });
    },
  });
}

/** Archiviertes Projekt wiederherstellen (Büro+Admin). */
export function useRestoreProject() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (projectId) => restoreProjectAction(projectId, getTabId()),
    onSuccess: (_, projectId) => {
      afterProjectArchiveChanged(qc, projectId);
      notifyOtherTabs({ type: "project.restored", projectId });
    },
  });
}

/** Endgültig löschen (Hard-Delete, unwiderruflich, nur Admin). */
export function useDeleteProjectPermanently() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (projectId) => deleteProjectPermanentlyAction(projectId, getTabId()),
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
