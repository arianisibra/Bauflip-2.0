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
