"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addAuditEvent,
  addCalendarEvent,
  addMailDispatchLog,
  addAppointment,
  deleteAppointment,
  addDelivery,
  addInvoice,
  addProjectChatAttachment,
  addProjectChatMessage,
  addProjectAttachment,
  addProjectNote,
  addPurchaseOrder,
  addQuote,
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
  getContactWithDetails,
  getProjectBundle,
  listQuoteItems,
  updateProjectStatus,
  listReportOutcomeOptions,
  insertReportOutcomeOption,
  deleteReportOutcomeOption,
  insertReportSelectOption,
  deleteReportSelectOption,
  deleteQuoteForProject,
  deleteInvoiceForProject,
} from "@/lib/db/repository";
import { PROJECT_FILE_MAX_BYTES, PROJECT_FILE_MIME, sanitizeFileBaseName } from "@/lib/storage/mime";
import { generateDeliveryPdf, generateInvoicePdf, generateQuotePdf } from "@/lib/documents/project-document-pdf";
import {
  appointmentSchema,
  chatAttachmentSchema,
  chatMessageSchema,
  deliverySchema,
  finalizeDocumentSchema,
  deleteDraftQuoteSchema,
  deleteDraftInvoiceSchema,
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
  supplierTemplateSubmissionSchema,
  transitionSchema,
} from "@/lib/validations/forms";
import { assertCanTransition, getAllowedTransitions, type ProjectRequiredField } from "@/lib/workflow/project-workflow";
import { getWorkflowPhaseIndex } from "@/lib/workflow/project-workflow-rail";
import { getBundlePrerequisiteMessages } from "@/lib/workflow/project-guided-flow";
import { projectStatuses, type Contact, type ProjectStatus } from "@/lib/domain/types";
import { isUuidString, parseBexioContactIdNumeric } from "@/lib/utils";
import { getCurrentProfile, getCurrentSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
import { BAUFLIP_ZAPIER_EVENTS } from "@/lib/integrations/zapier-events";
import { dispatchZapierEvent } from "@/lib/integrations/zapier";
import { getRequiredSupplierFieldKeys } from "@/lib/forms/supplier-conditions";

function collectFormData(formData: FormData) {
  const entries = Object.fromEntries(formData.entries());
  return Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
}

/** Nur Felder, die Zapier/bexio typischerweise braucht (keine internen UUIDs, keine Adress-Duplikate). */
function zapierContactPayload(contact: Contact | null | undefined) {
  const raw = contact?.bexioContactId?.trim();
  const bexioContactIdNumeric = raw ? parseBexioContactIdNumeric(raw) : null;
  const t = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);
  return {
    bexioContactIdNumeric,
    contactName: contact ? t(contact.name) : null,
    contactEmail: contact ? t(contact.email) : null,
  };
}

/** Wenn `quotes.total_net` / `total_gross` in der DB 0 sind (Legacy/Daten), aus Positionen wie beim Offertenspeichern nachrechnen. */
function zapierTotalsFromQuoteOrLines(
  quote: { discountPercent: number; vatPercent: number; totalNet: number; totalGross: number },
  lineItems: Array<{ quantity: number; unitPrice: number }>,
): { totalNet: number; totalGross: number } {
  const tn = quote.totalNet ?? 0;
  const tg = quote.totalGross ?? 0;
  if (tn !== 0 || tg !== 0) {
    return { totalNet: tn, totalGross: tg };
  }
  if (lineItems.length === 0) {
    return { totalNet: tn, totalGross: tg };
  }
  const subtotalNet = lineItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const discountPercent = quote.discountPercent ?? 0;
  const vatPercent = quote.vatPercent ?? 8.1;
  const discountAmount = subtotalNet * (discountPercent / 100);
  const totalNet = subtotalNet - discountAmount;
  const vatAmount = totalNet * (vatPercent / 100);
  const totalGross = totalNet + vatAmount;
  return { totalNet, totalGross };
}

