import type {
  Appointment,
  Article,
  AuditEvent,
  CalendarEvent,
  Customer,
  Delivery,
  EmployeeStat,
  Invoice,
  KanbanCard,
  KanbanColumn,
  MailDispatchLog,
  ModuleLabel,
  Project,
  ProjectChatAttachment,
  ProjectChatMessage,
  ProjectNote,
  PurchaseOrder,
  Quote,
  RoleType,
  StockDecision,
  SupplierOrderSubmission,
  SupplierOrderTemplate,
  TechnicianReport,
  UserProfile,
} from "@/lib/domain/types";
import {
  mockAppointments,
  mockArticles,
  mockAuditEvents,
  mockCalendarEvents,
  mockCustomers,
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
  mockProjectChatMessages,
  mockQuotes,
  mockReports,
  mockStockDecisions,
  mockSupplierSubmissions,
  mockSupplierTemplates,
} from "@/lib/db/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProjectBundle = {
  project: Project;
  customer: Customer | null;
  notes: ProjectNote[];
  appointments: Appointment[];
  reports: TechnicianReport[];
  quotes: Quote[];
  orders: PurchaseOrder[];
  deliveries: Delivery[];
  invoices: Invoice[];
};

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
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

  return data as unknown as Project[];
}

export async function listCustomers() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockCustomers;
  }

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as unknown as Customer[];
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
      customer: mockCustomers.find((item) => item.id === project.customerId) ?? null,
      notes: mockNotes.filter((item) => item.projectId === projectId),
      appointments: mockAppointments.filter((item) => item.projectId === projectId),
      reports: mockReports.filter((item) => item.projectId === projectId),
      quotes: mockQuotes.filter((item) => item.projectId === projectId),
      orders: mockOrders.filter((item) => item.projectId === projectId),
      deliveries: mockDeliveries.filter((item) => item.projectId === projectId),
      invoices: mockInvoices.filter((item) => item.projectId === projectId),
    };
  }

  const [{ data: project }, { data: notes }, { data: appointments }, { data: reports }, { data: quotes }, { data: orders }, { data: deliveries }, { data: invoices }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("project_notes").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("appointments").select("*").eq("project_id", projectId).order("starts_at"),
      supabase.from("technician_reports").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("quotes").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("purchase_orders").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("deliveries").select("*").eq("project_id", projectId).order("arrived_at"),
      supabase.from("invoices").select("*").eq("project_id", projectId).order("created_at"),
    ]);

  if (!project) {
    return null;
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", project.customer_id)
    .single();

  return {
    project: project as unknown as Project,
    customer: (customer as unknown as Customer) ?? null,
    notes: (notes as unknown as ProjectNote[]) ?? [],
    appointments: (appointments as unknown as Appointment[]) ?? [],
    reports: (reports as unknown as TechnicianReport[]) ?? [],
    quotes: (quotes as unknown as Quote[]) ?? [],
    orders: (orders as unknown as PurchaseOrder[]) ?? [],
    deliveries: (deliveries as unknown as Delivery[]) ?? [],
    invoices: (invoices as unknown as Invoice[]) ?? [],
  };
}

export async function createCustomer(input: Omit<Customer, "id" | "createdAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const customer: Customer = { id: id("c"), createdAt: new Date().toISOString(), ...input };
    mockCustomers.push(customer);
    return customer;
  }

  const { data, error } = await supabase.from("customers").insert({
    name: input.name,
    email: input.email,
    phone: input.phone,
    street: input.street,
    postal_code: input.postalCode,
    city: input.city,
  }).select("*").single();

  if (error || !data) {
    throw new Error("Kunde konnte nicht erstellt werden.");
  }

  return data as unknown as Customer;
}

export async function createProject(input: Omit<Project, "id" | "createdAt" | "updatedAt" | "closedAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const now = new Date().toISOString();
    const project: Project = {
      ...input,
      id: id("p"),
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    };
    mockProjects.push(project);
    return project;
  }

  const { data, error } = await supabase.from("projects").insert({
    customer_id: input.customerId,
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
  }).select("*").single();

  if (error || !data) {
    throw new Error("Projekt konnte nicht erstellt werden.");
  }

  return data as unknown as Project;
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

