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
  createContact,
  createProject,
  getDeliveryById,
  getInvoiceById,
  getQuoteById,
  listArticles,
  listContacts,
  listProjects,
  listProfilesByRole,
  listSupplierTemplates,
  moveKanbanCard,
  renameKanbanColumn,
  markDeliveryFinalizedWithPdf,
  markInvoiceFinalizedWithPdf,
  markQuoteFinalizedWithPdf,
  upsertArticles,
  upsertModuleLabel,
  getProjectBundle,
  updateProjectStatus,
} from "@/lib/db/repository";
import { PROJECT_FILE_MAX_BYTES, PROJECT_FILE_MIME, sanitizeFileBaseName } from "@/lib/storage/mime";
import { generateDeliveryPdf, generateInvoicePdf, generateQuotePdf } from "@/lib/documents/project-document-pdf";
import {
  appointmentSchema,
  chatAttachmentSchema,
  chatMessageSchema,
  deliverySchema,
  finalizeDocumentSchema,
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
import { getCurrentProfile, getCurrentRole, getCurrentSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  articlesToStandardCsv,
  contactsToStandardCsv,
  parseArticleCsv,
  parseContactCsv,
  stripCsvBom,
  validateArticleImportCsvHeaders,
  validateContactImportCsvHeaders,
} from "@/lib/integrations/csv";
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

  const session = await getCurrentSession();

  const contact = await createContact({
    organizationId: session?.organizationId ?? null,
    contactNumber: null,
    partyKind: "firma",
    category: "kunde",
    name: parsed.data.contactName,
    uidNumber: null,
    email: parsed.data.contactEmail || null,
    phone: parsed.data.contactPhone || null,
    mobile: null,
    street: parsed.data.contactStreet || null,
    postalCode: parsed.data.contactPostalCode || null,
    city: parsed.data.contactCity || null,
    website: null,
    managedObjectLabel: null,
  });

  const project = await createProject({
    contactId: contact.id,
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
    tenantUnit: null,
    sitePhone: null,
    siteMobile: null,
    referenceCode: null,
    technicianNotes: null,
    propertyId: null,
    mapsUrl: null,
    workTypeId: null,
    contactPersonId: null,
    serviceAddressId: null,
    billingAddressId: null,
    hintsAndNotes: null,
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
    assignedTechnicianId: null,
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

export type AddTechnicianReportResult = { ok: true } | { ok: false; message: string };

export async function addTechnicianReportAction(formData: FormData): Promise<AddTechnicianReportResult> {
  const payload = collectFormData(formData);
  const parsed = reportSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Ungültiger Bericht.",
    };
  }

  try {
    let parsedMeasurements: Record<string, unknown> = {};
    try {
      parsedMeasurements = JSON.parse(parsed.data.measurementsJson) as Record<string, unknown>;
    } catch {
      parsedMeasurements = { raw: parsed.data.measurementsJson };
    }
    const selectedServices = (() => {
      try {
        const arr = JSON.parse(parsed.data.serviceSelections ?? "[]");
        return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
      } catch {
        return [];
      }
    })();
    const selectedArticles = (() => {
      try {
        const arr = JSON.parse(parsed.data.articleSelections ?? "[]");
        return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
      } catch {
        return [];
      }
    })();

    await addTechnicianReport({
      projectId: parsed.data.projectId,
      outcome: parsed.data.outcome,
      summary: parsed.data.summary,
      measurementsJson: JSON.stringify({
        ...parsedMeasurements,
        serviceSelections: selectedServices,
        articleSelections: selectedArticles,
      }),
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
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Bericht konnte nicht gespeichert werden.",
    };
  }
}

export async function addQuoteAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = quoteSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Offerte.");
  }

  const quoteItems = (() => {
    try {
      const arr = JSON.parse(parsed.data.quoteItemsJson ?? "[]");
      if (!Array.isArray(arr)) {
        return [] as Array<{ description: string; quantity: number; unit: string; unitPrice: number }>;
      }
      return arr
        .map((raw) => ({
          description: String((raw as { description?: unknown }).description ?? "").trim(),
          quantity: Number((raw as { quantity?: unknown }).quantity ?? 0),
          unit: String((raw as { unit?: unknown }).unit ?? "Stk").trim(),
          unitPrice: Number((raw as { unitPrice?: unknown }).unitPrice ?? 0),
        }))
        .filter((i) => i.description.length > 0 && Number.isFinite(i.quantity) && i.quantity > 0 && Number.isFinite(i.unitPrice));
    } catch {
      return [] as Array<{ description: string; quantity: number; unit: string; unitPrice: number }>;
    }
  })();

  const subtotalNet = quoteItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const discountPercent = parsed.data.discountPercent ?? 0;
  const vatPercent = parsed.data.vatPercent ?? 8.1;
  const discountAmount = subtotalNet * (discountPercent / 100);
  const totalNet = subtotalNet - discountAmount;
  const vatAmount = totalNet * (vatPercent / 100);
  const totalGross = totalNet + vatAmount;

  await addQuote({
    projectId: parsed.data.projectId,
    version: parsed.data.version,
    warrantyText: parsed.data.warrantyText?.trim() ? parsed.data.warrantyText.trim() : null,
    validityDays: parsed.data.validityDays ?? null,
    leadTimeText: parsed.data.leadTimeText?.trim() ? parsed.data.leadTimeText.trim() : null,
    downPaymentPercent: parsed.data.downPaymentPercent ?? null,
    paymentTermsText: parsed.data.paymentTermsText?.trim() ? parsed.data.paymentTermsText.trim() : null,
    salutationText: parsed.data.salutationText?.trim() ? parsed.data.salutationText.trim() : null,
    textBlocks: parsed.data.textBlocks?.trim() ? parsed.data.textBlocks.trim() : null,
    currency: "CHF",
    discountPercent,
    vatPercent,
    subtotalNet,
    discountAmount,
    totalNet,
    vatAmount,
    totalGross,
    items: quoteItems,
  });
  await addAuditEvent({
    action: "offerte_erstellt",
    projectId: parsed.data.projectId,
    actorRole: "office",
    actorName: "System Benutzer",
    payload: JSON.stringify({ version: parsed.data.version, totalGross, totalNet, positions: quoteItems.length }),
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

async function uploadProjectDocumentPdf(params: {
  organizationId: string;
  projectId: string;
  type: "quote" | "invoice" | "delivery";
  documentId: string;
  nextPdfVersion: number;
  bytes: Uint8Array;
}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }

  const storagePath = `${params.organizationId}/${params.projectId}/${params.type}/${params.documentId}/v${params.nextPdfVersion}.pdf`;
  const { error } = await supabase.storage.from("project-documents").upload(storagePath, Buffer.from(params.bytes), {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) {
    throw new Error(error.message);
  }
  return storagePath;
}

export async function finalizeProjectDocumentAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = finalizeDocumentSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Finalisierung.");
  }

  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  if (!session.organizationId) {
    throw new Error("Keine Organisation im Benutzerkontext.");
  }

  const bundle = await getProjectBundle(parsed.data.projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }
  const pdfBundle = {
    project: bundle.project,
    contactName: bundle.contact?.name ?? "Unbekannt",
    contactEmail: bundle.contact?.email ?? null,
    contactPhone: bundle.contact?.phone ?? null,
  };

  if (parsed.data.documentType === "quote") {
    const quote = await getQuoteById(parsed.data.documentId);
    if (!quote || quote.projectId !== parsed.data.projectId) {
      throw new Error("Offerte nicht gefunden.");
    }
    const nextPdfVersion = (quote.pdfVersion ?? 0) + 1;
    const bytes = await generateQuotePdf(pdfBundle, quote);
    const pdfPath = await uploadProjectDocumentPdf({
      organizationId: session.organizationId,
      projectId: parsed.data.projectId,
      type: "quote",
      documentId: quote.id,
      nextPdfVersion,
      bytes,
    });
    await markQuoteFinalizedWithPdf({
      quoteId: quote.id,
      pdfPath,
      finalizedBy: session.profile.id,
      nextPdfVersion,
    });
    await addAuditEvent({
      action: "offerte_finalisiert_pdf",
      projectId: parsed.data.projectId,
      actorRole: session.role,
      actorName: session.profile.displayName,
      payload: JSON.stringify({ quoteId: quote.id, pdfPath, version: nextPdfVersion }),
    });
  } else if (parsed.data.documentType === "invoice") {
    const invoice = await getInvoiceById(parsed.data.documentId);
    if (!invoice || invoice.projectId !== parsed.data.projectId) {
      throw new Error("Rechnung nicht gefunden.");
    }
    const nextPdfVersion = (invoice.pdfVersion ?? 0) + 1;
    const bytes = await generateInvoicePdf(pdfBundle, invoice);
    const pdfPath = await uploadProjectDocumentPdf({
      organizationId: session.organizationId,
      projectId: parsed.data.projectId,
      type: "invoice",
      documentId: invoice.id,
      nextPdfVersion,
      bytes,
    });
    await markInvoiceFinalizedWithPdf({
      invoiceId: invoice.id,
      pdfPath,
      finalizedBy: session.profile.id,
      nextPdfVersion,
    });
    await addAuditEvent({
      action: "rechnung_finalisiert_pdf",
      projectId: parsed.data.projectId,
      actorRole: session.role,
      actorName: session.profile.displayName,
      payload: JSON.stringify({ invoiceId: invoice.id, pdfPath, version: nextPdfVersion }),
    });
  } else {
    const delivery = await getDeliveryById(parsed.data.documentId);
    if (!delivery || delivery.projectId !== parsed.data.projectId) {
      throw new Error("Lieferschein nicht gefunden.");
    }
    const nextPdfVersion = (delivery.pdfVersion ?? 0) + 1;
    const bytes = await generateDeliveryPdf(pdfBundle, delivery);
    const pdfPath = await uploadProjectDocumentPdf({
      organizationId: session.organizationId,
      projectId: parsed.data.projectId,
      type: "delivery",
      documentId: delivery.id,
      nextPdfVersion,
      bytes,
    });
    await markDeliveryFinalizedWithPdf({
      deliveryId: delivery.id,
      pdfPath,
      finalizedBy: session.profile.id,
      nextPdfVersion,
    });
    await addAuditEvent({
      action: "lieferschein_finalisiert_pdf",
      projectId: parsed.data.projectId,
      actorRole: session.role,
      actorName: session.profile.displayName,
      payload: JSON.stringify({ deliveryId: delivery.id, pdfPath, version: nextPdfVersion }),
    });
  }

  revalidatePath(`/projekte/${parsed.data.projectId}`);
}

export async function transitionProjectAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = transitionSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Ungültiger Statuswechsel.");
  }

  const session = await getCurrentSession();
  const role = session?.role ?? "office";

  const bundle = await getProjectBundle(parsed.data.projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }

  const decision = assertCanTransition(bundle.project, parsed.data.targetStatus, role);
  if (!decision.ok) {
    throw new Error(decision.reason);
  }

  await updateProjectStatus(parsed.data.projectId, parsed.data.targetStatus, decision.nextOwnerRole);
  await addAuditEvent({
    action: "status_gewechselt",
    projectId: parsed.data.projectId,
    actorRole: role,
    actorName: "System Benutzer",
    payload: JSON.stringify({ to: parsed.data.targetStatus }),
  });
  revalidatePath(`/projekte/${parsed.data.projectId}`);
  revalidatePath("/projekte");
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