async function buildNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RE-${year}-`;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return `${prefix}${String(Date.now()).slice(-3)}`;
  }
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as Array<{ invoice_number?: string | null }>;
  let max = 0;
  for (const row of rows) {
    const num = String(row.invoice_number ?? "");
    const m = num.match(/^RE-(\d{4})-(\d+)$/);
    if (!m || Number(m[1]) !== year) {
      continue;
    }
    const n = Number(m[2]);
    if (Number.isFinite(n) && n > max) {
      max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

async function assignAppointmentToTechnicianCalendar(params: {
  appointmentId: string;
  projectId: string;
  kind: "besichtigung" | "ausfuehrung";
  startsAt: string;
  endsAt: string;
  assignedTechnicianId: string;
  actorRole: "admin" | "office" | "technician";
  actorName: string;
}) {
  const technicians = await listProfilesByRole("technician");
  const technician = technicians.find((t) => t.id === params.assignedTechnicianId);
  if (!technician) {
    throw new Error("Ausgewählter Monteur wurde nicht gefunden.");
  }

  const projects = await listProjects();
  const projectTitle = projects.find((p) => p.id === params.projectId)?.title ?? params.projectId;
  const calendarTitle = `Einsatz ${projectTitle}`;

  const ics = buildIcsInvite({
    title: `Bauflip: ${projectTitle}`,
    description: `Projekt ${params.projectId}`,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
  });

  const mailResult = await sendMailViaSmtp({
    to: technician.email,
    subject: "Neuer Einsatztermin",
    html: `<p>Sie haben einen neuen Termin erhalten.</p><p>${projectTitle}</p>`,
    attachments: [{ filename: "einsatz.ics", content: ics, contentType: "text/calendar" }],
  });

  await addCalendarEvent({
    projectId: params.projectId,
    appointmentId: params.appointmentId,
    technicianId: technician.id,
    technicianEmail: technician.email,
    provider: "ics",
    providerEventId: mailResult.ok ? mailResult.messageId ?? null : null,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    title: calendarTitle,
  });

  const { syncExternalCalendars } = await import("@/lib/calendar/sync-external-calendars");
  await syncExternalCalendars({
    appointment: {
      id: params.appointmentId,
      projectId: params.projectId,
      kind: params.kind,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      assignedTechnicianId: technician.id,
      planningNotes: null,
      accessNotes: null,
      keyHandlingNotes: null,
      createdAt: new Date().toISOString(),
    },
    projectTitle,
    technician,
  });

  await addAuditEvent({
    action: "termin_zugewiesen",
    projectId: params.projectId,
    actorRole: params.actorRole,
    actorName: params.actorName,
    payload: JSON.stringify({
      appointmentId: params.appointmentId,
      technicianId: technician.id,
      technicianName: technician.displayName,
      technicianEmail: technician.email,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      calendarTitle,
      mailSent: mailResult.ok,
      mailError: mailResult.ok ? null : mailResult.error,
    }),
  });
}

export async function createIntakeAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = intakeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }

  const session = await getCurrentSession();

  let contact;
  if (parsed.data.contactId) {
    const details = await getContactWithDetails(parsed.data.contactId);
    if (!details) {
      throw new Error("Kontakt nicht gefunden.");
    }
    const c = details.contact;
    if (
      session?.organizationId &&
      c.organizationId &&
      session.organizationId !== c.organizationId
    ) {
      throw new Error("Dieser Kontakt gehört nicht zu Ihrer Organisation.");
    }
    contact = c;
  } else {
    contact = await createContact({
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
      bexioContactId: null,
    });
  }

  const project = await createProject({
    contactId: contact.id,
    title: parsed.data.title,
    type: parsed.data.type,
    status: "anfrage",
    nextOwnerRole: "office",
    nextOwnerUserId: null,
    source: parsed.data.source,
    intakeOriginalText: parsed.data.intakeOriginalText,
    accessNotes: parsed.data.accessNotes,
    keyHandlingNotes: parsed.data.keyHandlingNotes?.trim() ? parsed.data.keyHandlingNotes : null,
    timingNotes: null,
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

  const intakeForNote = parsed.data.intakeOriginalText.trim();
  if (intakeForNote.length > 0) {
    await addProjectNote({
      projectId: project.id,
      type: "kunde",
      body: intakeForNote,
      authorRole: "office",
    });
  }

  revalidatePath("/");
  revalidatePath("/projekte");
  redirect(`/projekte?openProjectId=${encodeURIComponent(project.id)}`);
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
  const session = await getCurrentSession();
  const assignedTechnicianId = parsed.data.assignedTechnicianId?.trim() || null;
  if (!assignedTechnicianId) {
    throw new Error("Bitte Monteur auswählen.");
  }
  const startsAtDate = new Date(parsed.data.startsAt);
  const endsAtDate = new Date(parsed.data.endsAt);
  if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
    throw new Error("Bitte gültige Start- und Endzeit erfassen.");
  }
  if (endsAtDate.getTime() <= startsAtDate.getTime()) {
    throw new Error("Ende muss nach Beginn liegen.");
  }

  const appointment = await addAppointment({
    projectId: parsed.data.projectId,
    kind: parsed.data.kind,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    assignedTechnicianId,
    planningNotes: parsed.data.planningNotes ?? null,
    accessNotes: parsed.data.accessNotes ?? null,
    keyHandlingNotes: parsed.data.keyHandlingNotes ?? null,
  });
  await addAuditEvent({
    action: "termin_erstellt",
    projectId: parsed.data.projectId,
    actorRole: session?.role ?? "office",
    actorName: session?.profile.displayName ?? "System Benutzer",
    payload: JSON.stringify({
      kind: parsed.data.kind,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      assignedTechnicianId,
    }),
  });

  if (assignedTechnicianId) {
    await assignAppointmentToTechnicianCalendar({
      appointmentId: appointment.id,
      projectId: parsed.data.projectId,
      kind: parsed.data.kind,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      assignedTechnicianId,
      actorRole: session?.role ?? "office",
      actorName: session?.profile.displayName ?? "System Benutzer",
    });
  }

  revalidatePath(`/projekte/${parsed.data.projectId}`);
  revalidatePath("/projekte");
  revalidatePath("/termine");
  revalidatePath("/");
}

export async function deleteAppointmentAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  const appointmentId = String(formData.get("appointmentId") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!appointmentId) {
    throw new Error("Termin-ID fehlt.");
  }
  await deleteAppointment(appointmentId);
  await addAuditEvent({
    action: "termin_geloescht",
    projectId: projectId || null,
    actorRole: session.role,
    actorName: session.profile.displayName ?? "System Benutzer",
    payload: JSON.stringify({ appointmentId }),
  });
  if (projectId) {
    revalidatePath(`/projekte/${projectId}`);
  }
  revalidatePath("/projekte");
  revalidatePath("/termine");
  revalidatePath("/");
}

export type AddTechnicianReportResult = { ok: true } | { ok: false; message: string };

export async function addTechnicianReportAction(formData: FormData): Promise<AddTechnicianReportResult> {
  const payload = collectFormData(formData);
  const parsed = reportSchema.safeParse(payload);
  const session = await getCurrentSession();
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

    const projectBundleBefore = await getProjectBundle(parsed.data.projectId);
    if (!projectBundleBefore) {
      return { ok: false, message: "Projekt nicht gefunden." };
    }

    if (!session) {
      return { ok: false, message: "Nicht angemeldet." };
    }

    if (session.role === "technician") {
      const isAssigned =
        projectBundleBefore.appointments?.some((a) => a.assignedTechnicianId === session.user.id) ?? false;
      if (!isAssigned) {
        return { ok: false, message: "Keine Berechtigung für diesen Rapport." };
      }
    }

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
      actorRole: session.role,
      actorName: "System Benutzer",
      payload: JSON.stringify({ outcome: parsed.data.outcome }),
    });
    if (session?.organizationId) {
      await dispatchZapierEvent({
        organizationId: session.organizationId,
        eventType: BAUFLIP_ZAPIER_EVENTS.REPORT_CREATED,
        payload: {
          ...zapierContactPayload(projectBundle.contact),
          projectId: parsed.data.projectId,
          outcome: parsed.data.outcome,
          summary: parsed.data.summary,
          timeSpentMinutes: parsed.data.timeSpentMinutes ?? null,
        },
      });
    }

    // Nach erfolgreichem Rapport ggf. Projektstatus entlang des geführten Workflows fortschreiben.
    // Dabei nutzen wir dieselbe Validierungslogik wie transitionProjectAction, blockieren aber den Rapport selbst nicht,
    // falls ein Statuswechsel (z.B. wegen fehlender Stammdaten) nicht möglich ist.
    try {
      const bundleAfter = await getProjectBundle(parsed.data.projectId);
      if (bundleAfter && session) {
        const currentProject = bundleAfter.project;
        const currentStatus = currentProject.status;

        const candidateTargets: ProjectStatus[] = [];
        if (currentStatus === "bericht_ausstehend") {
          candidateTargets.push("bericht_fertig");
        }
        if (currentStatus === "ausfuehrung_geplant") {
          candidateTargets.push("ausfuehrung_erledigt");
        }
        if (currentStatus === "besichtigung" && parsed.data.outcome === "direkt_geloest") {
          candidateTargets.push("ausfuehrung_erledigt");
        }

        for (const targetStatus of candidateTargets) {
          const decision = assertCanTransition(currentProject, targetStatus, session.role);
          if (!decision.ok) {
            continue;
          }
          const prerequisiteMessages = getBundlePrerequisiteMessages(currentProject, targetStatus, {
            besichtigungAppointments: bundleAfter.appointments.filter((a) => a.kind === "besichtigung").length,
            ausfuehrungAppointments: bundleAfter.appointments.filter((a) => a.kind === "ausfuehrung").length,
            reports: bundleAfter.reports.length,
            directResolvedReports: bundleAfter.reports.filter((r) => r.outcome === "direkt_geloest").length,
            quotes: bundleAfter.quotes.length,
            quoteFinalized: bundleAfter.quotes.filter(
              (q) => Boolean(q.finalizedAt) || Boolean(q.deliverySentAt),
            ).length,
            supplierSubmissions: (bundleAfter.supplierSubmissions ?? []).length,
            orders: bundleAfter.orders.length,
            deliveries: bundleAfter.deliveries.length,
            invoices: bundleAfter.invoices.length,
            invoiceFinalized: bundleAfter.invoices.filter(
              (inv) => Boolean(inv.finalizedAt) || Boolean(inv.deliverySentAt),
            ).length,
          });
          if (prerequisiteMessages.length > 0) {
            continue;
          }

          await updateProjectStatus(parsed.data.projectId, targetStatus, decision.nextOwnerRole);
          await addAuditEvent({
            action: "status_gewechselt",
            projectId: parsed.data.projectId,
            actorRole: session.role,
            actorName: "System Benutzer",
            payload: JSON.stringify({
              to: targetStatus,
              reason: "technician_report",
            }),
          });
          // Nur einen passenden Übergang pro Rapport ausführen.
          break;
        }
      }
    } catch (statusError) {
      console.error(statusError);
    }

    revalidatePath(`/projekte/${parsed.data.projectId}`);
    revalidatePath("/rapporte");
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
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung: Offerten dürfen nur von Büro oder Admin erstellt werden.");
  }

  const payload = collectFormData(formData);
  const parsed = quoteSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Offerte.");
  }

  const quoteItems = (() => {
    try {
      const arr = JSON.parse(parsed.data.quoteItemsJson ?? "[]");
      if (!Array.isArray(arr)) {
        return [] as Array<{
          description: string;
          quantity: number;
          unit: string;
          unitPrice: number;
          articleId: string | null;
        }>;
      }
      return arr
        .map((raw) => {
          const description = String((raw as { description?: unknown }).description ?? "").trim();
          const source = String((raw as { source?: unknown }).source ?? "");
          const refId = (raw as { refId?: unknown }).refId;
          let articleId: string | null = null;
          if (source === "artikel" && typeof refId === "string" && isUuidString(refId)) {
            articleId = refId;
          }
          return {
            description,
            quantity: Number((raw as { quantity?: unknown }).quantity ?? 0),
            unit: String((raw as { unit?: unknown }).unit ?? "Stk").trim(),
            unitPrice: Number((raw as { unitPrice?: unknown }).unitPrice ?? 0),
            articleId,
          };
        })
        .filter((i) => i.description.length > 0 && Number.isFinite(i.quantity) && i.quantity > 0 && Number.isFinite(i.unitPrice));
    } catch {
      return [] as Array<{
        description: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        articleId: string | null;
      }>;
    }
  })();

  const subtotalNet = quoteItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const discountPercent = parsed.data.discountPercent ?? 0;
  const vatPercent = parsed.data.vatPercent ?? 8.1;
  const discountAmount = subtotalNet * (discountPercent / 100);
  const totalNet = subtotalNet - discountAmount;
  const vatAmount = totalNet * (vatPercent / 100);
  const totalGross = totalNet + vatAmount;

  const bundle = await getProjectBundle(parsed.data.projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }
  const nextVersion = bundle.quotes.reduce((max, q) => Math.max(max, q.version), 0) + 1;

  let createdQuote;
  try {
    createdQuote = await addQuote({
      projectId: parsed.data.projectId,
      version: nextVersion,
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
  } catch (error) {
    throw new Error(
      `Offerte konnte nicht erstellt werden: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
    );
  }
  const quoteLineItems = await listQuoteItems(createdQuote.id);
  await addAuditEvent({
    action: "offerte_erstellt",
    projectId: parsed.data.projectId,
    actorRole: session.role,
    actorName: session.profile.displayName,
    payload: JSON.stringify({ version: nextVersion, totalGross, totalNet, positions: quoteItems.length }),
  });
  if (session.organizationId) {
    await dispatchZapierEvent({
      organizationId: session.organizationId,
      eventType: BAUFLIP_ZAPIER_EVENTS.QUOTE_CREATED,
      payload: {
        ...zapierContactPayload(bundle.contact),
        lineItems: quoteLineItems,
        projectId: parsed.data.projectId,
        version: nextVersion,
        totalGross,
        totalNet,
        currency: "CHF",
      },
    });
  }

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
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung: Rechnungen dürfen nur von Büro oder Admin erstellt werden.");
  }

  const payload = collectFormData(formData);
  const parsed = invoiceSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Rechnung.");
  }

  const autoInvoiceNumber = await buildNextInvoiceNumber();
  const created = await addInvoice({
    projectId: parsed.data.projectId,
    invoiceNumber: autoInvoiceNumber,
  });
  await addAuditEvent({
    action: "rechnung_vorbereitet",
    projectId: parsed.data.projectId,
    actorRole: session.role,
    actorName: session.profile.displayName,
    payload: JSON.stringify({ invoiceNumber: autoInvoiceNumber, invoiceId: created.id }),
  });

  if (session.organizationId) {
    const invBundle = await getProjectBundle(parsed.data.projectId);
    if (invBundle) {
      const latestQuoteForLines =
        invBundle.quotes.length > 0 ? [...invBundle.quotes].sort((a, b) => b.version - a.version)[0] : null;
      const invoiceLineItems = latestQuoteForLines ? await listQuoteItems(latestQuoteForLines.id) : [];
      const invoiceZapierTotals = latestQuoteForLines
        ? zapierTotalsFromQuoteOrLines(latestQuoteForLines, invoiceLineItems)
        : { totalNet: 0, totalGross: 0 };
      await dispatchZapierEvent({
        organizationId: session.organizationId,
        eventType: BAUFLIP_ZAPIER_EVENTS.INVOICE_CREATED,
        payload: {
          ...zapierContactPayload(invBundle.contact),
          lineItems: invoiceLineItems,
          projectId: parsed.data.projectId,
          invoiceId: created.id,
          invoiceNumber: created.invoiceNumber,
          totalGross: latestQuoteForLines ? invoiceZapierTotals.totalGross : null,
          totalNet: latestQuoteForLines ? invoiceZapierTotals.totalNet : null,
          currency: "CHF",
        },
      });
    }
  }

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
  const buckets = ["project-documents", "project-files"] as const;
  let lastError: string | null = null;
  for (const bucket of buckets) {
    const { error } = await supabase.storage.from(bucket).upload(storagePath, Buffer.from(params.bytes), {
      contentType: "application/pdf",
      upsert: true,
    });
    if (!error) {
      return storagePath;
    }
    lastError = error.message;
    const lower = error.message.toLowerCase();
    const canTryNext = lower.includes("bucket not found") || lower.includes("not found");
    if (!canTryNext) {
      throw new Error(error.message);
    }
  }
  throw new Error(lastError ?? "PDF konnte nicht hochgeladen werden.");
}

