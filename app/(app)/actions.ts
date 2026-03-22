"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addAuditEvent,
  addCalendarEvent,
  addMailDispatchLog,
  addAppointment,
  addDelivery,
  addInvoice,
  addProjectChatAttachment,
  addProjectChatMessage,
  addProjectNote,
  addPurchaseOrder,
  addQuote,
  addStockDecision,
  addSupplierSubmission,
  addTechnicianReport,
  createCustomer,
  createProject,
  listArticles,
  listCustomers,
  listProfilesByRole,
  listSupplierTemplates,
  moveKanbanCard,
  renameKanbanColumn,
  upsertArticles,
  upsertModuleLabel,
  getProjectBundle,
  updateProjectStatus,
} from "@/lib/db/repository";
import {
  appointmentSchema,
  chatAttachmentSchema,
  chatMessageSchema,
  csvImportSchema,
  deliverySchema,
  intakeSchema,
  invoiceSchema,
  kanbanColumnRenameSchema,
  kanbanMoveCardSchema,
  moduleLabelSchema,
  noteSchema,
  orderSchema,
  quoteSchema,
  reportSchema,
  smtpSendSchema,
  stockDecisionSchema,
  supplierTemplateSubmissionSchema,
  swissQrSchema,
  transitionSchema,
} from "@/lib/validations/forms";
import { assertCanTransition } from "@/lib/workflow/project-workflow";
import { getCurrentProfile } from "@/lib/auth/session";
import { parseArticleCsv, parseCustomerCsv, toCsv } from "@/lib/integrations/csv";
import { buildIcsInvite } from "@/lib/integrations/calendar";
import { sendMailViaSmtp } from "@/lib/integrations/smtp";
import { generateSwissQrCodeDataUrl } from "@/lib/integrations/swiss-qr";

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
  await addAuditEvent({
    action: "notiz_erstellt",
    projectId: parsed.data.projectId,
    actorRole: "office",
    actorName: "System Benutzer",
    payload: JSON.stringify({ noteType: parsed.data.type }),
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
  await addAuditEvent({
    action: "termin_erstellt",
    projectId: parsed.data.projectId,
    actorRole: "office",
    actorName: "System Benutzer",
    payload: JSON.stringify({ kind: parsed.data.kind, startsAt: parsed.data.startsAt }),
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
  await addAuditEvent({
    action: "rapport_erstellt",
    projectId: parsed.data.projectId,
    actorRole: "technician",
    actorName: "System Benutzer",
    payload: JSON.stringify({ outcome: parsed.data.outcome }),
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
  await addAuditEvent({
    action: "offerte_erstellt",
    projectId: parsed.data.projectId,
    actorRole: "office",
    actorName: "System Benutzer",
    payload: JSON.stringify({ version: parsed.data.version }),
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
  await addAuditEvent({
    action: "bestellung_erstellt",
    projectId: parsed.data.projectId,
    actorRole: "admin",
    actorName: "System Benutzer",
    payload: JSON.stringify({ supplierId: parsed.data.supplierId }),
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
  await addAuditEvent({
    action: "lieferung_erfasst",
    projectId: parsed.data.projectId,
    actorRole: "office",
    actorName: "System Benutzer",
    payload: JSON.stringify({ deliveryNoteNumber: parsed.data.deliveryNoteNumber ?? null }),
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
  await addAuditEvent({
    action: "rechnung_vorbereitet",
    projectId: parsed.data.projectId,
    actorRole: "admin",
    actorName: "System Benutzer",
    payload: JSON.stringify({ invoiceNumber: parsed.data.invoiceNumber ?? null }),
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
  await addAuditEvent({
    action: "status_gewechselt",
    projectId: parsed.data.projectId,
    actorRole: "office",
    actorName: "System Benutzer",
    payload: JSON.stringify({ to: parsed.data.targetStatus }),
  });
  revalidatePath(`/projekte/${parsed.data.projectId}`);
}

export async function updateModuleLabelAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = moduleLabelSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Modulbezeichnung.");
  }
  await upsertModuleLabel(parsed.data.key, parsed.data.label);
  revalidatePath("/");
}

export async function renameKanbanColumnAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = kanbanColumnRenameSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültiger Spaltenname.");
  }
  await renameKanbanColumn(parsed.data.columnId, parsed.data.title);
  revalidatePath("/projekte");
}

export async function moveKanbanCardAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = kanbanMoveCardSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Ungültige Kanban-Aktion.");
  }
  await moveKanbanCard(parsed.data.cardId, parsed.data.columnId);
  revalidatePath("/projekte");
}

export async function addProjectChatMessageAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = chatMessageSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Nachricht.");
  }
  const profile = await getCurrentProfile();
  const message = await addProjectChatMessage({
    projectId: parsed.data.projectId,
    appointmentId: parsed.data.appointmentId || null,
    senderId: profile.id,
    senderName: profile.displayName,
    body: parsed.data.body,
  });
  await addAuditEvent({
    action: "chat_nachricht",
    projectId: parsed.data.projectId,
    actorRole: profile.role,
    actorName: profile.displayName,
    payload: JSON.stringify({ messageId: message.id }),
  });
  revalidatePath(`/projekte/${parsed.data.projectId}`);
}

export async function addProjectChatAttachmentAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = chatAttachmentSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Ungültiger Anhang.");
  }
  await addProjectChatAttachment({
    projectId: parsed.data.projectId,
    messageId: parsed.data.messageId,
    fileName: parsed.data.fileName,
    fileType: parsed.data.fileType,
    filePath: parsed.data.filePath,
  });
  revalidatePath(`/projekte/${parsed.data.projectId}`);
}

export async function assignAppointmentWithCalendarAction(formData: FormData) {
  await addAppointmentAction(formData);
  const payload = collectFormData(formData);
  const projectId = payload.projectId;
  const startsAt = payload.startsAt;
  const endsAt = payload.endsAt;

  const technicians = await listProfilesByRole("technician");
  const technician = technicians[0];
  if (!technician || !projectId || !startsAt || !endsAt) {
    return;
  }

  const ics = buildIcsInvite({
    title: "Bauflip Termin",
    description: `Projekt ${projectId}`,
    startsAt,
    endsAt,
  });

  const mailResult = await sendMailViaSmtp({
    to: technician.email,
    subject: "Neuer Einsatztermin",
    html: `<p>Sie haben einen neuen Termin erhalten.</p><p>Projekt: ${projectId}</p>`,
    attachments: [{ filename: "einsatz.ics", content: ics, contentType: "text/calendar" }],
  });

  await addCalendarEvent({
    projectId,
    appointmentId: `appt-${crypto.randomUUID()}`,
    technicianId: technician.id,
    technicianEmail: technician.email,
    provider: "ics",
    providerEventId: mailResult.ok ? mailResult.messageId ?? null : null,
    startsAt,
    endsAt,
    title: `Einsatz ${projectId}`,
  });
}

export async function importCsvAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = csvImportSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültiger CSV Import.");
  }

  if (parsed.data.type === "articles") {
    const articles = parseArticleCsv(parsed.data.csvText);
    await upsertArticles(articles);
  } else {
    const customers = parseCustomerCsv(parsed.data.csvText);
    for (const customer of customers) {
      await createCustomer(customer);
    }
  }

  revalidatePath("/kunden");
  revalidatePath("/artikel");
}

export async function exportCsvAction(type: "customers" | "articles") {
  if (type === "articles") {
    const rows = await listArticles();
    return toCsv(rows);
  }
  const rows = await listCustomers();
  return toCsv(rows);
}

export async function addStockDecisionAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = stockDecisionSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültiger Lagerentscheid.");
  }
  await addStockDecision({
    projectId: parsed.data.projectId,
    decision: parsed.data.decision,
    notes: parsed.data.notes,
    decidedByRole: "admin",
  });
  if (parsed.data.decision === "bestellen") {
    await updateProjectStatus(parsed.data.projectId, "bestellung", "admin");
  }
  revalidatePath(`/projekte/${parsed.data.projectId}`);
}

