import type {
  Appointment,
  Article,
  ArticleCategory,
  ArticleCategoryTemplateScope,
  AuditEvent,
  CalendarEvent,
  Contact,
  ContactAddress,
  ContactCategory,
  ContactPartyKind,
  ContactPerson,
  Delivery,
  EmployeeStat,
  Invoice,
  KanbanCard,
  KanbanColumn,
  MailDispatchLog,
  ModuleLabel,
  Project,
  ProjectAttachment,
  ProjectChatAttachment,
  ProjectChatMessage,
  ProjectNote,
  ProjectStatus,
  PurchaseOrder,
  Quote,
  RoleType,
  OrganizationBranding,
  StockDecision,
  SupplierOrderSubmission,
  SupplierOrderFieldDefinition,
  SupplierEntity,
  SupplierOrderTemplate,
  TechnicianReport,
  UserProfile,
  WeekTaskItem,
  ApprovedRevenueSeries,
  CompanyKpiSnapshot,
  SiteProperty,
  ProjectWorkType,
  ProjectListRow,
  CalendarAppointmentItem,
} from "@/lib/domain/types";
import type { DashboardLayout } from "@/lib/dashboard/types";
import { parseDashboardLayout } from "@/lib/dashboard/types";
import {
  mockAppointments,
  mockArticleCategories,
  mockArticles,
  mockAuditEvents,
  mockCalendarEvents,
  mockContactAddresses,
  mockContactPersons,
  mockContacts,
  mockDeliveries,
  mockEmployeeStats,
  mockInvoices,
  mockKanbanCards,
  mockKanbanColumns,
  mockMailDispatchLogs,
  mockModuleLabels,
  mockNotes,
  mockOrders,
  mockProfiles,
  mockProjects,
  mockProjectChatAttachments,
  mockProjectAttachments,
  mockProjectChatMessages,
  mockQuotes,
  mockReports,
  mockStockDecisions,
  mockSupplierSubmissions,
  mockSupplierTemplates,
  mockSiteProperties,
  mockProjectWorkTypes,
} from "@/lib/db/mock-data";
import { getWeekBounds } from "@/lib/date/week-bounds";
import { resolveCalendarColor } from "@/lib/calendar/team-colors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getOrganizationBranding(organizationId: string | null): Promise<OrganizationBranding> {
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
}

type ProjectBundle = {
  project: Project;
  contact: Contact | null;
  property: SiteProperty | null;
  workType: ProjectWorkType | null;
  contactPerson: ContactPerson | null;
  serviceAddress: ContactAddress | null;
  billingAddress: ContactAddress | null;
  notes: ProjectNote[];
  attachments: ProjectAttachment[];
  appointments: Appointment[];
  reports: TechnicianReport[];
  quotes: Quote[];
  orders: PurchaseOrder[];
  deliveries: Delivery[];
  invoices: Invoice[];
  stockDecisions: StockDecision[];
  supplierSubmissions: SupplierOrderSubmission[];
};

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function getNextProjectNumberFromCodes(codes: Array<string | null | undefined>, year: number) {
  const prefix = `${year}-`;
  let max = 999;
  for (const code of codes) {
    if (!code || !code.startsWith(prefix)) {
      continue;
    }
    const n = Number(code.slice(prefix.length));
    if (Number.isFinite(n) && n > max) {
      max = n;
    }
  }
  return `${year}-${max + 1}`;
}

function isRoleType(v: unknown): v is RoleType {
  return v === "admin" || v === "office" || v === "technician";
}

export function mapUserProfileRow(row: Record<string, unknown>, emailFallback = ""): UserProfile {
  const r = row.role;
  return {
    id: String(row.id),
    displayName: String(row.display_name ?? row.displayName ?? ""),
    email: String(row.email ?? emailFallback),
    role: isRoleType(r) ? r : "office",
    avatarUrl: row.avatar_url != null ? String(row.avatar_url) : row.avatarUrl != null ? String(row.avatarUrl) : null,
    calendarColor: row.calendar_color != null ? String(row.calendar_color) : null,
    calendarPosition: Number(row.calendar_position ?? row.calendarPosition ?? 0),
  };
}

function mapProjectRow(row: Record<string, unknown>): Project {
  const contactRaw = row.contact_id ?? row.customer_id;
  return {
    id: String(row.id),
    contactId: contactRaw != null ? String(contactRaw) : "",
    title: String(row.title ?? ""),
    type: row.type as Project["type"],
    status: row.status as Project["status"],
    nextOwnerRole: row.next_owner_role as Project["nextOwnerRole"],
    nextOwnerUserId: row.next_owner_user_id ? String(row.next_owner_user_id) : null,
    source: row.source as Project["source"],
    urgency: row.urgency as Project["urgency"],
    intakeOriginalText: String(row.intake_original_text ?? ""),
    accessNotes: row.access_notes != null ? String(row.access_notes) : null,
    keyHandlingNotes: row.key_handling_notes != null ? String(row.key_handling_notes) : null,
    timingNotes: row.timing_notes != null ? String(row.timing_notes) : null,
    internalNotes: row.internal_notes != null ? String(row.internal_notes) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    closedAt: row.closed_at ? String(row.closed_at) : null,
    tenantUnit: row.tenant_unit != null ? String(row.tenant_unit) : null,
    sitePhone: row.site_phone != null ? String(row.site_phone) : null,
    siteMobile: row.site_mobile != null ? String(row.site_mobile) : null,
    referenceCode: row.reference_code != null ? String(row.reference_code) : null,
    technicianNotes: row.technician_notes != null ? String(row.technician_notes) : null,
    propertyId: row.property_id != null ? String(row.property_id) : null,
    mapsUrl: row.maps_url != null ? String(row.maps_url) : null,
    workTypeId: row.work_type_id != null ? String(row.work_type_id) : null,
    contactPersonId: row.contact_person_id != null ? String(row.contact_person_id) : null,
    serviceAddressId: row.service_address_id != null ? String(row.service_address_id) : null,
    billingAddressId: row.billing_address_id != null ? String(row.billing_address_id) : null,
    hintsAndNotes: row.hints_and_notes != null ? String(row.hints_and_notes) : null,
  };
}