async function removeStoredProjectPdf(pdfPath: string | null | undefined, organizationId: string): Promise<void> {
  const raw = pdfPath?.trim();
  if (!raw) {
    return;
  }
  if (!raw.startsWith(`${organizationId}/`)) {
    return;
  }
  const supabase = createSupabaseAdminClient() ?? (await createSupabaseServerClient());
  if (!supabase) {
    return;
  }
  const buckets = ["project-documents", "project-files"] as const;
  for (const bucket of buckets) {
    await supabase.storage.from(bucket).remove([raw]);
  }
}

export async function deleteDraftQuoteAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung: Offerten dürfen nur von Büro oder Admin gelöscht werden.");
  }
  if (!session.organizationId) {
    throw new Error("Keine Organisation im Benutzerkontext.");
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const quoteId = String(formData.get("quoteId") ?? "").trim();
  const parsed = deleteDraftQuoteSchema.safeParse({ projectId, quoteId });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Anfrage.");
  }
  const bundle = await getProjectBundle(parsed.data.projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }
  const quote = bundle.quotes.find((q) => q.id === parsed.data.quoteId);
  if (!quote) {
    throw new Error("Offerte nicht gefunden.");
  }
  await removeStoredProjectPdf(quote.pdfPath, session.organizationId);
  await deleteQuoteForProject({ quoteId: parsed.data.quoteId, projectId: parsed.data.projectId });
  await addAuditEvent({
    action: "offerte_geloescht",
    projectId: parsed.data.projectId,
    actorRole: session.role,
    actorName: session.profile.displayName,
    payload: JSON.stringify({ quoteId: parsed.data.quoteId, version: quote.version, wasFinalized: Boolean(quote.finalizedAt) }),
  });
  revalidatePath(`/projekte/${parsed.data.projectId}`);
  revalidatePath("/projekte");
}

