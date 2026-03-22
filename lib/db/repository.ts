import type {
  Appointment,
  Customer,
  Delivery,
  Invoice,
  Project,
  ProjectNote,
  PurchaseOrder,
  Quote,
  TechnicianReport,
} from "@/lib/domain/types";
import {
  mockAppointments,
  mockCustomers,
  mockDeliveries,
  mockInvoices,
  mockNotes,
  mockOrders,
  mockProjects,
  mockQuotes,
  mockReports,
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
    return project;
  }

  const { data, error } = await supabase.from("projects").update({
    status,
    next_owner_role: nextOwnerRole,
  }).eq("id", projectId).select("*").single();

  if (error || !data) {
    throw new Error("Projektstatus konnte nicht aktualisiert werden.");
  }

  return data as unknown as Project;
}