export async function addAppointment(input: Omit<Appointment, "id" | "createdAt" | "assignedTechnicianId">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const appointment: Appointment = {
      id: id("a"),
      assignedTechnicianId: null,
      createdAt: new Date().toISOString(),
      ...input,
    };
    mockAppointments.push(appointment);
    return appointment;
  }

  const { data, error } = await supabase.from("appointments").insert({
    project_id: input.projectId,
    kind: input.kind,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    planning_notes: input.planningNotes,
    access_notes: input.accessNotes,
    key_handling_notes: input.keyHandlingNotes,
  }).select("*").single();

  if (error || !data) {
    throw new Error("Termin konnte nicht gespeichert werden.");
  }

  return data as unknown as Appointment;
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

export async function addQuote(input: Omit<Quote, "id" | "createdAt" | "status" | "sentAt" | "approvedAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const quote: Quote = {
      id: id("q"),
      status: "entwurf",
      sentAt: null,
      approvedAt: null,
      createdAt: new Date().toISOString(),
      ...input,
    };
    mockQuotes.push(quote);
    return quote;
  }

  const { data, error } = await supabase.from("quotes").insert({
    project_id: input.projectId,
    version: input.version,
  }).select("*").single();

  if (error || !data) {
    throw new Error("Offerte konnte nicht erstellt werden.");
  }

  return data as unknown as Quote;
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

  return data as unknown as PurchaseOrder;
}

export async function addDelivery(input: Omit<Delivery, "id" | "createdAt" | "arrivedAt" | "checkedByRole">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const delivery: Delivery = {
      id: id("d"),
      arrivedAt: new Date().toISOString(),
      checkedByRole: "office",
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

  return data as unknown as Delivery;
}

export async function addInvoice(input: Omit<Invoice, "id" | "createdAt" | "status" | "sentAt">) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const invoice: Invoice = {
      id: id("i"),
      status: "entwurf",
      sentAt: null,
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

  return data as unknown as Invoice;
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

  return data as unknown as Project;
}

export async function listProfilesByRole(role: RoleType) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockProfiles.filter((item) => item.role === role);
  }
  const { data } = await supabase.from("profiles").select("*").eq("role", role);
  return (data as unknown as UserProfile[]) ?? [];
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
    messages: (messages.data as unknown as ProjectChatMessage[]) ?? [],
    attachments: (attachments.data as unknown as ProjectChatAttachment[]) ?? [],
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
  return data as unknown as ProjectChatMessage;
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
  return data as unknown as ProjectChatAttachment;
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

export async function listArticles() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockArticles;
  }
  const { data } = await supabase.from("articles").select("*").order("name", { ascending: true });
  return (data as unknown as Article[]) ?? [];
}

export async function upsertArticles(items: Omit<Article, "id" | "createdAt">[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    for (const item of items) {
      const existing = mockArticles.find((entry) => entry.sku === item.sku);
      if (existing) {
        existing.name = item.name;
        existing.category = item.category;
        existing.inStock = item.inStock;
      } else {
        mockArticles.push({
          id: id("art"),
          createdAt: new Date().toISOString(),
          ...item,
        });
      }
    }
    return mockArticles;
  }
  const payload = items.map((item) => ({
    name: item.name,
    sku: item.sku,
    category: item.category,
    supplier_id: item.supplierId,
    in_stock: item.inStock,
  }));
  const { data, error } = await supabase.from("articles")
    .upsert(payload, { onConflict: "sku" })
    .select("*");
  if (error || !data) {
    throw new Error("Artikel konnten nicht importiert werden.");
  }
  return data as unknown as Article[];
}

export async function listEmployeeStats() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockEmployeeStats;
  }
  const { data } = await supabase.from("employee_metrics_snapshots").select("*");
  return ((data as unknown as EmployeeStat[]) ?? []).length > 0 ? (data as unknown as EmployeeStat[]) : mockEmployeeStats;
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

export async function listSupplierTemplates() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return mockSupplierTemplates;
  }
  const { data } = await supabase.from("supplier_order_form_templates").select("*").order("name");
  return (data as unknown as SupplierOrderTemplate[]) ?? [];
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