function mapSitePropertyRow(row: Record<string, unknown>): SiteProperty {
  return {
    id: String(row.id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    name: String(row.name ?? ""),
    ownerContactId: row.owner_contact_id ? String(row.owner_contact_id) : null,
    street: row.street != null ? String(row.street) : null,
    postalCode: row.postal_code != null ? String(row.postal_code) : null,
    city: row.city != null ? String(row.city) : null,
    country: String(row.country ?? "CH"),
    mapsUrl: row.maps_url != null ? String(row.maps_url) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

function mapProjectWorkTypeRow(row: Record<string, unknown>): ProjectWorkType {
  return {
    id: String(row.id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    name: String(row.name ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapTemplateScope(v: unknown): ArticleCategoryTemplateScope {
  if (v === "storen" || v === "sonnenstoren" || v === "dl" || v === "generic") {
    return v;
  }
  return "generic";
}

function mapArticleCategoryRow(row: Record<string, unknown>): ArticleCategory {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    templateScope: mapTemplateScope(row.template_scope),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapArticleRow(row: Record<string, unknown>): Article {
  const nested = row.article_categories as
    | { name?: string; template_scope?: string }
    | { name?: string; template_scope?: string }[]
    | null
    | undefined;
  const cat = Array.isArray(nested) ? nested[0] : nested;
  const categoryId = row.article_category_id != null ? String(row.article_category_id) : "";
  let categoryName = cat?.name != null ? String(cat.name) : null;
  let categoryTemplateScope = mapTemplateScope(cat?.template_scope);
  if (!cat && categoryId) {
    const fromMock = mockArticleCategories.find((c) => c.id === categoryId);
    if (fromMock) {
      categoryName = fromMock.name;
      categoryTemplateScope = fromMock.templateScope;
    }
  }
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    sku: String(row.sku ?? ""),
    categoryId,
    categoryName,
    categoryTemplateScope,
    supplierId: row.supplier_id ? String(row.supplier_id) : null,
    purchasePrice: row.purchase_price != null ? Number(row.purchase_price) : null,
    salePrice: row.sale_price != null ? Number(row.sale_price) : null,
    unit: String(row.unit ?? "Stk"),
    descriptionLong: row.description_long != null ? String(row.description_long) : null,
    descriptionShort: row.description_short != null ? String(row.description_short) : null,
    inStock: Number(row.in_stock ?? 0),
    createdAt: String(row.created_at ?? ""),
  };
}

function isPartyKind(v: unknown): v is ContactPartyKind {
  return v === "privat" || v === "firma";
}

function isCategory(v: unknown): v is ContactCategory {
  return v === "kunde" || v === "lieferant" || v === "partner" || v === "sonstiges";
}

function mapContactRow(row: Record<string, unknown>): Contact {
  const pk = row.party_kind;
  const cat = row.category;
  return {
    id: String(row.id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    contactNumber: row.contact_number != null ? String(row.contact_number) : null,
    partyKind: isPartyKind(pk) ? pk : "firma",
    category: isCategory(cat) ? cat : "kunde",
    name: String(row.name ?? ""),
    uidNumber: row.uid_number != null ? String(row.uid_number) : null,
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    mobile: row.mobile != null ? String(row.mobile) : null,
    street: row.street != null ? String(row.street) : null,
    postalCode: row.postal_code != null ? String(row.postal_code) : null,
    city: row.city != null ? String(row.city) : null,
    website: row.website != null ? String(row.website) : null,
    managedObjectLabel: row.managed_object_label != null ? String(row.managed_object_label) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

function mapContactPersonRow(row: Record<string, unknown>): ContactPerson {
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    firstName: row.first_name != null ? String(row.first_name) : null,
    lastName: row.last_name != null ? String(row.last_name) : null,
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    mobile: row.mobile != null ? String(row.mobile) : null,
    roleTitle: row.role_title != null ? String(row.role_title) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

function mapContactAddressRow(row: Record<string, unknown>): ContactAddress {
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    label: String(row.label ?? "Adresse"),
    street: row.street != null ? String(row.street) : null,
    postalCode: row.postal_code != null ? String(row.postal_code) : null,
    city: row.city != null ? String(row.city) : null,
    country: String(row.country ?? "CH"),
    isPrimary: Boolean(row.is_primary),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapAppointmentRow(row: Record<string, unknown>): Appointment {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? row.projectId ?? ""),
    kind: (String(row.kind) as Appointment["kind"]) ?? "besichtigung",
    startsAt: String(row.starts_at ?? row.startsAt ?? ""),
    endsAt: String(row.ends_at ?? row.endsAt ?? ""),
    assignedTechnicianId: (row.assigned_technician_id as string | null) ?? (row.assignedTechnicianId as string | null) ?? null,
    planningNotes: (row.planning_notes as string | null) ?? (row.planningNotes as string | null) ?? null,
    accessNotes: (row.access_notes as string | null) ?? (row.accessNotes as string | null) ?? null,
    keyHandlingNotes: (row.key_handling_notes as string | null) ?? (row.keyHandlingNotes as string | null) ?? null,
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

function mapTechnicianReportRow(row: Record<string, unknown>): TechnicianReport {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? row.projectId ?? ""),
    outcome: String(row.outcome ?? "direkt_geloest") as TechnicianReport["outcome"],
    summary: String(row.summary ?? ""),
    measurementsJson: String(row.measurements_json ?? row.measurementsJson ?? "{}"),
    workDescription: String(row.work_description ?? row.workDescription ?? ""),
    timeSpentMinutes:
      row.time_spent_minutes != null
        ? Number(row.time_spent_minutes)
        : row.timeSpentMinutes != null
          ? Number(row.timeSpentMinutes)
          : null,
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

function mapStockDecisionRow(row: Record<string, unknown>): StockDecision {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? row.projectId ?? ""),
    decision: String(row.decision ?? "ab_lager") as StockDecision["decision"],
    notes: String(row.notes ?? ""),
    decidedByRole: String(row.decided_by_role ?? row.decidedByRole ?? "office") as StockDecision["decidedByRole"],
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

function mapSupplierOrderSubmissionRow(row: Record<string, unknown>): SupplierOrderSubmission {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? row.projectId ?? ""),
    templateId: String(row.template_id ?? row.templateId ?? ""),
    valuesJson: String(row.values_json ?? row.valuesJson ?? "{}"),
    status: String(row.status ?? "entwurf") as SupplierOrderSubmission["status"],
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

function mapQuoteRow(row: Record<string, unknown>): Quote {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? row.projectId ?? ""),
    version: Number(row.version ?? 1),
    status: String(row.status ?? "entwurf") as Quote["status"],
    sentAt: row.sent_at ? String(row.sent_at) : row.sentAt ? String(row.sentAt) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : row.approvedAt ? String(row.approvedAt) : null,
    pdfPath: row.pdf_path ? String(row.pdf_path) : row.pdfPath ? String(row.pdfPath) : null,
    pdfGeneratedAt: row.pdf_generated_at ? String(row.pdf_generated_at) : row.pdfGeneratedAt ? String(row.pdfGeneratedAt) : null,
    pdfVersion: Number(row.pdf_version ?? row.pdfVersion ?? 0),
    finalizedAt: row.finalized_at ? String(row.finalized_at) : row.finalizedAt ? String(row.finalizedAt) : null,
    finalizedBy: row.finalized_by ? String(row.finalized_by) : row.finalizedBy ? String(row.finalizedBy) : null,
    warrantyText: row.warranty_text != null ? String(row.warranty_text) : row.warrantyText != null ? String(row.warrantyText) : null,
    validityDays: row.validity_days != null ? Number(row.validity_days) : row.validityDays != null ? Number(row.validityDays) : null,
    leadTimeText: row.lead_time_text != null ? String(row.lead_time_text) : row.leadTimeText != null ? String(row.leadTimeText) : null,
    downPaymentPercent:
      row.down_payment_percent != null ? Number(row.down_payment_percent) : row.downPaymentPercent != null ? Number(row.downPaymentPercent) : null,
    paymentTermsText:
      row.payment_terms_text != null ? String(row.payment_terms_text) : row.paymentTermsText != null ? String(row.paymentTermsText) : null,
    salutationText: row.salutation_text != null ? String(row.salutation_text) : row.salutationText != null ? String(row.salutationText) : null,
    textBlocks: row.text_blocks != null ? String(row.text_blocks) : row.textBlocks != null ? String(row.textBlocks) : null,
    currency: String(row.currency ?? "CHF"),
    discountPercent: Number(row.discount_percent ?? row.discountPercent ?? 0),
    vatPercent: Number(row.vat_percent ?? row.vatPercent ?? 8.1),
    subtotalNet: Number(row.subtotal_net ?? row.subtotalNet ?? 0),
    discountAmount: Number(row.discount_amount ?? row.discountAmount ?? 0),
    totalNet: Number(row.total_net ?? row.totalNet ?? 0),
    vatAmount: Number(row.vat_amount ?? row.vatAmount ?? 0),
    totalGross: Number(row.total_gross ?? row.totalGross ?? 0),
    deliveryChannel:
      row.delivery_channel != null
        ? (String(row.delivery_channel) as Quote["deliveryChannel"])
        : row.deliveryChannel != null
          ? (String(row.deliveryChannel) as Quote["deliveryChannel"])
          : null,
    deliverySentAt:
      row.delivery_sent_at != null ? String(row.delivery_sent_at) : row.deliverySentAt != null ? String(row.deliverySentAt) : null,
    deliveryRecipient:
      row.delivery_recipient != null ? String(row.delivery_recipient) : row.deliveryRecipient != null ? String(row.deliveryRecipient) : null,
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
  };
}

function mapDeliveryRow(row: Record<string, unknown>): Delivery {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? row.projectId ?? ""),
    purchaseOrderId: row.purchase_order_id ? String(row.purchase_order_id) : row.purchaseOrderId ? String(row.purchaseOrderId) : null,
    deliveryNoteNumber: row.delivery_note_number != null ? String(row.delivery_note_number) : row.deliveryNoteNumber != null ? String(row.deliveryNoteNumber) : null,
    arrivedAt: String(row.arrived_at ?? row.arrivedAt ?? ""),
    checkedByRole: String(row.checked_by_role ?? row.checkedByRole ?? "office") as Delivery["checkedByRole"],
    pdfPath: row.pdf_path ? String(row.pdf_path) : row.pdfPath ? String(row.pdfPath) : null,
    pdfGeneratedAt: row.pdf_generated_at ? String(row.pdf_generated_at) : row.pdfGeneratedAt ? String(row.pdfGeneratedAt) : null,
    pdfVersion: Number(row.pdf_version ?? row.pdfVersion ?? 0),
    finalizedAt: row.finalized_at ? String(row.finalized_at) : row.finalizedAt ? String(row.finalizedAt) : null,
    finalizedBy: row.finalized_by ? String(row.finalized_by) : row.finalizedBy ? String(row.finalizedBy) : null,
    deliveryChannel:
      row.delivery_channel != null
        ? (String(row.delivery_channel) as Delivery["deliveryChannel"])
        : row.deliveryChannel != null
          ? (String(row.deliveryChannel) as Delivery["deliveryChannel"])
          : null,
    deliverySentAt:
      row.delivery_sent_at != null ? String(row.delivery_sent_at) : row.deliverySentAt != null ? String(row.deliverySentAt) : null,
    deliveryRecipient:
      row.delivery_recipient != null ? String(row.delivery_recipient) : row.deliveryRecipient != null ? String(row.deliveryRecipient) : null,
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
  };
}

function mapInvoiceRow(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? row.projectId ?? ""),
    invoiceNumber: row.invoice_number != null ? String(row.invoice_number) : row.invoiceNumber != null ? String(row.invoiceNumber) : null,
    status: String(row.status ?? "entwurf") as Invoice["status"],
    sentAt: row.sent_at ? String(row.sent_at) : row.sentAt ? String(row.sentAt) : null,
    pdfPath: row.pdf_path ? String(row.pdf_path) : row.pdfPath ? String(row.pdfPath) : null,
    pdfGeneratedAt: row.pdf_generated_at ? String(row.pdf_generated_at) : row.pdfGeneratedAt ? String(row.pdfGeneratedAt) : null,
    pdfVersion: Number(row.pdf_version ?? row.pdfVersion ?? 0),
    finalizedAt: row.finalized_at ? String(row.finalized_at) : row.finalizedAt ? String(row.finalizedAt) : null,
    finalizedBy: row.finalized_by ? String(row.finalized_by) : row.finalizedBy ? String(row.finalizedBy) : null,
    deliveryChannel:
      row.delivery_channel != null
        ? (String(row.delivery_channel) as Invoice["deliveryChannel"])
        : row.deliveryChannel != null
          ? (String(row.deliveryChannel) as Invoice["deliveryChannel"])
          : null,
    deliverySentAt:
      row.delivery_sent_at != null ? String(row.delivery_sent_at) : row.deliverySentAt != null ? String(row.deliverySentAt) : null,
    deliveryRecipient:
      row.delivery_recipient != null ? String(row.delivery_recipient) : row.deliveryRecipient != null ? String(row.deliveryRecipient) : null,
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
  };
}

function mapPurchaseOrderRow(row: Record<string, unknown>): PurchaseOrder {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? row.projectId ?? ""),
    supplierId: String(row.supplier_id ?? row.supplierId ?? ""),
    status: String(row.status ?? "entwurf") as PurchaseOrder["status"],
    emailSentAt: row.email_sent_at ? String(row.email_sent_at) : row.emailSentAt ? String(row.emailSentAt) : null,
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

export async function listProjects() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockProjects;
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as Record<string, unknown>[]).map(mapProjectRow);
}

export async function listProjectsWithContactNames(): Promise<ProjectListRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockProjects.map((p) => ({
      ...p,
      contactName: mockContacts.find((c) => c.id === p.contactId)?.name ?? null,
    }));
  }
  const { data, error } = await supabase
    .from("projects")
    .select("*, contacts ( name )")
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return (data as Record<string, unknown>[]).map((row) => {
    const project = mapProjectRow(row);
    const raw = row.contacts as { name?: string } | { name?: string }[] | null | undefined;
    const c = Array.isArray(raw) ? raw[0] : raw;
    return {
      ...project,
      contactName: c?.name != null ? String(c.name) : null,
    };
  });
}

/** Termine in einem Zeitraum (Monatskalender). */
export async function listAppointmentsInRange(start: Date, end: Date): Promise<CalendarAppointmentItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const items: CalendarAppointmentItem[] = [];
    for (const a of mockAppointments) {
      const t = new Date(a.startsAt);
      if (t < start || t > end) {
        continue;
      }
      const p = mockProjects.find((pr) => pr.id === a.projectId);
      if (!p) {
        continue;
      }
      const tid = a.assignedTechnicianId;
      const prof = tid ? mockProfiles.find((m) => m.id === tid) : undefined;
      items.push({
        id: a.id,
        projectId: p.id,
        projectTitle: p.title,
        kind: a.kind,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        technicianName: prof?.displayName ?? null,
        calendarColor: resolveCalendarColor(prof?.calendarColor ?? null, tid),
      });
    }
    if (items.length === 0 && mockProjects.length > 0) {
      const p = mockProjects[0];
      const d = new Date(start);
      d.setDate(Math.min(15, end.getDate()));
      d.setHours(9, 0, 0, 0);
      const endA = new Date(d);
      endA.setHours(10, 0, 0, 0);
      const tid = "u-tech-1";
      const prof = mockProfiles.find((m) => m.id === tid);
      items.push({
        id: "mock-cal-demo",
        projectId: p.id,
        projectTitle: p.title,
        kind: "besichtigung",
        startsAt: d.toISOString(),
        endsAt: endA.toISOString(),
        technicianName: prof?.displayName ?? null,
        calendarColor: resolveCalendarColor(prof?.calendarColor ?? null, tid),
      });
    }
    return items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

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
      projects ( title )
    `,
    )
    .gte("starts_at", start.toISOString())
    .lte("starts_at", end.toISOString())
    .order("starts_at", { ascending: true });

  if (error || !data?.length) {
    return [];
  }

  const rows = data as {
    id: string;
    project_id: string;
    kind: CalendarAppointmentItem["kind"];
    starts_at: string;
    ends_at: string;
    assigned_technician_id: string | null;
    projects: { title: string } | { title: string }[] | null;
  }[];

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

  return rows.map((row) => {
    const raw = row.projects;
    const pr = Array.isArray(raw) ? raw[0] : raw;
    const tid = row.assigned_technician_id;
    const tp = tid ? techMap.get(tid) : undefined;
    return {
      id: row.id,
      projectId: row.project_id,
      projectTitle: pr?.title != null ? String(pr.title) : "",
      kind: row.kind,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      technicianName: tp?.display_name ?? null,
      calendarColor: resolveCalendarColor(tp?.calendar_color ?? null, tid),
    };
  });
}

function listWeekTasksMock(weekStart: Date, weekEnd: Date): WeekTaskItem[] {
  const items: WeekTaskItem[] = [];
  for (const a of mockAppointments) {
    const t = new Date(a.startsAt);
    if (t < weekStart || t > weekEnd) {
      continue;
    }
    const p = mockProjects.find((pr) => pr.id === a.projectId);
    if (!p) {
      continue;
    }
    const tid = a.assignedTechnicianId;
    const prof = tid ? mockProfiles.find((m) => m.id === tid) : undefined;
    items.push({
      appointmentId: a.id,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      kind: a.kind,
      projectId: p.id,
      projectTitle: p.title,
      projectStatus: p.status,
      urgency: p.urgency,
      assignedTechnicianId: tid,
      technicianName: prof?.displayName ?? null,
      calendarColor: resolveCalendarColor(prof?.calendarColor ?? null, tid),
    });
  }
  if (items.length === 0) {
    const open = mockProjects.filter((p) => p.status !== "abgeschlossen");
    open.forEach((p, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + Math.min(i, 6));
      d.setHours(8 + (i % 4), (i * 20) % 60, 0, 0);
      const endA = new Date(d);
      endA.setHours(d.getHours() + 1);
      const tid = i % 2 === 0 ? "u-tech-1" : "u-admin-1";
      const prof = mockProfiles.find((m) => m.id === tid);
      items.push({
        appointmentId: `mock-week-${p.id}`,
        startsAt: d.toISOString(),
        endsAt: endA.toISOString(),
        kind: i % 2 === 0 ? "besichtigung" : "ausfuehrung",
        projectId: p.id,
        projectTitle: p.title,
        projectStatus: p.status,
        urgency: p.urgency,
        assignedTechnicianId: tid,
        technicianName: prof?.displayName ?? null,
        calendarColor: resolveCalendarColor(prof?.calendarColor ?? null, tid),
      });
    });
  }
  return items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Termine (`appointments`) mit `starts_at` in der Kalenderwoche, nach Zeit sortiert (links → rechts abarbeiten). */
export async function listWeekTasks(referenceDate = new Date()): Promise<WeekTaskItem[]> {
  const { start, end } = getWeekBounds(referenceDate);
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return listWeekTasksMock(start, end);
  }

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
        urgency
      )
    `,
    )
    .gte("starts_at", start.toISOString())
    .lte("starts_at", end.toISOString())
    .order("starts_at", { ascending: true });

  if (error || !data?.length) {
    return [];
  }

  const rows = data as {
    id: string;
    project_id: string;
    kind: WeekTaskItem["kind"];
    starts_at: string;
    ends_at: string;
    assigned_technician_id: string | null;
    projects: { title: string; status: string; urgency: string } | { title: string; status: string; urgency: string }[] | null;
  }[];

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
      if (!pr?.title) {
        return null;
      }
      const tid = row.assigned_technician_id;
      const tp = tid ? techMap.get(tid) : undefined;
      return {
        appointmentId: row.id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        kind: row.kind,
        projectId: row.project_id,
        projectTitle: pr.title,
        projectStatus: pr.status as ProjectStatus,
        urgency: pr.urgency as WeekTaskItem["urgency"],
        assignedTechnicianId: tid,
        technicianName: tp?.display_name ?? null,
        calendarColor: resolveCalendarColor(tp?.calendar_color ?? null, tid),
      };
    })
    .filter((x): x is WeekTaskItem => x !== null);
}

/** Typischer Planungs-Deckungsbeitrag (ohne Einkauf in der Datenbank); nur als Orientierung. */
const PLANNING_MARGIN_FACTOR = 0.34;

