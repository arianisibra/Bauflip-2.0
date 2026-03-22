import { z } from "zod";
import { noteTypes, projectStatuses, projectTypes } from "@/lib/domain/types";

export const intakeSchema = z.object({
  title: z.string().min(4, "Bitte geben Sie einen klaren Projekttitel ein."),
  source: z.enum(["whatsapp", "telefon", "email"], {
    message: "Bitte wählen Sie eine Eingangsquelle.",
  }),
  type: z.enum(projectTypes, {
    message: "Bitte wählen Sie den Projekttyp.",
  }),
  urgency: z.enum(["normal", "hoch", "kritisch"], {
    message: "Bitte wählen Sie die Dringlichkeit.",
  }),
  intakeOriginalText: z
    .string()
    .min(10, "Die Originalaussage des Kunden ist Pflicht."),
  accessNotes: z.string().min(3, "Bitte Zutrittshinweise ergänzen."),
  keyHandlingNotes: z.string().min(3, "Bitte Schlüsselhinweise ergänzen."),
  timingNotes: z.string().min(3, "Bitte Zeitfenster ergänzen."),
  internalNotes: z.string().optional(),
  customerName: z.string().min(2, "Bitte Kundennamen erfassen."),
  customerEmail: z.email("Bitte eine gültige E-Mail angeben.").or(z.literal("")),
  customerPhone: z.string().min(6, "Bitte Telefonnummer erfassen."),
  customerStreet: z.string().optional(),
  customerPostalCode: z.string().optional(),
  customerCity: z.string().optional(),
});

export const noteSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(noteTypes),
  body: z.string().min(3, "Notiztext ist zu kurz."),
});

export const appointmentSchema = z.object({
  projectId: z.string().min(1),
  kind: z.enum(["besichtigung", "ausfuehrung"]),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  planningNotes: z.string().optional(),
  accessNotes: z.string().optional(),
  keyHandlingNotes: z.string().optional(),
});

export const reportSchema = z.object({
  projectId: z.string().min(1),
  outcome: z.enum(["direkt_geloest", "ersatzteil_noetig", "werkstatt_noetig", "vollersatz_noetig"]),
  summary: z.string().min(10, "Bitte eine klare Diagnose erfassen."),
  measurementsJson: z.string().min(2, "Messdaten fehlen."),
  workDescription: z.string().min(5, "Bitte Massnahme beschreiben."),
  timeSpentMinutes: z.coerce.number().min(0).optional(),
});

export const quoteSchema = z.object({
  projectId: z.string().min(1),
  version: z.coerce.number().min(1),
});

export const orderSchema = z.object({
  projectId: z.string().min(1),
  supplierId: z.string().min(1, "Bitte Lieferant wählen."),
});

export const deliverySchema = z.object({
  projectId: z.string().min(1),
  purchaseOrderId: z.string().optional(),
  deliveryNoteNumber: z.string().optional(),
});

export const invoiceSchema = z.object({
  projectId: z.string().min(1),
  invoiceNumber: z.string().optional(),
});

export const transitionSchema = z.object({
  projectId: z.string().min(1),
  targetStatus: z.enum(projectStatuses),
});

export const moduleLabelSchema = z.object({
  key: z.string().min(2),
  label: z.string().min(2, "Bezeichnung ist zu kurz."),
});

export const kanbanColumnRenameSchema = z.object({
  columnId: z.string().min(1),
  title: z.string().min(2, "Spaltenname ist zu kurz."),
});

export const kanbanMoveCardSchema = z.object({
  cardId: z.string().min(1),
  columnId: z.string().min(1),
});

export const chatMessageSchema = z.object({
  projectId: z.string().min(1),
  appointmentId: z.string().optional(),
  body: z.string().min(1, "Nachricht darf nicht leer sein."),
});

export const chatAttachmentSchema = z.object({
  projectId: z.string().min(1),
  messageId: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  filePath: z.string().min(1),
});

export const csvImportSchema = z.object({
  type: z.enum(["customers", "articles"]),
  csvText: z.string().min(1, "CSV-Inhalt fehlt."),
});

export const stockDecisionSchema = z.object({
  projectId: z.string().min(1),
  decision: z.enum(["ab_lager", "bestellen"]),
  notes: z.string().min(2, "Bitte Begründung ergänzen."),
});

export const supplierTemplateSubmissionSchema = z.object({
  projectId: z.string().min(1),
  templateId: z.string().min(1),
  valuesJson: z.string().min(2),
});

export const smtpSendSchema = z.object({
  projectId: z.string().optional(),
  to: z.email("Bitte gültige E-Mail angeben."),
  subject: z.string().min(3),
  html: z.string().min(3),
  includeIcs: z.string().optional(),
  icsTitle: z.string().optional(),
  icsDescription: z.string().optional(),
  icsStartsAt: z.string().optional(),
  icsEndsAt: z.string().optional(),
});

export const swissQrSchema = z.object({
  iban: z.string().min(5),
  creditorName: z.string().min(2),
  creditorStreet: z.string().min(2),
  creditorPostalCode: z.string().min(2),
  creditorCity: z.string().min(2),
  amount: z.string().min(1),
  currency: z.enum(["CHF", "EUR"]),
  debtorName: z.string().min(2),
  debtorStreet: z.string().min(2),
  debtorPostalCode: z.string().min(2),
  debtorCity: z.string().min(2),
  reference: z.string().min(2),
  message: z.string().min(1),
});