export async function deleteDraftInvoiceAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung: Rechnungen dürfen nur von Büro oder Admin gelöscht werden.");
  }
  if (!session.organizationId) {
    throw new Error("Keine Organisation im Benutzerkontext.");
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  const parsed = deleteDraftInvoiceSchema.safeParse({ projectId, invoiceId });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Anfrage.");
  }
  const bundle = await getProjectBundle(parsed.data.projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }
  const invoice = bundle.invoices.find((i) => i.id === parsed.data.invoiceId);
  if (!invoice) {
    throw new Error("Rechnung nicht gefunden.");
  }
  await removeStoredProjectPdf(invoice.pdfPath, session.organizationId);
  await deleteInvoiceForProject({ invoiceId: parsed.data.invoiceId, projectId: parsed.data.projectId });
  await addAuditEvent({
    action: "rechnung_geloescht",
    projectId: parsed.data.projectId,
    actorRole: session.role,
    actorName: session.profile.displayName,
    payload: JSON.stringify({
      invoiceId: parsed.data.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      wasFinalized: Boolean(invoice.finalizedAt),
    }),
  });
  revalidatePath(`/projekte/${parsed.data.projectId}`);
  revalidatePath("/projekte");
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
  const finalizedByFk = isUuidString(session.profile.id) ? session.profile.id : null;
  const deliveryChannel = parsed.data.deliveryChannel ?? "post";
  const pdfBundle = {
    project: bundle.project,
    contactName: bundle.contact?.name ?? "Unbekannt",
    contactEmail: bundle.contact?.email ?? null,
    contactPhone: bundle.contact?.phone ?? null,
  };

  const maybeSendByEmail = async (bytes: Uint8Array) => {
    if (deliveryChannel !== "email") {
      return;
    }
    const to = parsed.data.emailTo?.trim() || bundle.contact?.email || "";
    if (!to) {
      throw new Error("Empfänger-E-Mail fehlt.");
    }
    const cc = parsed.data.emailCc?.trim() || "";
    const bcc = parsed.data.emailBcc?.trim() || "";
    const subject = parsed.data.emailSubject?.trim() || `Bauflip Dokument: ${bundle.project.title}`;
    const html =
      parsed.data.emailHtml?.trim() ||
      `<p>Guten Tag</p><p>im Anhang erhalten Sie das Dokument als PDF.</p><p>Freundliche Grüsse<br/>${session.profile.displayName}</p>`;
    const result = await sendMailViaSmtp({
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      html,
      attachments: [{ filename: "dokument.pdf", content: Buffer.from(bytes), contentType: "application/pdf" }],
    });
    await addMailDispatchLog({
      projectId: parsed.data.projectId,
      to,
      subject,
      status: result.ok ? "gesendet" : "fehler",
      errorMessage: result.ok ? null : result.error,
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
  };

  const maybeAdvanceStatus = async (targetStatus: "offerte_gesendet") => {
    if (bundle.project.status === targetStatus) {
      return;
    }
    const decision = assertCanTransition(bundle.project, targetStatus, session.role);
    if (!decision.ok) {
      return;
    }
    await updateProjectStatus(parsed.data.projectId, targetStatus, decision.nextOwnerRole);
    await addAuditEvent({
      action: "status_gewechselt",
      projectId: parsed.data.projectId,
      actorRole: session.role,
      actorName: session.profile.displayName,
      payload: JSON.stringify({ to: targetStatus, reason: "document_finalize" }),
    });
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
    await maybeSendByEmail(bytes);
    await markQuoteFinalizedWithPdf({
      quoteId: quote.id,
      pdfPath,
      finalizedBy: finalizedByFk,
      nextPdfVersion,
      deliveryChannel,
      deliveryRecipient: deliveryChannel === "email" ? (parsed.data.emailTo?.trim() || bundle.contact?.email || null) : null,
    });
    await maybeAdvanceStatus("offerte_gesendet");
    await addAuditEvent({
      action: "offerte_finalisiert_pdf",
      projectId: parsed.data.projectId,
      actorRole: session.role,
      actorName: session.profile.displayName,
      payload: JSON.stringify({ quoteId: quote.id, pdfPath, version: nextPdfVersion, deliveryChannel }),
    });
    const finalizedQuoteLines = await listQuoteItems(quote.id);
    const zapierTotals = zapierTotalsFromQuoteOrLines(quote, finalizedQuoteLines);
    await dispatchZapierEvent({
      organizationId: session.organizationId,
      eventType: BAUFLIP_ZAPIER_EVENTS.QUOTE_CREATED,
      payload: {
        ...zapierContactPayload(bundle.contact),
        lineItems: finalizedQuoteLines,
        projectId: parsed.data.projectId,
        quoteId: quote.id,
        version: nextPdfVersion,
        pdfPath,
        deliveryChannel,
        totalGross: zapierTotals.totalGross,
        totalNet: zapierTotals.totalNet,
      },
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
    await maybeSendByEmail(bytes);
    await markInvoiceFinalizedWithPdf({
      invoiceId: invoice.id,
      pdfPath,
      finalizedBy: finalizedByFk,
      nextPdfVersion,
      deliveryChannel,
      deliveryRecipient: deliveryChannel === "email" ? (parsed.data.emailTo?.trim() || bundle.contact?.email || null) : null,
    });
    await addAuditEvent({
      action: "rechnung_finalisiert_pdf",
      projectId: parsed.data.projectId,
      actorRole: session.role,
      actorName: session.profile.displayName,
      payload: JSON.stringify({ invoiceId: invoice.id, pdfPath, version: nextPdfVersion, deliveryChannel }),
    });
    const latestQuoteForLines =
      bundle.quotes.length > 0 ? [...bundle.quotes].sort((a, b) => b.version - a.version)[0] : null;
    const invoiceLineItems = latestQuoteForLines ? await listQuoteItems(latestQuoteForLines.id) : [];
    const invoiceZapierTotals = latestQuoteForLines
      ? zapierTotalsFromQuoteOrLines(latestQuoteForLines, invoiceLineItems)
      : { totalNet: 0, totalGross: 0 };
    await dispatchZapierEvent({
      organizationId: session.organizationId,
      eventType: BAUFLIP_ZAPIER_EVENTS.INVOICE_CREATED,
      payload: {
        ...zapierContactPayload(bundle.contact),
        lineItems: invoiceLineItems,
        projectId: parsed.data.projectId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        version: nextPdfVersion,
        pdfPath,
        deliveryChannel,
        totalGross: latestQuoteForLines ? invoiceZapierTotals.totalGross : null,
        totalNet: latestQuoteForLines ? invoiceZapierTotals.totalNet : null,
        currency: "CHF",
      },
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
      finalizedBy: finalizedByFk,
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
    throw new Error(translateMissingFieldsInReason(decision.reason));
  }

  const prerequisiteMessages = getBundlePrerequisiteMessages(bundle.project, parsed.data.targetStatus, {
    besichtigungAppointments: bundle.appointments.filter((a) => a.kind === "besichtigung").length,
    ausfuehrungAppointments: bundle.appointments.filter((a) => a.kind === "ausfuehrung").length,
    reports: bundle.reports.length,
    directResolvedReports: bundle.reports.filter((r) => r.outcome === "direkt_geloest").length,
    quotes: bundle.quotes.length,
    quoteFinalized: bundle.quotes.filter((q) => Boolean(q.finalizedAt) || Boolean(q.deliverySentAt)).length,
    supplierSubmissions: (bundle.supplierSubmissions ?? []).length,
    orders: bundle.orders.length,
    deliveries: bundle.deliveries.length,
    invoices: bundle.invoices.length,
    invoiceFinalized: bundle.invoices.filter((inv) => Boolean(inv.finalizedAt) || Boolean(inv.deliverySentAt)).length,
  });
  if (prerequisiteMessages.length > 0) {
    throw new Error(prerequisiteMessages.join(" "));
  }

  await updateProjectStatus(parsed.data.projectId, parsed.data.targetStatus, decision.nextOwnerRole);
  await addAuditEvent({
    action: "status_gewechselt",
    projectId: parsed.data.projectId,
    actorRole: role,
    actorName: session?.profile.displayName ?? "System Benutzer",
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

export async function moveProjectPhaseAction(formData: FormData) {
  const payload = collectFormData(formData);
  const projectId = String(payload.projectId ?? "").trim();
  const targetPhaseIndex = Number(payload.targetPhaseIndex ?? NaN);
  if (!projectId || !Number.isFinite(targetPhaseIndex)) {
    throw new Error("Ungültige Kanban-Aktion.");
  }

  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }

  const bundle = await getProjectBundle(projectId);
  if (!bundle) {
    throw new Error("Projekt nicht gefunden.");
  }

  const current = bundle.project;
  if (getWorkflowPhaseIndex(current.status) === targetPhaseIndex) {
    return;
  }

  const targetStatuses = projectStatuses.filter((status) => getWorkflowPhaseIndex(status) === targetPhaseIndex);
  if (targetStatuses.length === 0) {
    throw new Error("Zielphase nicht gefunden.");
  }

  const path = findTransitionPath(current.status, targetStatuses);
  if (!path || path.length === 0) {
    throw new Error("Diese Verschiebung ist für den aktuellen Status nicht erlaubt.");
  }

  let currentState = { ...current };
  const prerequisiteBundle = {
    besichtigungAppointments: bundle.appointments.filter((a) => a.kind === "besichtigung").length,
    ausfuehrungAppointments: bundle.appointments.filter((a) => a.kind === "ausfuehrung").length,
    reports: bundle.reports.length,
    directResolvedReports: bundle.reports.filter((r) => r.outcome === "direkt_geloest").length,
    quotes: bundle.quotes.length,
    quoteFinalized: bundle.quotes.filter((q) => Boolean(q.finalizedAt) || Boolean(q.deliverySentAt)).length,
    supplierSubmissions: (bundle.supplierSubmissions ?? []).length,
    orders: bundle.orders.length,
    deliveries: bundle.deliveries.length,
    invoices: bundle.invoices.length,
    invoiceFinalized: bundle.invoices.filter((inv) => Boolean(inv.finalizedAt) || Boolean(inv.deliverySentAt)).length,
  };
  for (const step of path) {
    const decision = assertCanTransition(currentState, step.to, session.role);
    if (!decision.ok) {
      throw new Error(translateMissingFieldsInReason(decision.reason));
    }
    const prerequisiteMessages = getBundlePrerequisiteMessages(currentState, step.to, prerequisiteBundle);
    if (prerequisiteMessages.length > 0) {
      throw new Error(prerequisiteMessages.join(" "));
    }
    await updateProjectStatus(projectId, step.to, step.nextOwnerRole);
    currentState = { ...currentState, status: step.to, nextOwnerRole: step.nextOwnerRole };
  }

  await addAuditEvent({
    action: "status_gewechselt",
    projectId,
    actorRole: session.role,
    actorName: session.profile.displayName,
    payload: JSON.stringify({ from: current.status, to: currentState.status, reason: "kanban_drag_drop" }),
  });

  revalidatePath("/kanban");
  revalidatePath("/projekte");
  revalidatePath(`/projekte/${projectId}`);
}

function findTransitionPath(from: ProjectStatus, targets: ProjectStatus[]) {
  const queue: Array<{
    status: ProjectStatus;
    path: Array<{ to: ProjectStatus; nextOwnerRole: "admin" | "office" | "technician" }>;
  }> = [{ status: from, path: [] }];
  const visited = new Set<ProjectStatus>([from]);
  const targetSet = new Set<ProjectStatus>(targets);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    if (targetSet.has(current.status)) {
      return current.path;
    }
    for (const transition of getAllowedTransitions(current.status)) {
      const next = transition.to;
      if (visited.has(next)) {
        continue;
      }
      visited.add(next);
      queue.push({
        status: next,
        path: [...current.path, { to: transition.to, nextOwnerRole: transition.nextOwnerRole }],
      });
    }
  }
  return null;
}

function translateMissingFieldsInReason(reason: string): string {
  if (!reason.startsWith("Pflichtangaben fehlen:")) {
    return reason;
  }
  const fieldsRaw = reason.replace("Pflichtangaben fehlen:", "").trim();
  if (!fieldsRaw) {
    return reason;
  }
  const map: Record<ProjectRequiredField, string> = {
    intakeOriginalText: "Originalaussage Kunde",
    accessNotes: "Zugang/Schlüssel",
    internalNotes: "Interne Notiz",
  };
  const labels = fieldsRaw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => map[item as ProjectRequiredField] ?? item);
  return `Pflichtangaben fehlen: ${labels.join(", ")}`;
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

/** Lädt Bild/PDF in den Bucket project-files und verknüpft ihn als Projekt/Rapport-Anhang. */
export async function uploadProjectReportFileAction(formData: FormData) {
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
  const storagePath = `${session.organizationId}/${projectId}/reports/${Date.now()}-${safe}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from("project-files").upload(storagePath, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const profile = session.profile;
  await addProjectAttachment({
    projectId,
    filePath: storagePath,
    fileName: file.name,
    fileType: file.type,
    sizeBytes: file.size,
    uploadedBy: profile.id,
  });

  await addAuditEvent({
    action: "rapport_anhang_hochgeladen",
    projectId,
    actorRole: profile.role,
    actorName: profile.displayName,
    payload: JSON.stringify({ path: storagePath, fileName: file.name }),
  });

  revalidatePath(`/projekte/${projectId}`);
}

export async function assignAppointmentWithCalendarAction(formData: FormData) {
  const payload = collectFormData(formData);
  const parsed = appointmentSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültiger Termin.");
  }

  const session = await getCurrentSession();
  const technicians = await listProfilesByRole("technician");
  const selectedId = parsed.data.assignedTechnicianId?.trim() || null;
  const technician =
    (selectedId ? technicians.find((t) => t.id === selectedId) : null) ?? technicians[0] ?? null;
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
    actorRole: session?.role ?? "office",
    actorName: session?.profile.displayName ?? "System Benutzer",
    payload: JSON.stringify({
      kind: parsed.data.kind,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      assignedTechnicianId: technician?.id ?? null,
    }),
  });

  revalidatePath(`/projekte/${parsed.data.projectId}`);
  revalidatePath("/termine");
  revalidatePath("/");

  if (!technician) {
    return;
  }
  await assignAppointmentToTechnicianCalendar({
    appointmentId: appt.id,
    projectId: parsed.data.projectId,
    kind: parsed.data.kind,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    assignedTechnicianId: technician.id,
    actorRole: session?.role ?? "office",
    actorName: session?.profile.displayName ?? "System Benutzer",
  });
}

export async function importCsvAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  const role = session.role;
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

export async function submitSupplierTemplateAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Keine Berechtigung.");
  }

  const draftOnly = formData.get("draftOnly") === "1";

  // Technician may save drafts; office/admin may also send
  if (!draftOnly && session.role !== "office" && session.role !== "admin") {
    throw new Error("Nur Büro/Admin darf Bestellformulare absenden.");
  }

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

  // Validate required fields from fieldDefinitions
  const fieldDefs = template.fieldDefinitions ?? [];
  const requiredKeys = fieldDefs.length > 0
    ? getRequiredSupplierFieldKeys(fieldDefs, values)
    : template.requiredFields;
  const missingFields = requiredKeys.filter((field) => !values[field] || !values[field].trim());
  if (missingFields.length > 0) {
    const missingLabels = missingFields.map((key) => {
      const def = fieldDefs.find((f) => f.key === key);
      return def?.label ?? key;
    });
    throw new Error(`Pflichtfelder fehlen: ${missingLabels.join(", ")}`);
  }

  if (draftOnly) {
    // Save as draft — no email, no purchase order
    await addSupplierSubmission({
      projectId: parsed.data.projectId,
      templateId: parsed.data.templateId,
      valuesJson: parsed.data.valuesJson,
      status: "entwurf",
    });
    await addAuditEvent({
      action: "bestellformular_entwurf",
      projectId: parsed.data.projectId,
      actorRole: session.role,
      actorName: session.profile.displayName ?? "System",
      payload: parsed.data.valuesJson,
    });
    revalidatePath("/projekte");
    return;
  }

  // Full send mode (office/admin)
  const contacts = await listContacts();
  const supplierContact =
    contacts.find((c) => c.id === template.supplierId) ??
    contacts.find((c) => c.category === "lieferant" && c.name === template.supplierName) ??
    null;
  const supplierEmail = supplierContact?.email?.trim() ?? "";
  if (!supplierEmail) {
    throw new Error(`Für Lieferant "${template.supplierName}" ist keine E-Mail-Adresse hinterlegt.`);
  }

  const mailSubject = values.titel?.trim()
    ? `Bestellung: ${values.titel.trim()}`
    : `Bestellung: ${template.name}`;

  // Use human-readable field labels in email
  const mailRows = Object.entries(values)
    .filter(([, value]) => String(value ?? "").trim().length > 0)
    .map(([key, value]) => {
      const def = fieldDefs.find((f) => f.key === key);
      const label = def?.label ?? key;
      return `<li><strong>${label}:</strong> ${String(value)}</li>`;
    })
    .join("");
  const mailHtml = `
    <p>Guten Tag</p>
    <p>wir senden Ihnen eine Bestellung aus unserem Projektworkflow.</p>
    <ul>${mailRows}</ul>
    <p>Freundliche Grüsse<br/>${session.profile.displayName}</p>
  `;
  const mailResult = await sendMailViaSmtp({
    to: supplierEmail,
    subject: mailSubject,
    html: mailHtml,
  });
  await addMailDispatchLog({
    projectId: parsed.data.projectId,
    to: supplierEmail,
    subject: mailSubject,
    status: mailResult.ok ? "gesendet" : "fehler",
    errorMessage: mailResult.ok ? null : mailResult.error,
  });
  if (!mailResult.ok) {
    throw new Error(mailResult.error);
  }

  await addSupplierSubmission({
    projectId: parsed.data.projectId,
    templateId: parsed.data.templateId,
    valuesJson: parsed.data.valuesJson,
    status: "eingereicht",
  });
  const projectBundle = await getProjectBundle(parsed.data.projectId);
  const hasOrderForSupplier = projectBundle?.orders.some((o) => o.supplierId === template.supplierId) ?? false;
  if (!hasOrderForSupplier) {
    await addPurchaseOrder({
      projectId: parsed.data.projectId,
      supplierId: template.supplierId,
    });
    await addAuditEvent({
      action: "bestellung_erstellt",
      projectId: parsed.data.projectId,
      actorRole: session.role,
      actorName: session.profile.displayName ?? "System",
      payload: JSON.stringify({ supplierId: template.supplierId, source: "supplier_template_submission" }),
    });
  }
  await addAuditEvent({
    action: "bestellformular_eingereicht",
    projectId: parsed.data.projectId,
    actorRole: session.role,
    actorName: session.profile.displayName ?? "System",
    payload: parsed.data.valuesJson,
  });
  revalidatePath(`/projekte/${parsed.data.projectId}`);
  revalidatePath("/projekte");
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

export async function listReportOutcomeOptionsAction() {
  const session = await getCurrentSession();
  if (!session) throw new Error("Keine Berechtigung.");
  return listReportOutcomeOptions();
}

export async function addReportOutcomeOptionAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("Bezeichnung fehlt.");
  return insertReportOutcomeOption(label);
}

export async function deleteReportOutcomeOptionAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  const optionId = String(formData.get("optionId") ?? "").trim();
  if (!optionId) throw new Error("Option-ID fehlt.");
  await deleteReportOutcomeOption(optionId);
}

export async function addReportSelectOptionAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  const fieldKey = String(formData.get("fieldKey") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  if (!fieldKey) throw new Error("Feld-Schlüssel fehlt.");
  if (!label) throw new Error("Bezeichnung fehlt.");
  return insertReportSelectOption(fieldKey, label);
}

export async function deleteReportSelectOptionAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  const optionId = String(formData.get("optionId") ?? "").trim();
  if (!optionId) throw new Error("Option-ID fehlt.");
  await deleteReportSelectOption(optionId);
}