export async function getCompanyKpis(referenceDate = new Date()): Promise<CompanyKpiSnapshot> {
  const { start, end } = getWeekBounds(referenceDate);
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    let weekAppts = 0;
    for (const a of mockAppointments) {
      const t = new Date(a.startsAt);
      if (t >= start && t <= end) {
        weekAppts++;
      }
    }
    return {
      revenueApprovedChf: 0,
      estimatedGrossContributionChf: 0,
      contactsCount: mockContacts.length,
      activeProjectsCount: mockProjects.filter((p) => p.status !== "abgeschlossen").length,
      completedProjectsCount: mockProjects.filter((p) => p.status === "abgeschlossen").length,
      openInvoicesCount: mockInvoices.filter((i) => i.status !== "bezahlt").length,
      quoteWinRatePercent: null,
      quotesDecidedCount: 0,
      appointmentsThisWeekCount: weekAppts,
      purchaseOrdersInTransit: mockOrders.filter((o) => o.status !== "geliefert" && o.status !== "entwurf").length,
      supabaseConnected: false,
    };
  }

  const [
    { count: contactsCount },
    { data: projectStatuses },
    { data: quoteRows },
    { data: quoteItemRows },
    { count: openInvoicesCount },
    { count: weekApptCount },
    { data: poStatuses },
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("status"),
    supabase.from("quotes").select("status"),
    supabase.from("quote_items").select("quantity, unit_price, quotes(status)"),
    supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .neq("status", "bezahlt"),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .gte("starts_at", start.toISOString())
      .lte("starts_at", end.toISOString()),
    supabase.from("purchase_orders").select("status"),
  ]);

  const projects = (projectStatuses ?? []) as { status: string }[];
  const activeProjectsCount = projects.filter((p) => p.status !== "abgeschlossen").length;
  const completedProjectsCount = projects.filter((p) => p.status === "abgeschlossen").length;

  const qrows = (quoteRows ?? []) as { status: string }[];
  const approvedQ = qrows.filter((q) => q.status === "genehmigt").length;
  const rejectedQ = qrows.filter((q) => q.status === "abgelehnt").length;
  const quotesDecidedCount = approvedQ + rejectedQ;
  const quoteWinRatePercent =
    quotesDecidedCount > 0 ? Math.round((100 * approvedQ) / quotesDecidedCount) : null;

  let revenueApprovedChf = 0;
  for (const row of quoteItemRows ?? []) {
    const raw = row as {
      quantity: string | number;
      unit_price: string | number;
      quotes: { status: string } | { status: string }[] | null;
    };
    const q = raw.quotes;
    const st = Array.isArray(q) ? q[0]?.status : q?.status;
    if (st !== "genehmigt") {
      continue;
    }
    revenueApprovedChf += Number(raw.quantity) * Number(raw.unit_price);
  }

  const estimatedGrossContributionChf = Math.round(revenueApprovedChf * PLANNING_MARGIN_FACTOR * 100) / 100;

  const pos = (poStatuses ?? []) as { status: string }[];
  const purchaseOrdersInTransit = pos.filter(
    (p) => p.status === "gesendet" || p.status === "bestaetigt",
  ).length;

  return {
    revenueApprovedChf: Math.round(revenueApprovedChf * 100) / 100,
    estimatedGrossContributionChf,
    contactsCount: contactsCount ?? 0,
    activeProjectsCount,
    completedProjectsCount,
    openInvoicesCount: openInvoicesCount ?? 0,
    quoteWinRatePercent,
    quotesDecidedCount,
    appointmentsThisWeekCount: weekApptCount ?? 0,
    purchaseOrdersInTransit,
    supabaseConnected: true,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function eachDayInRange(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    keys.push(dayKeyLocal(d));
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

function eachMonthInRange(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (d <= end) {
    keys.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
    d.setMonth(d.getMonth() + 1);
  }
  return keys;
}

function labelForDayKey(key: string): string {
  const p = key.split("-").map(Number);
  const dt = new Date(p[0]!, p[1]! - 1, p[2]!);
  return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "short" }).format(dt);
}

function labelForMonthKey(key: string): string {
  const p = key.split("-").map(Number);
  const dt = new Date(p[0]!, p[1]! - 1, 1);
  return new Intl.DateTimeFormat("de-CH", { month: "short", year: "2-digit" }).format(dt);
}

/** Umsatz aus genehmigten Offerten im Zeitraum — Tages- oder Monatsbuckets (automatisch). */
export async function getApprovedRevenueSeries(from: Date, to: Date): Promise<ApprovedRevenueSeries> {
  const fromT = new Date(from);
  fromT.setHours(0, 0, 0, 0);
  const toT = new Date(to);
  toT.setHours(23, 59, 59, 999);

  if (toT < fromT) {
    return { points: [], bucket: "day" };
  }

  const dayCount = Math.ceil((toT.getTime() - fromT.getTime()) / 86400000) + 1;
  const useDaily = dayCount <= 46;

  const keys = useDaily ? eachDayInRange(fromT, toT) : eachMonthInRange(fromT, toT);
  const acc = new Map<string, number>(keys.map((k) => [k, 0]));

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      bucket: useDaily ? "day" : "month",
      points: keys.map((k) => ({
        key: k,
        labelShort: useDaily ? labelForDayKey(k) : labelForMonthKey(k),
        amountChf: 0,
      })),
    };
  }

  const { data: quoteItemRows } = await supabase
    .from("quote_items")
    .select("quantity, unit_price, quotes(status, approved_at, created_at)");

  for (const row of quoteItemRows ?? []) {
    const raw = row as {
      quantity: string | number;
      unit_price: string | number;
      quotes:
        | { status: string; approved_at: string | null; created_at: string }
        | { status: string; approved_at: string | null; created_at: string }[]
        | null;
    };
    const q = raw.quotes;
    const qr = Array.isArray(q) ? q[0] : q;
    if (!qr || qr.status !== "genehmigt") {
      continue;
    }
    const iso = qr.approved_at ?? qr.created_at;
    if (!iso) {
      continue;
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()) || d < fromT || d > toT) {
      continue;
    }
    const bk = useDaily ? dayKeyLocal(d) : monthKeyLocal(d);
    if (!acc.has(bk)) {
      continue;
    }
    const amt = Number(raw.quantity) * Number(raw.unit_price);
    acc.set(bk, (acc.get(bk) ?? 0) + amt);
  }

  return {
    bucket: useDaily ? "day" : "month",
    points: keys.map((k) => ({
      key: k,
      labelShort: useDaily ? labelForDayKey(k) : labelForMonthKey(k),
      amountChf: Math.round((acc.get(k) ?? 0) * 100) / 100,
    })),
  };
}

export async function listContacts(): Promise<Contact[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockContacts;
  }

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as Record<string, unknown>[]).map((row) => mapContactRow(row));
}

export async function listSupplierContactNames(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return Array.from(
      new Set(
        mockContacts
          .filter((c) => c.category === "lieferant")
          .map((c) => c.name.trim())
          .filter((n) => n.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b, "de-CH"));
  }
  const { data } = await supabase
    .from("contacts")
    .select("name")
    .eq("category", "lieferant")
    .order("name", { ascending: true });
  const rows = (data ?? []) as Array<{ name: string }>;
  return Array.from(
    new Set(
      rows
        .map((r) => String(r.name ?? "").trim())
        .filter((n) => n.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, "de-CH"));
}

export async function getContactWithDetails(contactId: string): Promise<{
  contact: Contact;
  persons: ContactPerson[];
  addresses: ContactAddress[];
  siteProperties: SiteProperty[];
} | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const contact = mockContacts.find((c) => c.id === contactId);
    if (!contact) {
      return null;
    }
    return {
      contact,
      persons: mockContactPersons.filter((p) => p.contactId === contactId),
      addresses: mockContactAddresses.filter((a) => a.contactId === contactId),
      siteProperties: mockSiteProperties.filter((p) => p.ownerContactId === contactId),
    };
  }

  const [{ data: row }, { data: personRows }, { data: addressRows }, { data: propertyRows }] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", contactId).maybeSingle(),
    supabase.from("contact_persons").select("*").eq("contact_id", contactId).order("created_at"),
    supabase.from("contact_addresses").select("*").eq("contact_id", contactId).order("created_at"),
    supabase.from("site_properties").select("*").eq("owner_contact_id", contactId).order("name", { ascending: true }),
  ]);

  if (!row) {
    return null;
  }

  return {
    contact: mapContactRow(row as Record<string, unknown>),
    persons: (personRows ?? []).map((r) => mapContactPersonRow(r as Record<string, unknown>)),
    addresses: (addressRows ?? []).map((r) => mapContactAddressRow(r as Record<string, unknown>)),
    siteProperties: (propertyRows ?? []).map((r) => mapSitePropertyRow(r as Record<string, unknown>)),
  };
}

export async function getProjectBundle(projectId: string): Promise<ProjectBundle | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const project = mockProjects.find((item) => item.id === projectId);
    if (!project) {
      return null;
    }

    return {
      project,
      contact: mockContacts.find((item) => item.id === project.contactId) ?? null,
      property: project.propertyId
        ? mockSiteProperties.find((p) => p.id === project.propertyId) ?? null
        : null,
      workType: project.workTypeId
        ? mockProjectWorkTypes.find((w) => w.id === project.workTypeId) ?? null
        : null,
      contactPerson: project.contactPersonId
        ? mockContactPersons.find((p) => p.id === project.contactPersonId) ?? null
        : null,
      serviceAddress: project.serviceAddressId
        ? mockContactAddresses.find((a) => a.id === project.serviceAddressId) ?? null
        : null,
      billingAddress: project.billingAddressId
        ? mockContactAddresses.find((a) => a.id === project.billingAddressId) ?? null
        : null,
      notes: mockNotes.filter((item) => item.projectId === projectId),
      attachments: mockProjectAttachments.filter((item) => item.projectId === projectId),
      appointments: mockAppointments.filter((item) => item.projectId === projectId),
      reports: mockReports.filter((item) => item.projectId === projectId),
      quotes: mockQuotes.filter((item) => item.projectId === projectId),
      orders: mockOrders.filter((item) => item.projectId === projectId),
      deliveries: mockDeliveries.filter((item) => item.projectId === projectId),
      invoices: mockInvoices.filter((item) => item.projectId === projectId),
      stockDecisions: mockStockDecisions.filter((item) => item.projectId === projectId),
      supplierSubmissions: mockSupplierSubmissions.filter((item) => item.projectId === projectId),
    };
  }

  const [{ data: project }, { data: notes }, { data: attachments }, { data: appointments }, { data: reports }, { data: quotes }, { data: orders }, { data: deliveries }, { data: invoices }, { data: stockDecisions }, { data: supplierSubmissions }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("project_notes").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("project_attachments").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("appointments").select("*").eq("project_id", projectId).order("starts_at"),
      supabase.from("technician_reports").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("quotes").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("purchase_orders").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("deliveries").select("*").eq("project_id", projectId).order("arrived_at"),
      supabase.from("invoices").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("stock_decisions").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("supplier_order_form_submissions").select("*").eq("project_id", projectId).order("created_at"),
    ]);

  if (!project) {
    return null;
  }

  const projRow = project as Record<string, unknown>;
  const mappedProject = mapProjectRow(projRow);
  const [
    { data: contactRow },
    { data: propertyRow },
    { data: workTypeRow },
    { data: cpRow },
    { data: saRow },
    { data: baRow },
  ] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", mappedProject.contactId).maybeSingle(),
    mappedProject.propertyId
      ? supabase.from("site_properties").select("*").eq("id", mappedProject.propertyId).maybeSingle()
      : Promise.resolve({ data: null }),
    mappedProject.workTypeId
      ? supabase.from("project_work_types").select("*").eq("id", mappedProject.workTypeId).maybeSingle()
      : Promise.resolve({ data: null }),
    mappedProject.contactPersonId
      ? supabase.from("contact_persons").select("*").eq("id", mappedProject.contactPersonId).maybeSingle()
      : Promise.resolve({ data: null }),
    mappedProject.serviceAddressId
      ? supabase.from("contact_addresses").select("*").eq("id", mappedProject.serviceAddressId).maybeSingle()
      : Promise.resolve({ data: null }),
    mappedProject.billingAddressId
      ? supabase.from("contact_addresses").select("*").eq("id", mappedProject.billingAddressId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    project: mappedProject,
    contact: contactRow ? mapContactRow(contactRow as Record<string, unknown>) : null,
    property: propertyRow ? mapSitePropertyRow(propertyRow as Record<string, unknown>) : null,
    workType: workTypeRow ? mapProjectWorkTypeRow(workTypeRow as Record<string, unknown>) : null,
    contactPerson: cpRow ? mapContactPersonRow(cpRow as Record<string, unknown>) : null,
    serviceAddress: saRow ? mapContactAddressRow(saRow as Record<string, unknown>) : null,
    billingAddress: baRow ? mapContactAddressRow(baRow as Record<string, unknown>) : null,
    notes: (notes as unknown as ProjectNote[]) ?? [],
    attachments: ((attachments as Array<Record<string, unknown>> | null) ?? []).map(mapProjectAttachmentRow),
    appointments: ((appointments as Array<Record<string, unknown>> | null) ?? []).map(mapAppointmentRow),
    reports: ((reports as Array<Record<string, unknown>> | null) ?? []).map(mapTechnicianReportRow),
    quotes: ((quotes as Array<Record<string, unknown>> | null) ?? []).map(mapQuoteRow),
    orders: ((orders as Array<Record<string, unknown>> | null) ?? []).map(mapPurchaseOrderRow),
    deliveries: ((deliveries as Array<Record<string, unknown>> | null) ?? []).map(mapDeliveryRow),
    invoices: ((invoices as Array<Record<string, unknown>> | null) ?? []).map(mapInvoiceRow),
    stockDecisions: ((stockDecisions as Array<Record<string, unknown>> | null) ?? []).map(mapStockDecisionRow),
    supplierSubmissions: ((supplierSubmissions as Array<Record<string, unknown>> | null) ?? []).map(
      mapSupplierOrderSubmissionRow,
    ),
  };
}

export async function createContact(input: Omit<Contact, "id" | "createdAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    let contactNumber = input.contactNumber?.trim() || null;
    if (!contactNumber && input.category === "kunde") {
      const peers = mockContacts.filter(
        (c) => c.category === "kunde" && c.organizationId === input.organizationId,
      );
      const next = peers.length + 1;
      contactNumber = `K-${String(next).padStart(2, "0")}`;
    }
    const contact: Contact = { id: id("c"), createdAt: new Date().toISOString(), ...input, contactNumber };
    mockContacts.push(contact);
    return contact;
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      organization_id: input.organizationId,
      contact_number: input.contactNumber?.trim() || null,
      party_kind: input.partyKind,
      category: input.category,
      name: input.name,
      uid_number: input.uidNumber,
      email: input.email,
      phone: input.phone,
      mobile: input.mobile,
      street: input.street,
      postal_code: input.postalCode,
      city: input.city,
      website: input.website,
      managed_object_label: input.managedObjectLabel,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Kontakt konnte nicht erstellt werden.");
  }

  return mapContactRow(data as Record<string, unknown>);
}