export async function submitSupplierTemplateAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = supplierTemplateSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Bestellformular unvollständig.");
  }
  const templates = await listSupplierTemplates();
  const template = templates.find((item) => item.id === parsed.data.templateId);
  if (!template) {
    throw new Error("Lieferantenvorlage nicht gefunden.");
  }
  const values = JSON.parse(parsed.data.valuesJson) as Record<string, string>;
  const missingFields = template.requiredFields.filter((field) => !values[field] || !values[field].trim());
  if (missingFields.length > 0) {
    throw new Error(`Pflichtfelder fehlen: ${missingFields.join(", ")}`);
  }
  await addSupplierSubmission({
    projectId: parsed.data.projectId,
    templateId: parsed.data.templateId,
    valuesJson: parsed.data.valuesJson,
    status: "eingereicht",
  });
  await addAuditEvent({
    action: "bestellformular_eingereicht",
    projectId: parsed.data.projectId,
    actorRole: "admin",
    actorName: "Admin",
    payload: parsed.data.valuesJson,
  });
  revalidatePath(`/projekte/${parsed.data.projectId}`);
}

export async function sendDocumentMailAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = smtpSendSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Mailangaben.");
  }

  const attachments: Array<{ filename: string; content: Buffer | string; contentType?: string }> = [];
  if (
    parsed.data.includeIcs === "true" &&
    parsed.data.icsTitle &&
    parsed.data.icsDescription &&
    parsed.data.icsStartsAt &&
    parsed.data.icsEndsAt
  ) {
    const ics = buildIcsInvite({
      title: parsed.data.icsTitle,
      description: parsed.data.icsDescription,
      startsAt: parsed.data.icsStartsAt,
      endsAt: parsed.data.icsEndsAt,
    });
    attachments.push({ filename: "termin.ics", content: ics, contentType: "text/calendar" });
  }

  const result = await sendMailViaSmtp({
    to: parsed.data.to,
    subject: parsed.data.subject,
    html: parsed.data.html,
    attachments,
  });

  await addMailDispatchLog({
    projectId: parsed.data.projectId ?? null,
    to: parsed.data.to,
    subject: parsed.data.subject,
    status: result.ok ? "gesendet" : "fehler",
    errorMessage: result.ok ? null : result.error,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }
}

export async function generateSwissQrAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = swissQrSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "QR-Daten unvollständig.");
  }
  const qrCode = await generateSwissQrCodeDataUrl(parsed.data);
  await addAuditEvent({
    action: "qr_rechnung_generiert",
    projectId: null,
    actorRole: "admin",
    actorName: "System Benutzer",
    payload: JSON.stringify({ preview: qrCode.slice(0, 120) }),
  });
}