/** Lädt Bild/PDF in den Bucket project-files und verknüpft eine Chat-Nachricht. */
export async function uploadProjectChatFileAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const file = formData.get("file") as File | null;
  if (!projectId) {
    throw new Error("Projekt fehlt.");
  }
  if (!file || typeof file !== "object" || file.size === 0) {
    throw new Error("Bitte eine Datei wählen.");
  }
  if (!session.organizationId) {
    throw new Error("Keine Organisation. Bitte warten Sie auf die Freischaltung oder kontaktieren Sie einen Admin.");
  }
  if (!PROJECT_FILE_MIME.has(file.type)) {
    throw new Error("Nur Bilder (JPEG, PNG, WebP, GIF) oder PDF / Word-Dokumente sind erlaubt.");
  }
  if (file.size > PROJECT_FILE_MAX_BYTES) {
    throw new Error("Datei darf maximal 15 MB gross sein.");
  }

  const bundle = await getProjectBundle(projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }

  const safe = sanitizeFileBaseName(file.name) || "datei";
  const storagePath = `${session.organizationId}/${projectId}/${Date.now()}-${safe}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from("project-files").upload(storagePath, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const profile = session.profile;
  const message = await addProjectChatMessage({
    projectId,
    appointmentId: null,
    senderId: profile.id,
    senderName: profile.displayName,
    body: "📎 Datei geteilt",
  });

  await addProjectChatAttachment({
    projectId,
    messageId: message.id,
    fileName: file.name,
    fileType: file.type,
    filePath: storagePath,
  });

  await addAuditEvent({
    action: "chat_anhang_hochgeladen",
    projectId,
    actorRole: profile.role,
    actorName: profile.displayName,
    payload: JSON.stringify({ messageId: message.id, path: storagePath }),
  });

  revalidatePath(`/projekte/${projectId}`);
}

export async function assignAppointmentWithCalendarAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = appointmentSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültiger Termin.");
  }

  const technicians = await listProfilesByRole("technician");
  const technician = technicians[0];
  const appt = await addAppointment({
    projectId: parsed.data.projectId,
    kind: parsed.data.kind,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    assignedTechnicianId: technician?.id ?? null,
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
  revalidatePath("/termine");

  const projects = await listProjects();
  const projectTitle = projects.find((p) => p.id === parsed.data.projectId)?.title ?? parsed.data.projectId;

  if (!technician) {
    return;
  }

  const ics = buildIcsInvite({
    title: `Bauflip: ${projectTitle}`,
    description: `Projekt ${parsed.data.projectId}`,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
  });

  const mailResult = await sendMailViaSmtp({
    to: technician.email,
    subject: "Neuer Einsatztermin",
    html: `<p>Sie haben einen neuen Termin erhalten.</p><p>${projectTitle}</p>`,
    attachments: [{ filename: "einsatz.ics", content: ics, contentType: "text/calendar" }],
  });

  await addCalendarEvent({
    projectId: parsed.data.projectId,
    appointmentId: appt.id,
    technicianId: technician.id,
    technicianEmail: technician.email,
    provider: "ics",
    providerEventId: mailResult.ok ? mailResult.messageId ?? null : null,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    title: `Einsatz ${projectTitle}`,
  });

  const { syncExternalCalendars } = await import("@/lib/calendar/sync-external-calendars");
  await syncExternalCalendars({
    appointment: appt,
    projectTitle,
    technician,
  });
}

export async function importCsvAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  const role = await getCurrentRole();
  if (role !== "admin" && role !== "office") {
    throw new Error("Kein Zugriff auf Import (nur Büro/Admin).");
  }

  const typeRaw = formData.get("type");
  const type = typeRaw === "articles" ? "articles" : "contacts";

  const file = formData.get("file");
  let csvText = "";
  if (file instanceof File && file.size > 0) {
    csvText = await file.text();
  } else {
    csvText = String(formData.get("csvText") ?? "").trim();
  }
  csvText = stripCsvBom(csvText);
  if (!csvText.trim()) {
    throw new Error("Bitte eine CSV-Datei auswählen oder den Inhalt einfügen.");
  }

  if (type === "articles") {
    const headerErr = validateArticleImportCsvHeaders(csvText);
    if (headerErr) {
      throw new Error(headerErr);
    }
    const articles = parseArticleCsv(csvText).filter((r) => r.name.trim() && r.sku.trim());
    if (articles.length === 0) {
      throw new Error("Keine gültigen Zeilen: pro Artikel sind Name und SKU (Artikelnummer) erforderlich.");
    }
    await upsertArticles(articles);
  } else {
    const headerErr = validateContactImportCsvHeaders(csvText);
    if (headerErr) {
      throw new Error(headerErr);
    }
    const rows = parseContactCsv(csvText).filter((r) => r.name.trim());
    if (rows.length === 0) {
      throw new Error("Keine gültigen Zeilen: pro Kontakt ist ein Name erforderlich.");
    }
    for (const row of rows) {
      await createContact({
        ...row,
        organizationId: session.organizationId ?? null,
      });
    }
  }

  revalidatePath("/kontakte");
  revalidatePath("/artikel");
  revalidatePath("/import-export");
}

export async function exportCsvAction(type: "contacts" | "articles") {
  if (type === "articles") {
    return articlesToStandardCsv(await listArticles());
  }
  return contactsToStandardCsv(await listContacts());
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