export async function insertContactPerson(input: Omit<ContactPerson, "id" | "createdAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const row: ContactPerson = { id: id("cp"), createdAt: new Date().toISOString(), ...input };
    mockContactPersons.push(row);
    return row;
  }
  const { data, error } = await supabase
    .from("contact_persons")
    .insert({
      contact_id: input.contactId,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      mobile: input.mobile,
      role_title: input.roleTitle,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Ansprechpartner konnte nicht gespeichert werden.");
  }
  return mapContactPersonRow(data as Record<string, unknown>);
}

export async function insertContactAddress(input: Omit<ContactAddress, "id" | "createdAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const row: ContactAddress = { id: id("ca"), createdAt: new Date().toISOString(), ...input };
    mockContactAddresses.push(row);
    return row;
  }
  const { data, error } = await supabase
    .from("contact_addresses")
    .insert({
      contact_id: input.contactId,
      label: input.label,
      street: input.street,
      postal_code: input.postalCode,
      city: input.city,
      country: input.country,
      is_primary: input.isPrimary,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Adresse konnte nicht gespeichert werden.");
  }
  return mapContactAddressRow(data as Record<string, unknown>);
}

export type ContactUpdateFields = Pick<
  Contact,
  | "partyKind"
  | "category"
  | "contactNumber"
  | "name"
  | "uidNumber"
  | "email"
  | "phone"
  | "mobile"
  | "street"
  | "postalCode"
  | "city"
  | "website"
  | "managedObjectLabel"
>;

export async function updateContact(contactId: string, input: ContactUpdateFields): Promise<Contact> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockContacts.findIndex((c) => c.id === contactId);
    if (idx === -1) {
      throw new Error("Kontakt nicht gefunden.");
    }
    mockContacts[idx] = { ...mockContacts[idx]!, ...input };
    return mockContacts[idx]!;
  }

  const { data, error } = await supabase
    .from("contacts")
    .update({
      party_kind: input.partyKind,
      category: input.category,
      contact_number: input.contactNumber?.trim() || null,
      name: input.name,
      uid_number: input.uidNumber,
      email: input.email,
      phone: input.phone,
      mobile: input.mobile,
      street: input.street,
      postal_code: input.postalCode,
      city: input.city,
      website: input.website,
      managed_object_label: input.managedObjectLabel,
    })
    .eq("id", contactId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Kontakt konnte nicht aktualisiert werden.");
  }
  return mapContactRow(data as Record<string, unknown>);
}

type ContactPersonUpdateFields = Omit<ContactPerson, "id" | "contactId" | "createdAt">;

export async function updateContactPerson(personId: string, input: ContactPersonUpdateFields): Promise<ContactPerson> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockContactPersons.findIndex((p) => p.id === personId);
    if (idx === -1) {
      throw new Error("Ansprechpartner nicht gefunden.");
    }
    mockContactPersons[idx] = { ...mockContactPersons[idx]!, ...input };
    return mockContactPersons[idx]!;
  }
  const { data, error } = await supabase
    .from("contact_persons")
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      mobile: input.mobile,
      role_title: input.roleTitle,
    })
    .eq("id", personId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Ansprechpartner konnte nicht aktualisiert werden.");
  }
  return mapContactPersonRow(data as Record<string, unknown>);
}

export async function deleteContactPerson(personId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockContactPersons.findIndex((p) => p.id === personId);
    if (idx !== -1) {
      mockContactPersons.splice(idx, 1);
    }
    return;
  }
  const { error } = await supabase.from("contact_persons").delete().eq("id", personId);
  if (error) {
    throw new Error("Ansprechpartner konnte nicht gelöscht werden.");
  }
}

type ContactAddressUpdateFields = Omit<ContactAddress, "id" | "contactId" | "createdAt">;

export async function updateContactAddress(addressId: string, input: ContactAddressUpdateFields): Promise<ContactAddress> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockContactAddresses.findIndex((a) => a.id === addressId);
    if (idx === -1) {
      throw new Error("Adresse nicht gefunden.");
    }
    mockContactAddresses[idx] = { ...mockContactAddresses[idx]!, ...input };
    return mockContactAddresses[idx]!;
  }
  const { data, error } = await supabase
    .from("contact_addresses")
    .update({
      label: input.label,
      street: input.street,
      postal_code: input.postalCode,
      city: input.city,
      country: input.country,
      is_primary: input.isPrimary,
    })
    .eq("id", addressId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Adresse konnte nicht aktualisiert werden.");
  }
  return mapContactAddressRow(data as Record<string, unknown>);
}

export async function deleteContactAddress(addressId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockContactAddresses.findIndex((a) => a.id === addressId);
    if (idx !== -1) {
      mockContactAddresses.splice(idx, 1);
    }
    return;
  }
  const { error } = await supabase.from("contact_addresses").delete().eq("id", addressId);
  if (error) {
    throw new Error("Adresse konnte nicht gelöscht werden.");
  }
}

export async function deleteContact(contactId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockContacts.findIndex((c) => c.id === contactId);
    if (idx !== -1) {
      mockContacts.splice(idx, 1);
    }
    for (let i = mockContactPersons.length - 1; i >= 0; i -= 1) {
      if (mockContactPersons[i]?.contactId === contactId) {
        mockContactPersons.splice(i, 1);
      }
    }
    for (let i = mockContactAddresses.length - 1; i >= 0; i -= 1) {
      if (mockContactAddresses[i]?.contactId === contactId) {
        mockContactAddresses.splice(i, 1);
      }
    }
    return;
  }
  const { error } = await supabase.from("contacts").delete().eq("id", contactId);
  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("violates foreign key constraint") || msg.includes("foreign key")) {
      throw new Error("Kontakt wird in Projekten verwendet und kann nicht gelöscht werden.");
    }
    throw new Error(error.message || "Kontakt konnte nicht gelöscht werden.");
  }
}

export async function createProject(input: Omit<Project, "id" | "createdAt" | "updatedAt" | "closedAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const now = new Date().toISOString();
    const year = new Date(now).getFullYear();
    const referenceCode =
      input.referenceCode && input.referenceCode.trim().length > 0
        ? input.referenceCode
        : getNextProjectNumberFromCodes(
            mockProjects.map((p) => p.referenceCode),
            year,
          );
    const project: Project = {
      ...input,
      referenceCode,
      id: id("p"),
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    };
    mockProjects.push(project);
    return project;
  }

  const { data, error } = await supabase.from("projects").insert({
    contact_id: input.contactId,
    title: input.title,
    type: input.type,
    status: input.status,
    next_owner_role: input.nextOwnerRole,
    next_owner_user_id: input.nextOwnerUserId,
    source: input.source,
    urgency: input.urgency,
    intake_original_text: input.intakeOriginalText,
    access_notes: input.accessNotes,
    key_handling_notes: input.keyHandlingNotes,
    timing_notes: input.timingNotes,
    internal_notes: input.internalNotes,
    tenant_unit: input.tenantUnit,
    site_phone: input.sitePhone,
    site_mobile: input.siteMobile,
    reference_code: input.referenceCode,
    technician_notes: input.technicianNotes,
    property_id: input.propertyId,
    maps_url: input.mapsUrl,
    work_type_id: input.workTypeId,
    contact_person_id: input.contactPersonId,
    service_address_id: input.serviceAddressId,
    billing_address_id: input.billingAddressId,
    hints_and_notes: input.hintsAndNotes,
  }).select("*").single();

  if (error || !data) {
    throw new Error(error?.message ?? "Projekt konnte nicht erstellt werden.");
  }

  return mapProjectRow(data as Record<string, unknown>);
}

export async function deleteProject(projectId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockProjects.findIndex((p) => p.id === projectId);
    if (idx !== -1) {
      mockProjects.splice(idx, 1);
    }
    return;
  }

  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) {
    throw new Error(error.message || "Projekt konnte nicht gelöscht werden.");
  }
}

export async function listSiteProperties(): Promise<SiteProperty[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [...mockSiteProperties].sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
  }
  const { data: oid } = await supabase.rpc("current_organization_id");
  const orgId = oid as string | null;
  let q = supabase.from("site_properties").select("*").order("name", { ascending: true });
  if (orgId) {
    q = q.eq("organization_id", orgId);
  }
  const { data, error } = await q;
  if (error || !data) {
    return [];
  }
  return (data as Record<string, unknown>[]).map(mapSitePropertyRow);
}

export async function insertSiteProperty(input: {
  organizationId: string | null;
  ownerContactId: string | null;
  name: string;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  mapsUrl?: string | null;
}): Promise<SiteProperty> {
  const supabase = await createSupabaseServerClient();
  const name = input.name.trim();
  if (!name) {
    throw new Error("Objektname fehlt.");
  }
  if (!supabase) {
    const row: SiteProperty = {
      id: id("sp"),
      organizationId: input.organizationId ?? null,
      ownerContactId: input.ownerContactId ?? null,
      name,
      street: input.street ?? null,
      postalCode: input.postalCode ?? null,
      city: input.city ?? null,
      country: input.country?.trim() || "CH",
      mapsUrl: input.mapsUrl ?? null,
      createdAt: new Date().toISOString(),
    };
    mockSiteProperties.push(row);
    return row;
  }
  const { data, error } = await supabase
    .from("site_properties")
    .insert({
      organization_id: input.organizationId ?? null,
      owner_contact_id: input.ownerContactId ?? null,
      name,
      street: input.street ?? null,
      postal_code: input.postalCode ?? null,
      city: input.city ?? null,
      country: input.country?.trim() || "CH",
      maps_url: input.mapsUrl ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Objekt konnte nicht angelegt werden.");
  }
  return mapSitePropertyRow(data as Record<string, unknown>);
}

export async function deleteSiteProperty(propertyId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockSiteProperties.findIndex((p) => p.id === propertyId);
    if (idx !== -1) {
      mockSiteProperties.splice(idx, 1);
    }
    return;
  }
  const { error } = await supabase.from("site_properties").delete().eq("id", propertyId);
  if (error) {
    throw new Error(error.message || "Objekt konnte nicht gelöscht werden.");
  }
}

export async function listProjectWorkTypes(): Promise<ProjectWorkType[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [...mockProjectWorkTypes].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  const { data: oid } = await supabase.rpc("current_organization_id");
  const orgId = oid as string | null;
  let q = supabase.from("project_work_types").select("*").order("sort_order", { ascending: true });
  if (orgId) {
    q = q.eq("organization_id", orgId);
  }
  const { data, error } = await q;
  if (error || !data) {
    return [];
  }
  return (data as Record<string, unknown>[]).map(mapProjectWorkTypeRow);
}

export async function listContactPersonsForContact(contactId: string): Promise<ContactPerson[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockContactPersons.filter((p) => p.contactId === contactId);
  }
  const { data, error } = await supabase
    .from("contact_persons")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    return [];
  }
  return (data as Record<string, unknown>[]).map((r) => mapContactPersonRow(r));
}

export async function listContactAddressesForContact(contactId: string): Promise<ContactAddress[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockContactAddresses.filter((a) => a.contactId === contactId);
  }
  const { data, error } = await supabase
    .from("contact_addresses")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    return [];
  }
  return (data as Record<string, unknown>[]).map((r) => mapContactAddressRow(r));
}

export async function listAssignableProfiles(): Promise<UserProfile[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [...mockProfiles].sort(
      (a, b) => a.calendarPosition - b.calendarPosition || a.displayName.localeCompare(b.displayName),
    );
  }
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("calendar_position", { ascending: true })
    .order("display_name", { ascending: true });
  return ((data as Record<string, unknown>[]) ?? []).map((r) => mapUserProfileRow(r));
}

export async function insertProjectWorkType(name: string): Promise<ProjectWorkType> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Bezeichnung fehlt.");
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const row: ProjectWorkType = {
      id: id("wt"),
      organizationId: null,
      name: trimmed,
      sortOrder: mockProjectWorkTypes.length * 10,
      createdAt: new Date().toISOString(),
    };
    mockProjectWorkTypes.push(row);
    return row;
  }
  const { data: oid } = await supabase.rpc("current_organization_id");
  const orgId = oid as string | null;
  if (!orgId) {
    throw new Error("Keine Organisation ausgewählt.");
  }
  const { data, error } = await supabase
    .from("project_work_types")
    .insert({
      organization_id: orgId,
      name: trimmed,
      sort_order: 999,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Arbeitsart konnte nicht gespeichert werden.");
  }
  return mapProjectWorkTypeRow(data as Record<string, unknown>);
}

export type ProjectStammdatenPatch = Partial<
  Pick<
    Project,
    | "contactId"
    | "title"
    | "tenantUnit"
    | "sitePhone"
    | "siteMobile"
    | "referenceCode"
    | "technicianNotes"
    | "propertyId"
    | "mapsUrl"
    | "workTypeId"
    | "contactPersonId"
    | "serviceAddressId"
    | "billingAddressId"
    | "hintsAndNotes"
    | "nextOwnerUserId"
    | "intakeOriginalText"
    | "accessNotes"
    | "keyHandlingNotes"
    | "timingNotes"
    | "internalNotes"
  >
>;

