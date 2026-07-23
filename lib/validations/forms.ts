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

export const appointmentSchema = z
  .object({
    projectId: z.string().min(1),
    kind: z.enum(["besichtigung", "ausfuehrung"]),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    assignedTechnicianId: z
      .string()
      .trim()
      .min(1, "Bitte eine zuständige Person wählen."),
    /** Optionaler zweiter Monteur am selben Termin. */
    assignedTechnicianId2: z.string().trim().nullish(),
    planningNotes: z.string().nullish(),
  })
  .refine(
    (v) => !v.assignedTechnicianId2 || v.assignedTechnicianId2 !== v.assignedTechnicianId,
    { message: "Monteur 2 muss sich von Monteur 1 unterscheiden.", path: ["assignedTechnicianId2"] },
  );

/** Zuständige Person an einem Termin-Slot ändern (Zeitfenster bleibt). Slot 2 darf geleert werden. */
export const reassignAppointmentTechnicianSchema = z
  .object({
    appointmentId: z.string().min(1),
    projectId: z.string().min(1),
    slot: z.union([z.literal(1), z.literal(2)]).default(1),
    assignedTechnicianId: z.string().trim().nullable(),
  })
  .refine((v) => v.slot === 2 || Boolean(v.assignedTechnicianId?.length), {
    message: "Bitte eine zuständige Person wählen.",
    path: ["assignedTechnicianId"],
  });

/** Zeitfenster eines bestehenden Termins ändern (Umplanen ohne Löschen+Neuanlegen). */
export const updateAppointmentTimeSchema = z
  .object({
    appointmentId: z.string().min(1),
    projectId: z.string().min(1),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
  })
  .refine(
    (v) => {
      const s = Date.parse(v.startsAt);
      const e = Date.parse(v.endsAt);
      return Number.isFinite(s) && Number.isFinite(e) && e > s;
    },
    { message: "Endzeit muss nach Beginn liegen.", path: ["endsAt"] },
  );

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
  /** Gesamtarbeitszeit am Rapport (Minuten); `null` = keine Angabe. */
  timeSpentMinutes: z.number().int().min(0).max(20000).nullable().optional(),
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

/** Neue Bestellzeile an einem Projekt (Lieferant frei, kein Stamm vorhanden). */
export const projectOrderCreateSchema = z.object({
  projectId: z.string().uuid(),
  supplierName: z.string().trim().min(1, "Bitte Lieferant angeben."),
  description: z.string().trim().min(1, "Bitte angeben, was bestellt wurde."),
  orderedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum."),
  expectedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum.")
    .optional()
    .nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const timeEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum."),
  startsAt: z.string().regex(HHMM_REGEX, "Ungültige Uhrzeit.").nullish(),
  endsAt: z.string().regex(HHMM_REGEX, "Ungültige Uhrzeit.").nullish(),
  hours: z.coerce.number().gt(0, "Bitte Stunden angeben.").lte(24, "Maximal 24 Stunden pro Eintrag."),
  note: z.string().optional().nullable(),
});

export const timeEntryUpdateSchema = timeEntrySchema.extend({
  id: z.string().uuid(),
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

export const garantiefallSchema = z.object({
  projectId: z.string().uuid(),
  note: z.string().trim().min(1, "Bitte Grund angeben.").max(2000),
});
