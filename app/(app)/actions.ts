"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addAppointment,
  addDelivery,
  addInvoice,
  addProjectNote,
  addPurchaseOrder,
  addQuote,
  addTechnicianReport,
  createCustomer,
  createProject,
  getProjectBundle,
  updateProjectStatus,
} from "@/lib/db/repository";
import {
  appointmentSchema,
  deliverySchema,
  intakeSchema,
  invoiceSchema,
  noteSchema,
  orderSchema,
  quoteSchema,
  reportSchema,
  transitionSchema,
} from "@/lib/validations/forms";
import { assertCanTransition } from "@/lib/workflow/project-workflow";

function collectFormData(formData: FormData) {
  const entries = Object.fromEntries(formData.entries());
  return Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
}

export async function createIntakeAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = intakeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  const customer = await createCustomer({
    name: parsed.data.customerName,
    email: parsed.data.customerEmail || null,
    phone: parsed.data.customerPhone || null,
    street: parsed.data.customerStreet || null,
    postalCode: parsed.data.customerPostalCode || null,
    city: parsed.data.customerCity || null,
  });

  const project = await createProject({
    customerId: customer.id,
    title: parsed.data.title,
    type: parsed.data.type,
    status: "anfrage",
    nextOwnerRole: "office",
    nextOwnerUserId: null,
    source: parsed.data.source,
    urgency: parsed.data.urgency,
    intakeOriginalText: parsed.data.intakeOriginalText,
    accessNotes: parsed.data.accessNotes,
    keyHandlingNotes: parsed.data.keyHandlingNotes,
    timingNotes: parsed.data.timingNotes,
    internalNotes: parsed.data.internalNotes ?? null,
  });

  await addProjectNote({
    projectId: project.id,
    type: "kunde",
    body: parsed.data.intakeOriginalText,
    authorRole: "office",
  });

  revalidatePath("/");
  revalidatePath("/projekte");
  redirect(`/projekte/${project.id}`);
}

export async function addProjectNoteAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = noteSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Notiz.");
  }

  await addProjectNote({
    projectId: parsed.data.projectId,
    type: parsed.data.type,
    body: parsed.data.body,
    authorRole: "office",
  });

  revalidatePath(`/projekte/${parsed.data.projectId}`);
}

export async function addAppointmentAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = appointmentSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültiger Termin.");
  }

  await addAppointment({
    projectId: parsed.data.projectId,
    kind: parsed.data.kind,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    planningNotes: parsed.data.planningNotes ?? null,
    accessNotes: parsed.data.accessNotes ?? null,
    keyHandlingNotes: parsed.data.keyHandlingNotes ?? null,
  });

  revalidatePath(`/projekte/${parsed.data.projectId}`);
}

export async function addTechnicianReportAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = reportSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültiger Bericht.");
  }

  await addTechnicianReport({
    projectId: parsed.data.projectId,
    outcome: parsed.data.outcome,
    summary: parsed.data.summary,
    measurementsJson: parsed.data.measurementsJson,
    workDescription: parsed.data.workDescription,
    timeSpentMinutes: parsed.data.timeSpentMinutes ?? null,
  });

  revalidatePath(`/projekte/${parsed.data.projectId}`);
}

export async function addQuoteAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = quoteSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Offerte.");
  }

  await addQuote({
    projectId: parsed.data.projectId,
    version: parsed.data.version,
  });

  revalidatePath(`/projekte/${parsed.data.projectId}`);
}

export async function addOrderAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = orderSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Bestellung.");
  }

  await addPurchaseOrder({
    projectId: parsed.data.projectId,
    supplierId: parsed.data.supplierId,
  });

  revalidatePath(`/projekte/${parsed.data.projectId}`);
}

export async function addDeliveryAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = deliverySchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültiger Wareneingang.");
  }

  await addDelivery({
    projectId: parsed.data.projectId,
    purchaseOrderId: parsed.data.purchaseOrderId || null,
    deliveryNoteNumber: parsed.data.deliveryNoteNumber || null,
  });

  revalidatePath(`/projekte/${parsed.data.projectId}`);
}

export async function addInvoiceAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = invoiceSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Rechnung.");
  }

  await addInvoice({
    projectId: parsed.data.projectId,
    invoiceNumber: parsed.data.invoiceNumber || null,
  });

  revalidatePath(`/projekte/${parsed.data.projectId}`);
}

export async function transitionProjectAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = transitionSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Ungültiger Statuswechsel.");
  }

  const bundle = await getProjectBundle(parsed.data.projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }

  const decision = assertCanTransition(bundle.project, parsed.data.targetStatus, "office");
  if (!decision.ok) {
    throw new Error(decision.reason);
  }

  await updateProjectStatus(parsed.data.projectId, parsed.data.targetStatus, decision.nextOwnerRole);
  revalidatePath(`/projekte/${parsed.data.projectId}`);
}