export async function updateProjectStammdaten(projectId: string, patch: ProjectStammdatenPatch): Promise<Project> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const p = mockProjects.find((x) => x.id === projectId);
    if (!p) {
      throw new Error("Projekt nicht gefunden.");
    }
    Object.assign(p, patch);
    p.updatedAt = new Date().toISOString();
    return p;
  }
  const row: Record<string, unknown> = {};
  if (patch.contactId !== undefined) row.contact_id = patch.contactId;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.tenantUnit !== undefined) row.tenant_unit = patch.tenantUnit;
  if (patch.sitePhone !== undefined) row.site_phone = patch.sitePhone;
  if (patch.siteMobile !== undefined) row.site_mobile = patch.siteMobile;
  if (patch.referenceCode !== undefined) row.reference_code = patch.referenceCode;
  if (patch.technicianNotes !== undefined) row.technician_notes = patch.technicianNotes;
  if (patch.propertyId !== undefined) row.property_id = patch.propertyId;
  if (patch.mapsUrl !== undefined) row.maps_url = patch.mapsUrl;
  if (patch.workTypeId !== undefined) row.work_type_id = patch.workTypeId;
  if (patch.contactPersonId !== undefined) row.contact_person_id = patch.contactPersonId;
  if (patch.serviceAddressId !== undefined) row.service_address_id = patch.serviceAddressId;
  if (patch.billingAddressId !== undefined) row.billing_address_id = patch.billingAddressId;
  if (patch.hintsAndNotes !== undefined) row.hints_and_notes = patch.hintsAndNotes;
  if (patch.nextOwnerUserId !== undefined) row.next_owner_user_id = patch.nextOwnerUserId;
  if (patch.intakeOriginalText !== undefined) row.intake_original_text = patch.intakeOriginalText;
  if (patch.accessNotes !== undefined) row.access_notes = patch.accessNotes;
  if (patch.keyHandlingNotes !== undefined) row.key_handling_notes = patch.keyHandlingNotes;
  if (patch.timingNotes !== undefined) row.timing_notes = patch.timingNotes;
  if (patch.internalNotes !== undefined) row.internal_notes = patch.internalNotes;

  const { data, error } = await supabase.from("projects").update(row).eq("id", projectId).select("*").single();
  if (error || !data) {
    throw new Error("Projekt konnte nicht gespeichert werden.");
  }
  return mapProjectRow(data as Record<string, unknown>);
}

export async function addProjectNote(input: Omit<ProjectNote, "id" | "createdAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const note: ProjectNote = { id: id("n"), createdAt: new Date().toISOString(), ...input };
    mockNotes.push(note);
    return note;
  }

  const { data, error } = await supabase.from("project_notes").insert({
    project_id: input.projectId,
    note_type: input.type,
    body: input.body,
  }).select("*").single();

  if (error || !data) {
    throw new Error("Notiz konnte nicht gespeichert werden.");
  }

  return data as unknown as ProjectNote;
}

export async function addAppointment(input: Omit<Appointment, "id" | "createdAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const appointment: Appointment = {
      id: id("a"),
      createdAt: new Date().toISOString(),
      ...input,
      assignedTechnicianId: input.assignedTechnicianId ?? null,
    };
    mockAppointments.push(appointment);
    return appointment;
  }

  const { data, error } = await supabase.from("appointments").insert({
    project_id: input.projectId,
    kind: input.kind,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    assigned_technician_id: input.assignedTechnicianId ?? null,
    planning_notes: input.planningNotes,
    access_notes: input.accessNotes,
    key_handling_notes: input.keyHandlingNotes,
  }).select("*").single();

  if (error || !data) {
    throw new Error("Termin konnte nicht gespeichert werden.");
  }

  return data as unknown as Appointment;
}

export async function deleteAppointment(appointmentId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockAppointments.findIndex((item) => item.id === appointmentId);
    if (idx < 0) {
      throw new Error("Termin nicht gefunden.");
    }
    mockAppointments.splice(idx, 1);
    return;
  }

  const { error } = await supabase.from("appointments").delete().eq("id", appointmentId);
  if (error) {
    throw new Error("Termin konnte nicht gelöscht werden.");
  }
}

export async function addTechnicianReport(input: Omit<TechnicianReport, "id" | "createdAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const report: TechnicianReport = { id: id("r"), createdAt: new Date().toISOString(), ...input };
    mockReports.push(report);
    return report;
  }

  const { data, error } = await supabase.from("technician_reports").insert({
    project_id: input.projectId,
    outcome: input.outcome,
    summary: input.summary,
    measurements_json: input.measurementsJson,
    work_description: input.workDescription,
    time_spent_minutes: input.timeSpentMinutes,
  }).select("*").single();

  if (error || !data) {
    throw new Error("Technikerbericht konnte nicht gespeichert werden.");
  }

  return data as unknown as TechnicianReport;
}

export async function addQuote(
  input: Omit<
    Quote,
    | "id"
    | "createdAt"
    | "status"
    | "sentAt"
    | "approvedAt"
    | "pdfPath"
    | "pdfGeneratedAt"
    | "pdfVersion"
    | "finalizedAt"
    | "finalizedBy"
    | "deliveryChannel"
    | "deliverySentAt"
    | "deliveryRecipient"
  > & {
    items?: Array<{ description: string; quantity: number; unit: string; unitPrice: number }>;
  },
) {
  const { items = [], ...quoteInput } = input;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const quote: Quote = {
      id: id("q"),
      status: "entwurf",
      sentAt: null,
      approvedAt: null,
      pdfPath: null,
      pdfGeneratedAt: null,
      pdfVersion: 0,
      finalizedAt: null,
      finalizedBy: null,
      deliveryChannel: null,
      deliverySentAt: null,
      deliveryRecipient: null,
      createdAt: new Date().toISOString(),
      ...quoteInput,
    };
    mockQuotes.push(quote);
    return quote;
  }

  const quoteId = crypto.randomUUID();
  // Keep INSERT compatible with lean quotes schema in production DB.
  const { error } = await supabase.from("quotes").insert({
    id: quoteId,
    project_id: quoteInput.projectId,
    version: quoteInput.version,
  });

  if (error) {
    const detail = [error.code, error.message, error.details, error.hint].filter(Boolean).join(" | ");
    throw new Error(detail || "Offerte konnte nicht erstellt werden.");
  }

  if (items.length > 0) {
    const { error: itemError } = await supabase.from("quote_items").insert(
      items.map((item) => ({
        quote_id: quoteId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unitPrice,
      })),
    );
    if (itemError) {
      const detail = [itemError.code, itemError.message, itemError.details, itemError.hint].filter(Boolean).join(" | ");
      throw new Error(detail || "Offertenpositionen konnten nicht gespeichert werden.");
    }
  }

  return {
    id: quoteId,
    projectId: quoteInput.projectId,
    version: quoteInput.version,
    status: "entwurf",
    sentAt: null,
    approvedAt: null,
    pdfPath: null,
    pdfGeneratedAt: null,
    pdfVersion: 0,
    finalizedAt: null,
    finalizedBy: null,
    warrantyText: quoteInput.warrantyText ?? null,
    validityDays: quoteInput.validityDays ?? null,
    leadTimeText: quoteInput.leadTimeText ?? null,
    downPaymentPercent: quoteInput.downPaymentPercent ?? null,
    paymentTermsText: quoteInput.paymentTermsText ?? null,
    salutationText: quoteInput.salutationText ?? null,
    textBlocks: quoteInput.textBlocks ?? null,
    currency: quoteInput.currency ?? "CHF",
    discountPercent: quoteInput.discountPercent ?? 0,
    vatPercent: quoteInput.vatPercent ?? 8.1,
    subtotalNet: quoteInput.subtotalNet ?? 0,
    discountAmount: quoteInput.discountAmount ?? 0,
    totalNet: quoteInput.totalNet ?? 0,
    vatAmount: quoteInput.vatAmount ?? 0,
    totalGross: quoteInput.totalGross ?? 0,
    deliveryChannel: null,
    deliverySentAt: null,
    deliveryRecipient: null,
    createdAt: new Date().toISOString(),
  } as Quote;
}

export async function addPurchaseOrder(input: Omit<PurchaseOrder, "id" | "createdAt" | "status" | "emailSentAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const order: PurchaseOrder = {
      id: id("po"),
      status: "entwurf",
      emailSentAt: null,
      createdAt: new Date().toISOString(),
      ...input,
    };
    mockOrders.push(order);
    return order;
  }

  const { data, error } = await supabase.from("purchase_orders").insert({
    project_id: input.projectId,
    supplier_id: input.supplierId,
  }).select("*").single();

  if (error || !data) {
    throw new Error("Bestellung konnte nicht erstellt werden.");
  }

  return mapPurchaseOrderRow(data as Record<string, unknown>);
}

export async function addDelivery(
  input: Omit<
    Delivery,
    | "id"
    | "createdAt"
    | "arrivedAt"
    | "checkedByRole"
    | "pdfPath"
    | "pdfGeneratedAt"
    | "pdfVersion"
    | "finalizedAt"
    | "finalizedBy"
    | "deliveryChannel"
    | "deliverySentAt"
    | "deliveryRecipient"
  >,
) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const delivery: Delivery = {
      id: id("d"),
      arrivedAt: new Date().toISOString(),
      checkedByRole: "office",
      pdfPath: null,
      pdfGeneratedAt: null,
      pdfVersion: 0,
      finalizedAt: null,
      finalizedBy: null,
      deliveryChannel: null,
      deliverySentAt: null,
      deliveryRecipient: null,
      createdAt: new Date().toISOString(),
      ...input,
    };
    mockDeliveries.push(delivery);
    return delivery;
  }

  const { data, error } = await supabase.from("deliveries").insert({
    project_id: input.projectId,
    purchase_order_id: input.purchaseOrderId,
    delivery_note_number: input.deliveryNoteNumber,
  }).select("*").single();

  if (error || !data) {
    throw new Error("Wareneingang konnte nicht erfasst werden.");
  }

  return mapDeliveryRow(data as Record<string, unknown>);
}

export async function addInvoice(
  input: Omit<
    Invoice,
    | "id"
    | "createdAt"
    | "status"
    | "sentAt"
    | "pdfPath"
    | "pdfGeneratedAt"
    | "pdfVersion"
    | "finalizedAt"
    | "finalizedBy"
    | "deliveryChannel"
    | "deliverySentAt"
    | "deliveryRecipient"
  >,
) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const invoice: Invoice = {
      id: id("i"),
      status: "entwurf",
      sentAt: null,
      pdfPath: null,
      pdfGeneratedAt: null,
      pdfVersion: 0,
      finalizedAt: null,
      finalizedBy: null,
      deliveryChannel: null,
      deliverySentAt: null,
      deliveryRecipient: null,
      createdAt: new Date().toISOString(),
      ...input,
    };
    mockInvoices.push(invoice);
    return invoice;
  }

  const { data, error } = await supabase.from("invoices").insert({
    project_id: input.projectId,
    invoice_number: input.invoiceNumber,
  }).select("*").single();

  if (error || !data) {
    throw new Error("Rechnungsentwurf konnte nicht erstellt werden.");
  }

  return mapInvoiceRow(data as Record<string, unknown>);
}

export async function getQuoteById(quoteId: string): Promise<Quote | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockQuotes.find((q) => q.id === quoteId) ?? null;
  }
  const { data } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle();
  return data ? mapQuoteRow(data as Record<string, unknown>) : null;
}

export async function getInvoiceById(invoiceId: string): Promise<Invoice | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockInvoices.find((i) => i.id === invoiceId) ?? null;
  }
  const { data } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  return data ? mapInvoiceRow(data as Record<string, unknown>) : null;
}

export async function getDeliveryById(deliveryId: string): Promise<Delivery | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockDeliveries.find((d) => d.id === deliveryId) ?? null;
  }
  const { data } = await supabase.from("deliveries").select("*").eq("id", deliveryId).maybeSingle();
  return data ? mapDeliveryRow(data as Record<string, unknown>) : null;
}

export async function markQuoteFinalizedWithPdf(input: {
  quoteId: string;
  pdfPath: string;
  finalizedBy: string | null;
  nextPdfVersion: number;
  deliveryChannel: "email" | "post";
  deliveryRecipient: string | null;
}) {
  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const quote = mockQuotes.find((q) => q.id === input.quoteId);
    if (!quote) {
      throw new Error("Offerte nicht gefunden.");
    }
    quote.status = "gesendet";
    quote.sentAt = now;
    quote.pdfPath = input.pdfPath;
    quote.pdfGeneratedAt = now;
    quote.pdfVersion = input.nextPdfVersion;
    quote.finalizedAt = now;
    quote.finalizedBy = input.finalizedBy;
    quote.deliveryChannel = input.deliveryChannel;
    quote.deliverySentAt = now;
    quote.deliveryRecipient = input.deliveryRecipient;
    return quote;
  }

  const { data, error } = await supabase
    .from("quotes")
    .update({
      status: "gesendet",
      sent_at: now,
      pdf_path: input.pdfPath,
      pdf_generated_at: now,
      pdf_version: input.nextPdfVersion,
      finalized_at: now,
      finalized_by: input.finalizedBy,
      delivery_channel: input.deliveryChannel,
      delivery_sent_at: now,
      delivery_recipient: input.deliveryRecipient,
    })
    .eq("id", input.quoteId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Offerte konnte nicht finalisiert werden.");
  }
  return mapQuoteRow(data as Record<string, unknown>);
}

