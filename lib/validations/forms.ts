import { z } from "zod";
import {
  projectStatuses,
  projectTypes,
  RAPPORT_ALL_NEXT_STEPS,
  technicianAbsenceKinds,
} from "@/lib/domain/types";

export const intakeSchema = z.object({
  title: z.string(),
  source: z.enum(["whatsapp", "telefon", "email"]),
  type: z.enum(projectTypes),
  intakeOriginalText: z.string(),
  tenantName: z.string(),
  tenantPhone: z.string().optional(),
  tenantEmail: z.string().email().optional().or(z.literal("")),
  managementName: z.string().optional(),
  managementPhone: z.string().optional(),
  managementEmail: z.string().optional(),
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
  assignedTechnicianId: z.string().nullish(),
  planningNotes: z.string().nullish(),
});

export const technicianReportSchema = z.object({
  projectId: z.string().min(1),
  outcome: z.enum(["schaden_behoben", "schaden_aufgenommen"]),
  /** Nächster Workflow-Schritt (pflicht bei outcome=schaden_aufgenommen, App-seitig erzwungen) */
  nextStatus: z.enum(RAPPORT_ALL_NEXT_STEPS).optional(),
  summary: z.string().optional(),
  measurementsJson: z.string().optional(),
  workDescription: z.string().optional(),
  orderForms: z
    .array(
      z.object({
        templateId: z.string().uuid(),
        values: z.record(z.string(), z.string()),
      }),
    )
    .optional(),
});

/** Nachträgliche Rapport-Korrektur (Büro) — ändert keinen Projekt-Status. */
export const technicianReportUpdateSchema = z.object({
  reportId: z.string().uuid(),
  projectId: z.string().uuid(),
  outcome: z.enum(["schaden_behoben", "schaden_aufgenommen"]),
  summary: z.string().optional(),
  measurementsJson: z.string().optional(),
  workDescription: z.string().optional(),
  orderForms: z
    .array(
      z.object({
        templateId: z.string().uuid(),
        values: z.record(z.string(), z.string()),
      }),
    )
    .optional(),
});

export const technicianAbsenceCreateSchema = z
  .object({
    technicianId: z.string().uuid(),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    kind: z.enum(technicianAbsenceKinds),
    note: z.string().optional().nullable(),
  })
  .refine(
    (v) => {
      const s = Date.parse(v.startsAt);
      const e = Date.parse(v.endsAt);
      return Number.isFinite(s) && Number.isFinite(e) && e > s;
    },
    { message: "Endzeit muss nach Beginn liegen." },
  );

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
