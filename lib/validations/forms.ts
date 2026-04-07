import { z } from "zod";
import { projectStatuses, projectTypes } from "@/lib/domain/types";

export const intakeSchema = z.object({
  title: z.string().min(2, "Titel fehlt."),
  source: z.enum(["whatsapp", "telefon", "email"]),
  type: z.enum(projectTypes),
  intakeOriginalText: z.string().min(1, "Problembeschreibung fehlt."),
  tenantName: z.string().min(1, "Mieter / Kontakt fehlt."),
  tenantPhone: z.string().optional(),
  tenantEmail: z.string().email().optional().or(z.literal("")),
  managementName: z.string().optional(),
  managementPhone: z.string().optional(),
  managementEmail: z.string().email().optional().or(z.literal("")),
  costCeilingText: z.string().optional(),
  serviceStreet: z.string().optional(),
  servicePostalCode: z.string().optional(),
  serviceCity: z.string().optional(),
  hintsAndNotes: z.string().optional(),
});

export const appointmentSchema = z.object({
  projectId: z.string().min(1),
  kind: z.enum(["besichtigung", "ausfuehrung"]),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  assignedTechnicianId: z.string().optional(),
  planningNotes: z.string().optional(),
});

export const technicianReportSchema = z.object({
  projectId: z.string().min(1),
  outcome: z.enum(["schaden_behoben", "schaden_aufgenommen"]),
  summary: z.string().optional(),
  measurementsJson: z.string().optional(),
  workDescription: z.string().optional(),
});

export const profileSettingsSchema = z.object({
  displayName: z.string().min(2, "Name zu kurz."),
  calendarPosition: z.coerce.number().int().min(0).max(999),
});

export const projectStammdatenUpdateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(2).optional(),
  status: z.enum(projectStatuses).optional(),
  intakeOriginalText: z.string().optional(),
  tenantName: z.string().optional(),
  tenantPhone: z.string().optional(),
  tenantEmail: z.string().optional(),
  managementName: z.string().optional(),
  managementPhone: z.string().optional(),
  managementEmail: z.string().optional(),
  costCeilingText: z.string().optional(),
  serviceStreet: z.string().optional(),
  servicePostalCode: z.string().optional(),
  serviceCity: z.string().optional(),
  serviceCountry: z.string().optional(),
  hintsAndNotes: z.string().optional(),
  accessNotes: z.string().optional(),
  nextOwnerUserId: z.union([z.string().uuid(), z.literal("")]).optional(),
});