export async function markInvoiceFinalizedWithPdf(input: {
  invoiceId: string;
  pdfPath: string;
  finalizedBy: string | null;
  nextPdfVersion: number;
  deliveryChannel: "email" | "post";
  deliveryRecipient: string | null;
}) {
  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const invoice = mockInvoices.find((i) => i.id === input.invoiceId);
    if (!invoice) {
      throw new Error("Rechnung nicht gefunden.");
    }
    invoice.status = "gesendet";
    invoice.sentAt = now;
    invoice.pdfPath = input.pdfPath;
    invoice.pdfGeneratedAt = now;
    invoice.pdfVersion = input.nextPdfVersion;
    invoice.finalizedAt = now;
    invoice.finalizedBy = input.finalizedBy;
    invoice.deliveryChannel = input.deliveryChannel;
    invoice.deliverySentAt = now;
    invoice.deliveryRecipient = input.deliveryRecipient;
    return invoice;
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({
      status: "gesendet",
      sent_at: now,
      pdf_path: input.pdfPath,
      pdf_generated_at: now,
      pdf_version: input.nextPdfVersion,
      finalized_at: now,
      finalized_by: input.finalizedBy,
      delivery_channel: input.deliveryChannel,
      delivery_sent_at: now,
      delivery_recipient: input.deliveryRecipient,
    })
    .eq("id", input.invoiceId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Rechnung konnte nicht finalisiert werden.");
  }
  return mapInvoiceRow(data as Record<string, unknown>);
}

export async function markDeliveryFinalizedWithPdf(input: {
  deliveryId: string;
  pdfPath: string;
  finalizedBy: string | null;
  nextPdfVersion: number;
}) {
  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const delivery = mockDeliveries.find((d) => d.id === input.deliveryId);
    if (!delivery) {
      throw new Error("Lieferschein nicht gefunden.");
    }
    delivery.pdfPath = input.pdfPath;
    delivery.pdfGeneratedAt = now;
    delivery.pdfVersion = input.nextPdfVersion;
    delivery.finalizedAt = now;
    delivery.finalizedBy = input.finalizedBy;
    return delivery;
  }

  const { data, error } = await supabase
    .from("deliveries")
    .update({
      pdf_path: input.pdfPath,
      pdf_generated_at: now,
      pdf_version: input.nextPdfVersion,
      finalized_at: now,
      finalized_by: input.finalizedBy,
    })
    .eq("id", input.deliveryId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Lieferschein konnte nicht finalisiert werden.");
  }
  return mapDeliveryRow(data as Record<string, unknown>);
}

export async function getProjectDocumentSignedUrl(input: {
  type: "quote" | "invoice" | "delivery";
  id: string;
  expiresSec?: number;
}): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  let pdfPath: string | null = null;
  if (input.type === "quote") {
    const { data } = await supabase.from("quotes").select("pdf_path").eq("id", input.id).maybeSingle();
    pdfPath = data?.pdf_path ? String(data.pdf_path) : null;
  } else if (input.type === "invoice") {
    const { data } = await supabase.from("invoices").select("pdf_path").eq("id", input.id).maybeSingle();
    pdfPath = data?.pdf_path ? String(data.pdf_path) : null;
  } else {
    const { data } = await supabase.from("deliveries").select("pdf_path").eq("id", input.id).maybeSingle();
    pdfPath = data?.pdf_path ? String(data.pdf_path) : null;
  }

  if (!pdfPath) {
    return null;
  }

  const buckets = ["project-documents", "project-files"] as const;
  for (const bucket of buckets) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(pdfPath, input.expiresSec ?? 900);
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
    const msg = error?.message?.toLowerCase() ?? "";
    const canTryNext = msg.includes("bucket not found") || msg.includes("not found");
    if (!canTryNext) {
      return null;
    }
  }
  return null;
}

export async function updateProjectStatus(projectId: string, status: Project["status"], nextOwnerRole: Project["nextOwnerRole"]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const project = mockProjects.find((item) => item.id === projectId);
    if (!project) {
      throw new Error("Projekt nicht gefunden.");
    }
    project.status = status;
    project.nextOwnerRole = nextOwnerRole;
    project.updatedAt = new Date().toISOString();
    const matchingColumn = mockKanbanColumns.find(
      (column) => column.projectId === projectId && column.status === status,
    );
    if (matchingColumn) {
      mockKanbanCards
        .filter((card) => card.projectId === projectId)
        .forEach((card) => {
          card.columnId = matchingColumn.id;
          card.status = status;
        });
    }
    return project;
  }

  const { data, error } = await supabase.from("projects").update({
    status,
    next_owner_role: nextOwnerRole,
  }).eq("id", projectId).select("*").single();

  if (error || !data) {
    throw new Error("Projektstatus konnte nicht aktualisiert werden.");
  }

  const mapped = mapProjectRow(data as Record<string, unknown>);

  const { data: columns } = await supabase
    .from("kanban_columns")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", status)
    .limit(1);
  const column = columns?.[0];
  if (column) {
    await supabase
      .from("kanban_cards")
      .update({ column_id: column.id, status })
      .eq("project_id", projectId);
  }

  return mapped;
}

export async function listProfilesByRole(role: RoleType) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockProfiles
      .filter((item) => item.role === role)
      .sort((a, b) => a.calendarPosition - b.calendarPosition || a.displayName.localeCompare(b.displayName));
  }
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", role)
    .order("calendar_position", { ascending: true })
    .order("display_name", { ascending: true });
  return ((data as Record<string, unknown>[]) ?? []).map((r) => mapUserProfileRow(r));
}

export async function listModuleLabels() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockModuleLabels;
  }
  const { data } = await supabase.from("ui_module_labels").select("*");
  return ((data as unknown as ModuleLabel[]) ?? []).length > 0 ? (data as unknown as ModuleLabel[]) : mockModuleLabels;
}

export async function upsertModuleLabel(key: string, label: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const found = mockModuleLabels.find((item) => item.key === key);
    if (found) {
      found.label = label;
      return found;
    }
    const created = { key, label };
    mockModuleLabels.push(created);
    return created;
  }
  const { data, error } = await supabase.from("ui_module_labels")
    .upsert({ key, label }, { onConflict: "key" })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Modulname konnte nicht gespeichert werden.");
  }
  return data as unknown as ModuleLabel;
}

export async function listKanbanColumns(projectId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockKanbanColumns.filter((item) => item.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  const { data } = await supabase
    .from("kanban_columns")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  return (data as unknown as KanbanColumn[]) ?? [];
}

export async function listKanbanCards(projectId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockKanbanCards.filter((item) => item.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  const { data } = await supabase
    .from("kanban_cards")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  return (data as unknown as KanbanCard[]) ?? [];
}

export async function renameKanbanColumn(columnId: string, title: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const column = mockKanbanColumns.find((item) => item.id === columnId);
    if (!column) {
      throw new Error("Kanban-Spalte nicht gefunden.");
    }
    column.title = title;
    return column;
  }
  const { data, error } = await supabase
    .from("kanban_columns")
    .update({ title })
    .eq("id", columnId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Spalte konnte nicht umbenannt werden.");
  }
  return data as unknown as KanbanColumn;
}

export async function moveKanbanCard(cardId: string, columnId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const card = mockKanbanCards.find((item) => item.id === cardId);
    if (!card) {
      throw new Error("Kanban-Karte nicht gefunden.");
    }
    card.columnId = columnId;
    return card;
  }
  const { data, error } = await supabase
    .from("kanban_cards")
    .update({ column_id: columnId })
    .eq("id", cardId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Kanban-Karte konnte nicht verschoben werden.");
  }
  return data as unknown as KanbanCard;
}

function mapChatMessageRow(row: Record<string, unknown>): ProjectChatMessage {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    appointmentId: row.appointment_id ? String(row.appointment_id) : null,
    senderId: String(row.sender_id ?? ""),
    senderName: String(row.sender_name ?? ""),
    body: String(row.body ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapChatAttachmentRow(row: Record<string, unknown>): ProjectChatAttachment {
  return {
    id: String(row.id),
    messageId: String(row.message_id),
    projectId: String(row.project_id),
    fileName: String(row.file_name ?? ""),
    fileType: String(row.file_type ?? ""),
    filePath: String(row.file_path ?? ""),
    uploadedAt: String(row.uploaded_at ?? ""),
  };
}

function mapProjectAttachmentRow(row: Record<string, unknown>): ProjectAttachment {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    fileName: String(row.file_name ?? ""),
    fileType: String(row.mime_type ?? ""),
    filePath: String(row.file_path ?? ""),
    sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
    uploadedBy: row.uploaded_by == null ? null : String(row.uploaded_by),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listProjectChat(projectId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const messages = mockProjectChatMessages.filter((item) => item.projectId === projectId);
    const attachments = mockProjectChatAttachments.filter((item) => item.projectId === projectId);
    return { messages, attachments };
  }
  const [messages, attachments] = await Promise.all([
    supabase.from("project_chat_messages").select("*").eq("project_id", projectId).order("created_at"),
    supabase.from("project_chat_attachments").select("*").eq("project_id", projectId).order("uploaded_at"),
  ]);
  return {
    messages: (messages.data ?? []).map((r) => mapChatMessageRow(r as Record<string, unknown>)),
    attachments: (attachments.data ?? []).map((r) => mapChatAttachmentRow(r as Record<string, unknown>)),
  };
}

export async function addProjectChatMessage(input: Omit<ProjectChatMessage, "id" | "createdAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const item: ProjectChatMessage = {
      id: id("pcm"),
      createdAt: new Date().toISOString(),
      ...input,
    };
    mockProjectChatMessages.push(item);
    return item;
  }
  const { data, error } = await supabase.from("project_chat_messages").insert({
    project_id: input.projectId,
    appointment_id: input.appointmentId,
    sender_id: input.senderId,
    sender_name: input.senderName,
    body: input.body,
  }).select("*").single();
  if (error || !data) {
    throw new Error("Nachricht konnte nicht gespeichert werden.");
  }
  return mapChatMessageRow(data as Record<string, unknown>);
}

export async function addProjectChatAttachment(input: Omit<ProjectChatAttachment, "id" | "uploadedAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const item: ProjectChatAttachment = {
      id: id("pca"),
      uploadedAt: new Date().toISOString(),
      ...input,
    };
    mockProjectChatAttachments.push(item);
    return item;
  }
  const { data, error } = await supabase.from("project_chat_attachments").insert({
    message_id: input.messageId,
    project_id: input.projectId,
    file_name: input.fileName,
    file_type: input.fileType,
    file_path: input.filePath,
  }).select("*").single();
  if (error || !data) {
    throw new Error("Anhang konnte nicht gespeichert werden.");
  }
  return mapChatAttachmentRow(data as Record<string, unknown>);
}

export async function addProjectAttachment(input: Omit<ProjectAttachment, "id" | "createdAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const item: ProjectAttachment = {
      id: id("pa"),
      createdAt: new Date().toISOString(),
      ...input,
    };
    mockProjectAttachments.push(item);
    return item;
  }
  const { data, error } = await supabase.from("project_attachments").insert({
    project_id: input.projectId,
    file_path: input.filePath,
    file_name: input.fileName,
    mime_type: input.fileType || null,
    size_bytes: input.sizeBytes,
    uploaded_by: input.uploadedBy,
  }).select("*").single();
  if (error || !data) {
    throw new Error("Datei konnte nicht gespeichert werden.");
  }
  return mapProjectAttachmentRow(data as Record<string, unknown>);
}

export async function addCalendarEvent(input: Omit<CalendarEvent, "id" | "createdAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const event: CalendarEvent = { id: id("cal"), createdAt: new Date().toISOString(), ...input };
    mockCalendarEvents.push(event);
    return event;
  }
  const { data, error } = await supabase.from("calendar_events").insert({
    project_id: input.projectId,
    appointment_id: input.appointmentId,
    technician_id: input.technicianId,
    technician_email: input.technicianEmail,
    provider: input.provider,
    provider_event_id: input.providerEventId,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    title: input.title,
  }).select("*").single();
  if (error || !data) {
    throw new Error("Kalendereintrag konnte nicht gespeichert werden.");
  }
  return data as unknown as CalendarEvent;
}

export async function listArticleCategories(): Promise<ArticleCategory[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [...mockArticleCategories].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  const { data, error } = await supabase
    .from("article_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error || !data) {
    return [];
  }
  return (data as Record<string, unknown>[]).map(mapArticleCategoryRow);
}

export async function insertArticleCategory(input: {
  name: string;
  sortOrder?: number;
  templateScope: ArticleCategoryTemplateScope;
}): Promise<ArticleCategory> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Kategoriename fehlt.");
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const row: ArticleCategory = {
      id: id("ac"),
      name,
      sortOrder: input.sortOrder ?? mockArticleCategories.length * 10,
      templateScope: input.templateScope,
      createdAt: new Date().toISOString(),
    };
    mockArticleCategories.push(row);
    return row;
  }
  const { data, error } = await supabase
    .from("article_categories")
    .insert({
      name,
      sort_order: input.sortOrder ?? 0,
      template_scope: input.templateScope,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Kategorie konnte nicht angelegt werden.");
  }
  return mapArticleCategoryRow(data as Record<string, unknown>);
}

export async function listArticles(): Promise<Article[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockArticles;
  }
  const { data } = await supabase
    .from("articles")
    .select("*, article_categories(name, template_scope)")
    .order("name", { ascending: true });
  if (!data) {
    return [];
  }
  return (data as Record<string, unknown>[]).map((row) => mapArticleRow(row));
}

export async function getArticleById(id: string): Promise<Article | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockArticles.find((a) => a.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from("articles")
    .select("*, article_categories(name, template_scope)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return mapArticleRow(data as Record<string, unknown>);
}

export type ArticleImportRow = Omit<Article, "id" | "createdAt" | "categoryId" | "categoryName" | "categoryTemplateScope"> & {
  categoryName: string;
};

async function resolveCategoryByName(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  categoryName: string,
): Promise<{ id: string; templateScope: ArticleCategoryTemplateScope }> {
  const name = categoryName.trim() || "Sonstiges";
  if (!supabase) {
    const cat = mockArticleCategories.find((c) => c.name === name) ?? mockArticleCategories.find((c) => c.name === "Sonstiges");
    if (!cat) {
      throw new Error("Kategorie nicht gefunden.");
    }
    return { id: cat.id, templateScope: cat.templateScope };
  }
  const { data: found } = await supabase.from("article_categories").select("id, template_scope").eq("name", name).maybeSingle();
  if (found) {
    const r = found as { id: string; template_scope: string };
    return { id: r.id, templateScope: mapTemplateScope(r.template_scope) };
  }
  const { data: created, error } = await supabase
    .from("article_categories")
    .insert({ name, sort_order: 0, template_scope: "generic" })
    .select("id, template_scope")
    .single();
  if (error || !created) {
    throw new Error("Kategorie konnte nicht angelegt werden.");
  }
  const r = created as { id: string; template_scope: string };
  return { id: r.id, templateScope: mapTemplateScope(r.template_scope) };
}

export async function saveArticle(
  input: Omit<Article, "createdAt" | "categoryName" | "categoryTemplateScope" | "id"> & { id?: string },
): Promise<Article> {
  const supabase = await createSupabaseServerClient();
  const row = {
    name: input.name,
    sku: input.sku,
    article_category_id: input.categoryId,
    supplier_id: input.supplierId,
    purchase_price: input.purchasePrice,
    sale_price: input.salePrice,
    unit: input.unit,
    description_long: input.descriptionLong,
    description_short: input.descriptionShort,
    in_stock: input.inStock,
  };
  if (!supabase) {
    if (input.id) {
      const existing = mockArticles.find((a) => a.id === input.id);
      if (!existing) {
        throw new Error("Artikel nicht gefunden.");
      }
      const cat = mockArticleCategories.find((c) => c.id === input.categoryId);
      Object.assign(existing, {
        ...input,
        categoryName: cat?.name ?? null,
        categoryTemplateScope: cat?.templateScope ?? "generic",
      });
      return existing;
    }
    const cat = mockArticleCategories.find((c) => c.id === input.categoryId);
    const created: Article = {
      ...input,
      id: id("art"),
      categoryName: cat?.name ?? null,
      categoryTemplateScope: cat?.templateScope ?? "generic",
      createdAt: new Date().toISOString(),
    };
    mockArticles.push(created);
    return created;
  }
  if (input.id) {
    const { data, error } = await supabase
      .from("articles")
      .update(row)
      .eq("id", input.id)
      .select("*, article_categories(name, template_scope)")
      .single();
    if (error || !data) {
      throw new Error("Artikel konnte nicht gespeichert werden.");
    }
    return mapArticleRow(data as Record<string, unknown>);
  }
  const { data, error } = await supabase.from("articles").insert(row).select("*, article_categories(name, template_scope)").single();
  if (error || !data) {
    throw new Error("Artikel konnte nicht erstellt werden.");
  }
  return mapArticleRow(data as Record<string, unknown>);
}

export async function deleteArticle(articleId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockArticles.findIndex((a) => a.id === articleId);
    if (idx !== -1) {
      mockArticles.splice(idx, 1);
    }
    return;
  }
  const { error } = await supabase.from("articles").delete().eq("id", articleId);
  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("violates foreign key constraint") || msg.includes("foreign key")) {
      throw new Error("Artikel wird in Belegen verwendet und kann nicht gelöscht werden.");
    }
    throw new Error(error.message || "Artikel konnte nicht gelöscht werden.");
  }
}

export async function upsertArticles(items: ArticleImportRow[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    for (const item of items) {
      const resolved = await resolveCategoryByName(supabase, item.categoryName);
      const existing = mockArticles.find((entry) => entry.sku === item.sku);
      const base = {
        name: item.name,
        sku: item.sku,
        categoryId: resolved.id,
        categoryName: item.categoryName.trim() || "Sonstiges",
        categoryTemplateScope: resolved.templateScope,
        supplierId: item.supplierId,
        purchasePrice: item.purchasePrice,
        salePrice: item.salePrice,
        unit: item.unit,
        descriptionLong: item.descriptionLong,
        descriptionShort: item.descriptionShort,
        inStock: item.inStock,
      };
      if (existing) {
        Object.assign(existing, base);
      } else {
        mockArticles.push({
          ...base,
          id: id("art"),
          createdAt: new Date().toISOString(),
        });
      }
    }
    return mockArticles;
  }
  for (const item of items) {
    const { id: categoryId } = await resolveCategoryByName(supabase, item.categoryName);
    const payload = {
      name: item.name,
      sku: item.sku,
      article_category_id: categoryId,
      supplier_id: item.supplierId,
      purchase_price: item.purchasePrice,
      sale_price: item.salePrice,
      unit: item.unit,
      description_long: item.descriptionLong,
      description_short: item.descriptionShort,
      in_stock: item.inStock,
    };
    const { error } = await supabase.from("articles").upsert(payload, { onConflict: "sku" });
    if (error) {
      throw new Error("Artikel konnten nicht importiert werden.");
    }
  }
  const { data, error } = await supabase.from("articles").select("*, article_categories(name, template_scope)").order("name");
  if (error || !data) {
    throw new Error("Artikel konnten nicht importiert werden.");
  }
  return (data as Record<string, unknown>[]).map((r) => mapArticleRow(r));
}

function mapEmployeeMetricsRow(row: Record<string, unknown>): EmployeeStat | null {
  const profileId = (row.profile_id ?? row.profileId) as string | undefined;
  if (!profileId) {
    return null;
  }
  return {
    profileId,
    profileName: String(row.profile_name ?? row.profileName ?? "Unbenannt"),
    offeneProjekte: Number(row.offene_projekte ?? row.offeneProjekte ?? 0),
    abgeschlosseneHeute: Number(row.abgeschlossene_heute ?? row.abgeschlosseneHeute ?? 0),
    offeneRapporte: Number(row.offene_rapporte ?? row.offeneRapporte ?? 0),
    stundenDieseWoche: Number(row.stunden_diese_woche ?? row.stundenDieseWoche ?? 0),
  };
}

/** Neueste Metrik-Zeile pro Profil (falls mehrere Snapshots existieren). */
function dedupeEmployeeStatsByProfile(
  rows: Record<string, unknown>[],
): EmployeeStat[] {
  const latest = new Map<string, { stat: EmployeeStat; at: number }>();
  for (const row of rows) {
    const stat = mapEmployeeMetricsRow(row);
    if (!stat) {
      continue;
    }
    const createdRaw = row.created_at ?? row.createdAt;
    const at =
      typeof createdRaw === "string" ? new Date(createdRaw).getTime() : 0;
    const prev = latest.get(stat.profileId);
    if (!prev || at >= prev.at) {
      latest.set(stat.profileId, { stat, at });
    }
  }
  return Array.from(latest.values())
    .map((x) => x.stat)
    .sort((a, b) => a.profileName.localeCompare(b.profileName, "de-CH"));
}

export async function listEmployeeStats() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockEmployeeStats;
  }
  const { data, error } = await supabase
    .from("employee_metrics_snapshots")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data?.length) {
    return mockEmployeeStats;
  }
  const mapped = dedupeEmployeeStatsByProfile(data as Record<string, unknown>[]);
  return mapped.length > 0 ? mapped : mockEmployeeStats;
}

export async function listAuditEvents(limit = 100) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockAuditEvents.slice(0, limit);
  }
  const { data } = await supabase.from("audit_events").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data as unknown as AuditEvent[]) ?? [];
}

export async function addAuditEvent(input: Omit<AuditEvent, "id" | "createdAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const event: AuditEvent = {
      id: id("ae"),
      createdAt: new Date().toISOString(),
      ...input,
    };
    mockAuditEvents.unshift(event);
    return event;
  }
  const { data, error } = await supabase.from("audit_events").insert({
    action: input.action,
    project_id: input.projectId,
    actor_role: input.actorRole,
    actor_name: input.actorName,
    payload: input.payload,
  }).select("*").single();
  if (error || !data) {
    throw new Error("Audit-Eintrag konnte nicht gespeichert werden.");
  }
  return data as unknown as AuditEvent;
}

function normalizeSupplierKey(v: string | null | undefined) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function humanizeFieldKey(key: string) {
  const text = key.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function parseFieldSchema(raw: unknown, requiredFieldsFallback: string[]): SupplierOrderFieldDefinition[] {
  if (Array.isArray(raw)) {
    const normalized: SupplierOrderFieldDefinition[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const rec = item as Record<string, unknown>;
      const key = String(rec.key ?? "").trim();
      if (!key) {
        continue;
      }
      const typeRaw = String(rec.type ?? "text").trim();
      const type: SupplierOrderFieldDefinition["type"] =
        typeRaw === "number" || typeRaw === "select" || typeRaw === "article" ? typeRaw : "text";
      const options = Array.isArray(rec.options)
        ? rec.options.map((o) => String(o).trim()).filter((o) => o.length > 0)
        : undefined;
      const showWhen = Array.isArray(rec.showWhen)
        ? rec.showWhen
            .map((item) => {
              if (!item || typeof item !== "object") {
                return null;
              }
              const c = item as Record<string, unknown>;
              const operatorRaw = String(c.operator ?? "equals");
              return {
                fieldKey: String(c.fieldKey ?? "").trim(),
                operator: operatorRaw === "not_equals" ? "not_equals" : "equals",
                value: String(c.value ?? "").trim(),
              };
            })
            .filter((c): c is { fieldKey: string; operator: "equals" | "not_equals"; value: string } =>
              c !== null && c.fieldKey.length > 0 && c.value.length > 0,
            )
        : undefined;
      const requireWhen = Array.isArray(rec.requireWhen)
        ? rec.requireWhen
            .map((item) => {
              if (!item || typeof item !== "object") {
                return null;
              }
              const c = item as Record<string, unknown>;
              const operatorRaw = String(c.operator ?? "equals");
              return {
                fieldKey: String(c.fieldKey ?? "").trim(),
                operator: operatorRaw === "not_equals" ? "not_equals" : "equals",
                value: String(c.value ?? "").trim(),
              };
            })
            .filter((c): c is { fieldKey: string; operator: "equals" | "not_equals"; value: string } =>
              c !== null && c.fieldKey.length > 0 && c.value.length > 0,
            )
        : undefined;
      normalized.push({
        key,
        label: String(rec.label ?? humanizeFieldKey(key)),
        type,
        required: Boolean(rec.required),
        options,
        placeholder: rec.placeholder == null ? undefined : String(rec.placeholder),
        helpText: rec.helpText == null ? undefined : String(rec.helpText),
        showWhen,
        requireWhen,
      });
    }
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return requiredFieldsFallback.map((key) => ({
    key,
    label: humanizeFieldKey(key),
    type: key.toLowerCase().includes("artikel") ? "article" : "text",
    required: true,
  }));
}

type DefaultSupplierTemplateSpec = {
  supplierName: string;
  name: string;
  fieldDefinitions: SupplierOrderFieldDefinition[];
};

const DEFAULT_SUPPLIER_TEMPLATE_SPECS: DefaultSupplierTemplateSpec[] = [
  {
    supplierName: "Lamex",
    name: "Lamellenstoren",
    fieldDefinitions: [
      { key: "storen_typ", label: "Storentyp", type: "select", required: true, options: ["LX90", "LX70", "C80", "C65", "F60", "F80", "F50"] },
      {
        key: "lamellenfarbe",
        label: "Lamellenfarbe",
        type: "select",
        required: true,
        options: [
          "010 Weiss",
          "071 Braun",
          "110 Beige",
          "120 Terracotta",
          "130 Grau",
          "140 Alu",
          "220 Moos Grün",
          "240 Hellbeige",
          "303 Rubin Rot",
          "330 Purpurrot",
          "440 Asurblau",
          "716 Anthrazitgrau",
          "720 Chromgelb",
          "737 Staubgrün",
          "780 Bronze",
          "901 Reinweiss",
          "903 Taubenblau",
          "904 Lichtgrau",
          "906 Ultramarin Blau",
          "907 Grau Alu",
          "908 Türkis Blau",
          "909 Grün Beige",
          "IGP 71386",
          "RAL 7022 Umbragrau",
          "RAL 8019 Graubraun",
          "RAL 9005 Tiefschwarz",
        ],
      },
      { key: "position", label: "Position", type: "text", required: true },
      { key: "anzahl_storren", label: "Anzahl Storren", type: "number", required: true },
      { key: "raumstock", label: "Raumstock", type: "text", required: true },
      { key: "bk_mm", label: "BK (mm)", type: "number", required: true },
      { key: "hk_mm", label: "HK (mm)", type: "number", required: true },
      { key: "hoehenpaket_mm", label: "Höhenpaket (mm)", type: "number", required: true },
      {
        key: "antriebsart",
        label: "Antriebsart",
        type: "select",
        required: true,
        options: ["Getriebe", "Motor links", "Motor gekuppelt", "Motor rechts gekuppelt", "Ohne Antrieb", "Behangersatz"],
      },
      { key: "antriebsseite", label: "Antriebsseite", type: "select", required: true, options: ["Links", "Mitte", "Rechts"] },
      { key: "motor_getriebemass_mm", label: "Motor/Getriebemass (mm)", type: "number", required: false },
      { key: "kurbellaenge_mm", label: "Kurbellänge (mm)", type: "number", required: false },
      { key: "kurbeltyp", label: "Kurbeltyp", type: "text", required: false },
      { key: "plattenvierkant_mm", label: "Plattenvierkant (mm)", type: "number", required: false },
      { key: "kupplungsdistanz_mm", label: "Kupplungsdistanz (mm)", type: "number", required: false },
      { key: "unterschienenfarbe", label: "Unterschienenfarbe", type: "text", required: false },
      { key: "fuehrungstyp", label: "Führungstyp", type: "text", required: false },
      { key: "fuehrungsfarbe", label: "Führungsfarbe", type: "text", required: false },
      { key: "selbsttragesystem", label: "Selbsttragesystem", type: "select", required: false, options: ["Ja", "Nein"] },
      { key: "os_verstellt", label: "OS verstellt", type: "select", required: false, options: ["Ja", "Nein"] },
      { key: "arbeitsstellung", label: "Arbeitsstellung", type: "text", required: false },
    ],
  },
  {
    supplierName: "Storosol",
    name: "Stoffe",
    fieldDefinitions: [
      { key: "artikel", label: "Artikel", type: "article", required: true },
      { key: "stofftyp", label: "Stofftyp", type: "text", required: true },
      { key: "farbe", label: "Farbe", type: "text", required: true },
      { key: "breite_mm", label: "Breite (mm)", type: "number", required: true },
      { key: "hoehe_mm", label: "Höhe (mm)", type: "number", required: true },
      { key: "lieferadresse", label: "Lieferadresse", type: "text", required: true },
      { key: "bemerkung", label: "Bemerkung", type: "text", required: false },
    ],
  },
  {
    supplierName: "Stobag",
    name: "Gelenkarmmarkise",
    fieldDefinitions: [
      { key: "artikel", label: "Artikel", type: "article", required: true },
      { key: "modell", label: "Modell", type: "text", required: true },
      { key: "farbe_rahmen", label: "Rahmenfarbe", type: "text", required: true },
      { key: "stoff", label: "Stoff", type: "text", required: true },
      { key: "breite_mm", label: "Breite (mm)", type: "number", required: true },
      { key: "ausladung_mm", label: "Ausladung (mm)", type: "number", required: true },
      { key: "antrieb", label: "Antrieb", type: "select", required: true, options: ["Motor", "Kurbel"] },
    ],
  },
  {
    supplierName: "Ragazzi",
    name: "Rollladen",
    fieldDefinitions: [
      { key: "artikel", label: "Artikel", type: "article", required: true },
      { key: "typ", label: "Typ", type: "text", required: true },
      { key: "farbe", label: "Farbe", type: "text", required: true },
      { key: "breite_mm", label: "Breite (mm)", type: "number", required: true },
      { key: "hoehe_mm", label: "Höhe (mm)", type: "number", required: true },
      { key: "antrieb", label: "Antrieb", type: "select", required: true, options: ["Gurt", "Kurbel", "Motor"] },
    ],
  },
  {
    supplierName: "Regazzi",
    name: "Regapack Faltrollladen",
    fieldDefinitions: [
      { key: "artikel", label: "Artikel", type: "article", required: true },
      { key: "typ", label: "Typ", type: "text", required: true },
      { key: "farbe", label: "Farbe", type: "text", required: true },
      { key: "breite_mm", label: "Breite (mm)", type: "number", required: true },
      { key: "hoehe_mm", label: "Höhe (mm)", type: "number", required: true },
      { key: "fuehrung", label: "Führung", type: "text", required: false },
    ],
  },
  {
    supplierName: "Intern",
    name: "Reparatur & Ersatzteile",
    fieldDefinitions: [
      { key: "artikel", label: "Artikel", type: "article", required: true },
      { key: "ersatzteil", label: "Ersatzteil / Reparaturteil", type: "text", required: true },
      { key: "menge", label: "Menge", type: "number", required: true },
      { key: "defektbeschreibung", label: "Defektbeschreibung", type: "text", required: true },
      { key: "prioritaet", label: "Priorität", type: "select", required: true, options: ["Normal", "Hoch", "Kritisch"] },
      { key: "bemerkung", label: "Bemerkung", type: "text", required: false },
    ],
  },
];

function templateSpecForRow(row: { supplierName: string; name: string }): DefaultSupplierTemplateSpec | undefined {
  const supplierKey = normalizeSupplierKey(row.supplierName);
  const nameKey = normalizeSupplierKey(row.name);
  return DEFAULT_SUPPLIER_TEMPLATE_SPECS.find(
    (spec) => normalizeSupplierKey(spec.supplierName) === supplierKey && normalizeSupplierKey(spec.name) === nameKey,
  );
}

function mapSupplierOrderTemplateRow(row: Record<string, unknown>): SupplierOrderTemplate {
  const requiredRaw = row.required_fields ?? row.requiredFields;
  const requiredFields = Array.isArray(requiredRaw) ? requiredRaw.map((f) => String(f)) : [];
  const base = {
    id: String(row.id ?? ""),
    supplierId: String(row.supplier_id ?? row.supplierId ?? ""),
    supplierName: String(row.supplier_name ?? row.supplierName ?? ""),
    name: String(row.name ?? ""),
    requiredFields,
  };
  const spec = templateSpecForRow(base);
  const fieldSchemaRaw = row.field_schema ?? row.fieldSchema;
  const fieldDefinitions = parseFieldSchema(fieldSchemaRaw, requiredFields);
  return {
    ...base,
    fieldDefinitions: fieldDefinitions.length > 0 ? fieldDefinitions : spec?.fieldDefinitions ?? [],
  };
}

async function ensureDefaultSupplierTemplates() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return;
  }
  const { data: suppliersRaw } = await admin.from("suppliers").select("id,name");
  const suppliers = ((suppliersRaw ?? []) as Array<{ id: string; name: string }>).map((s) => ({
    id: String(s.id),
    name: String(s.name),
  }));

  for (const spec of DEFAULT_SUPPLIER_TEMPLATE_SPECS) {
    let supplierId =
      suppliers.find((s) => normalizeSupplierKey(s.name) === normalizeSupplierKey(spec.supplierName))?.id ?? "";
    if (!supplierId) {
      const { data: inserted } = await admin
        .from("suppliers")
        .insert({ name: spec.supplierName })
        .select("id")
        .maybeSingle();
      supplierId = String((inserted as { id?: string } | null)?.id ?? "");
      if (!supplierId) {
        continue;
      }
      suppliers.push({ id: supplierId, name: spec.supplierName });
    }
    const { data: existing } = await admin
      .from("supplier_order_form_templates")
      .select("id")
      .eq("supplier_name", spec.supplierName)
      .eq("name", spec.name)
      .limit(1);
    if ((existing ?? []).length > 0) {
      continue;
    }
    await admin.from("supplier_order_form_templates").insert({
      supplier_id: supplierId,
      supplier_name: spec.supplierName,
      name: spec.name,
      required_fields: spec.fieldDefinitions.filter((f) => f.required).map((f) => f.key),
      field_schema: spec.fieldDefinitions,
    });
  }
}

export async function listSupplierTemplates() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockSupplierTemplates;
  }
  const admin = createSupabaseAdminClient() ?? supabase;
  const { data } = await admin
    .from("supplier_order_form_templates")
    .select("*")
    .order("supplier_name", { ascending: true })
    .order("name", { ascending: true })
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Record<string, unknown>[];
  const mapped = rows.map(mapSupplierOrderTemplateRow);
  const unique = new Map<string, SupplierOrderTemplate>();
  for (const item of mapped) {
    const key = `${normalizeSupplierKey(item.supplierName)}__${normalizeSupplierKey(item.name)}`;
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }
  return Array.from(unique.values());
}

export async function listSuppliers(): Promise<SupplierEntity[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [];
  }
  const admin = createSupabaseAdminClient() ?? supabase;
  const { data } = await admin.from("suppliers").select("id,name").order("name");
  const rows = (data ?? []) as Array<{ id: string; name: string }>;
  const unique = new Map<string, SupplierEntity>();
  for (const row of rows) {
    const name = String(row.name ?? "").trim();
    if (!name) {
      continue;
    }
    const key = normalizeSupplierKey(name);
    if (!unique.has(key)) {
      unique.set(key, { id: String(row.id), name });
    }
  }
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
}

export async function ensureSupplierByName(nameInput: string): Promise<SupplierEntity> {
  const name = String(nameInput ?? "").trim();
  if (!name) {
    throw new Error("Lieferantenname ist Pflicht.");
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Lieferant kann im Mock-Modus nicht erstellt werden.");
  }
  const admin = createSupabaseAdminClient() ?? supabase;
  const { data } = await admin
    .from("suppliers")
    .select("id,name")
    .ilike("name", name)
    .limit(10);
  const rows = (data ?? []) as Array<{ id: string; name: string }>;
  const existing = rows.find((r) => normalizeSupplierKey(r.name) === normalizeSupplierKey(name));
  if (existing) {
    return { id: String(existing.id), name: String(existing.name) };
  }
  const { data: inserted, error } = await admin.from("suppliers").insert({ name }).select("id,name").single();
  if (error || !inserted) {
    throw new Error("Lieferant konnte nicht erstellt werden.");
  }
  return { id: String((inserted as { id: string }).id), name: String((inserted as { name: string }).name) };
}

export async function createSupplierTemplate(input: {
  supplierId: string;
  supplierName: string;
  name: string;
  fieldDefinitions: SupplierOrderFieldDefinition[];
}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Template-Erstellung im Mock-Modus nicht unterstützt.");
  }
  const admin = createSupabaseAdminClient() ?? supabase;
  const requiredFields = input.fieldDefinitions.filter((f) => f.required).map((f) => f.key);
  const { data, error } = await admin.from("supplier_order_form_templates").insert({
    supplier_id: input.supplierId,
    supplier_name: input.supplierName,
    name: input.name,
    required_fields: requiredFields,
    field_schema: input.fieldDefinitions,
  }).select("*").single();
  if (error || !data) {
    throw new Error("Bestellformular konnte nicht erstellt werden.");
  }
  return mapSupplierOrderTemplateRow(data as Record<string, unknown>);
}

export async function updateSupplierTemplate(input: {
  id: string;
  supplierId: string;
  supplierName: string;
  name: string;
  fieldDefinitions: SupplierOrderFieldDefinition[];
}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Template-Bearbeitung im Mock-Modus nicht unterstützt.");
  }
  const admin = createSupabaseAdminClient() ?? supabase;
  const requiredFields = input.fieldDefinitions.filter((f) => f.required).map((f) => f.key);
  const { data, error } = await admin.from("supplier_order_form_templates").update({
    supplier_id: input.supplierId,
    supplier_name: input.supplierName,
    name: input.name,
    required_fields: requiredFields,
    field_schema: input.fieldDefinitions,
  }).eq("id", input.id).select("*").single();
  if (error || !data) {
    throw new Error("Bestellformular konnte nicht gespeichert werden.");
  }
  return mapSupplierOrderTemplateRow(data as Record<string, unknown>);
}

export async function deleteSupplierTemplate(templateId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Template-Löschen im Mock-Modus nicht unterstützt.");
  }
  const admin = createSupabaseAdminClient() ?? supabase;
  const { error } = await admin.from("supplier_order_form_templates").delete().eq("id", templateId);
  if (error) {
    throw new Error("Bestellformular konnte nicht gelöscht werden.");
  }
}

export async function addSupplierSubmission(input: Omit<SupplierOrderSubmission, "id" | "createdAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const submission: SupplierOrderSubmission = {
      id: id("sos"),
      createdAt: new Date().toISOString(),
      ...input,
    };
    mockSupplierSubmissions.push(submission);
    return submission;
  }
  const { data, error } = await supabase.from("supplier_order_form_submissions").insert({
    project_id: input.projectId,
    template_id: input.templateId,
    values_json: input.valuesJson,
    status: input.status,
  }).select("*").single();
  if (error || !data) {
    throw new Error("Bestellformular konnte nicht gespeichert werden.");
  }
  return data as unknown as SupplierOrderSubmission;
}

export async function addStockDecision(input: Omit<StockDecision, "id" | "createdAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const item: StockDecision = {
      id: id("sd"),
      createdAt: new Date().toISOString(),
      ...input,
    };
    mockStockDecisions.push(item);
    return item;
  }
  const { data, error } = await supabase.from("stock_decisions").insert({
    project_id: input.projectId,
    decision: input.decision,
    notes: input.notes,
    decided_by_role: input.decidedByRole,
  }).select("*").single();
  if (error || !data) {
    throw new Error("Lagerentscheidung konnte nicht gespeichert werden.");
  }
  return data as unknown as StockDecision;
}

export async function deleteStockDecision(stockDecisionId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const idx = mockStockDecisions.findIndex((item) => item.id === stockDecisionId);
    if (idx < 0) {
      throw new Error("Lagerentscheid nicht gefunden.");
    }
    mockStockDecisions.splice(idx, 1);
    return;
  }
  const { error } = await supabase.from("stock_decisions").delete().eq("id", stockDecisionId);
  if (error) {
    throw new Error("Lagerentscheidung konnte nicht gelöscht werden.");
  }
}

export async function addMailDispatchLog(input: Omit<MailDispatchLog, "id" | "sentAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const item: MailDispatchLog = {
      id: id("mail"),
      sentAt: new Date().toISOString(),
      ...input,
    };
    mockMailDispatchLogs.push(item);
    return item;
  }
  const { data, error } = await supabase.from("mail_messages").insert({
    project_id: input.projectId,
    recipient: input.to,
    subject: input.subject,
    status: input.status,
    error_message: input.errorMessage,
  }).select("*").single();
  if (error || !data) {
    throw new Error("Mail-Log konnte nicht gespeichert werden.");
  }
  return data as unknown as MailDispatchLog;
}

export async function getDashboardLayout(userId: string): Promise<DashboardLayout | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("dashboard_layout")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const raw = (data as { dashboard_layout?: unknown }).dashboard_layout;
  return parseDashboardLayout(raw);
}

export async function saveDashboardLayout(userId: string, layout: DashboardLayout) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }
  const { error } = await supabase.from("profiles").update({ dashboard_layout: layout }).eq("id", userId);
  if (error) {
    throw new Error(error.message);
  }
}
