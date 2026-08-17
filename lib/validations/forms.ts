import { z } from "zod";
import { isValidQrBillIban } from "@/lib/qr-bill/iban";
import {
  contactKinds,
  invoiceStatuses,
  projectStatuses,
  projectTypes,
  quoteStatuses,
  RAPPORT_ALL_NEXT_STEPS,
  technicianAbsenceKinds,
} from "@/lib/domain/types";
import { RAPPORT_NEXT_STEP_ICON_KEYS, STAGE_COLOR_KEYS } from "@/lib/domain/stage-visuals";

/**
 * Postmark-Inbound-Webhook-Payload (nur die Felder, die der E-Mail-Intake braucht).
 *
 * Die Längenbegrenzungen sind Absicht: Der Endpunkt nimmt Daten von aussen an,
 * und der gesamte Payload liegt beim Verarbeiten im Speicher des einen
 * Node-Prozesses. Ohne Obergrenze legt ein einziger grosser Anhang den Dienst
 * für alle Mandanten lahm — und erzeugt einen kostenpflichtigen KI-Aufruf.
 * Base64 bläht um Faktor ~1.37 auf: 14 MB Content ≈ 10 MB Originaldatei.
 */
export const postmarkInboundSchema = z.object({
  MessageID: z.string().max(200).optional(),
  From: z.string().max(320).optional(),
  FromName: z.string().max(200).optional(),
  Subject: z.string().max(500).optional(),
  TextBody: z.string().max(200_000).optional(),
  StrippedTextReply: z.string().max(200_000).optional(),
  OriginalRecipient: z.string().max(320).optional(),
  To: z.string().max(320).optional(),
  Attachments: z
    .array(
      z.object({
        Name: z.string().max(260).optional(),
        Content: z.string().max(14_000_000).optional(),
        ContentType: z.string().max(200).optional(),
      }),
    )
    .max(20)
    .optional(),
});

/** Selbstregistrierung einer neuen Organisation (öffentliche Anmeldeseite, kein Login nötig). */
export const registerOrganizationSchema = z.object({
  companyName: z.string().trim().min(1, "Bitte einen Firmennamen angeben.").max(120),
  displayName: z.string().trim().min(1, "Bitte Ihren Namen angeben.").max(80),
  email: z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse angeben."),
  password: z.string().min(10, "Bitte ein sicheres Passwort mit mindestens 10 Zeichen wählen."),
});

/** Von der KI aus einem Auftrags-PDF extrahierte Felder — alles optional, da nie garantiert erkennbar. */
export const intakePdfExtractionSchema = z.object({
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
  /** Kurze Zusammenfassung des Auftrags/Problems aus der PDF — Vorbefüllung für „Wichtige Informationen". */
  hintsAndNotes: z.string().optional(),
});
export type IntakePdfExtraction = z.infer<typeof intakePdfExtractionSchema>;

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
  /** Kundenunterschrift als PNG-Data-URL (Canvas), max. ~400 KB. */
  signatureDataUrl: z
    .string()
    .startsWith("data:image/png;base64,", "Ungültige Signatur.")
    .max(400_000, "Signatur zu gross.")
    .optional()
    .nullable(),
  signedByName: z.string().trim().max(200).optional().nullable(),
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
  projectManagerName: z.string().optional(),
  customerNumber: z.string().optional(),
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

export const quoteLineItemSchema = z.object({
  itemType: z.enum(["line", "header", "open"]).default("line"),
  description: z.string().trim().min(1, "Bitte Beschreibung angeben."),
  quantity: z.coerce.number().gt(0, "Menge muss grösser 0 sein."),
  unit: z.string().trim().max(20).optional().nullable(),
  unitPrice: z.coerce.number().min(0, "Preis darf nicht negativ sein."),
});

export const quoteCreateSchema = z.object({
  projectId: z.string().uuid(),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum.")
    .optional()
    .nullable(),
  introText: z.string().max(4000).optional().nullable(),
  outroText: z.string().max(4000).optional().nullable(),
  vatRate: z.coerce.number().min(0).max(100),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  lineItems: z.array(quoteLineItemSchema).min(1, "Mindestens eine Position erfassen."),
});

export const quoteUpdateSchema = quoteCreateSchema.extend({
  quoteId: z.string().uuid(),
});

/** Offerten-Status manuell setzen (Annahme/Ablehnung; Versand läuft über quoteSendSchema). */
export const quoteStatusSchema = z.object({
  quoteId: z.string().uuid(),
  projectId: z.string().uuid(),
  status: z.enum(quoteStatuses),
});

/**
 * Zahlungsdaten für QR-Rechnungen. IBAN leer = Feature deaktiviert; ist sie
 * gesetzt, verlangt die QR-Spec Gläubigername, PLZ und Ort (strukturierte Adresse).
 */
export const billingSettingsSchema = z
  .object({
    iban: z.string().trim().optional().nullable(),
    creditorName: z.string().trim().max(70).optional().nullable(),
    creditorStreet: z.string().trim().max(70).optional().nullable(),
    creditorBuildingNumber: z.string().trim().max(16).optional().nullable(),
    creditorPostalCode: z.string().trim().max(16).optional().nullable(),
    creditorCity: z.string().trim().max(35).optional().nullable(),
    vatNumber: z.string().trim().max(40).optional().nullable(),
    phone: z.string().trim().max(30).optional().nullable(),
    email: z.string().trim().max(120).optional().nullable(),
    website: z.string().trim().max(120).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (!v.iban) return;
    if (!isValidQrBillIban(v.iban)) {
      ctx.addIssue({
        code: "custom",
        path: ["iban"],
        message: "Ungültige IBAN — QR-Rechnungen erlauben nur CH-/LI-IBANs (21 Zeichen).",
      });
    }
    if (!v.creditorName) {
      ctx.addIssue({ code: "custom", path: ["creditorName"], message: "Gläubigername ist mit IBAN Pflicht." });
    }
    if (!v.creditorPostalCode) {
      ctx.addIssue({ code: "custom", path: ["creditorPostalCode"], message: "PLZ ist mit IBAN Pflicht." });
    }
    if (!v.creditorCity) {
      ctx.addIssue({ code: "custom", path: ["creditorCity"], message: "Ort ist mit IBAN Pflicht." });
    }
  });

/**
 * Editierbare Felder einer Workflow-Stage (Einstellungen → Workflow). Ohne `key`
 * — der bleibt fix (siehe Kommentar bei `WorkflowStageUpdateInput` in lib/db/workflow.ts).
 */
export const workflowStageUpdateSchema = z.object({
  label: z.string().trim().min(1, "Label darf nicht leer sein.").max(60),
  color: z.enum(STAGE_COLOR_KEYS),
  sortOrder: z.number().int().min(0).max(9999),
  isInitial: z.boolean(),
  isSchedulingTarget: z.boolean(),
  promotesOnAppointment: z.boolean(),
  isBilling: z.boolean(),
  isTerminal: z.boolean(),
  hiddenInOfficeFilter: z.boolean(),
  rapportAufgenommen: z.boolean(),
  rapportMontage: z.boolean(),
  rapportBehobenTarget: z.boolean(),
  rapportNextStepDescription: z.string().trim().max(160).nullable(),
  rapportNextStepIcon: z.enum(RAPPORT_NEXT_STEP_ICON_KEYS).nullable(),
});

/** Neue Workflow-Stage — zusätzlich zu den editierbaren Feldern der fixe `key`. */
export const workflowStageCreateSchema = workflowStageUpdateSchema.extend({
  key: z
    .string()
    .trim()
    .min(1, "Schlüssel darf nicht leer sein.")
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, "Nur Kleinbuchstaben, Ziffern, Unterstrich; beginnt mit einem Buchstaben."),
});

/** Ein Übergang (Pipeline-Knopf) — Einstellungen → Workflow. */
export const workflowTransitionInputSchema = z.object({
  fromKey: z.string().trim().min(1, "Von-Status wählen."),
  toKey: z.string().trim().min(1, "Ziel-Status wählen."),
  actionLabel: z.string().trim().min(1, "Beschriftung darf nicht leer sein.").max(40),
  sortOrder: z.number().int().min(0).max(9999),
});

export const priceBookItemSchema = z.object({
  name: z.string().trim().min(1, "Bitte Bezeichnung angeben.").max(300),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  articleNumber: z.string().trim().max(80).optional().nullable(),
  unit: z.string().trim().max(20).optional().nullable(),
  unitPrice: z.coerce.number().min(0, "Preis darf nicht negativ sein."),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const priceBookItemUpdateSchema = priceBookItemSchema.extend({
  id: z.string().uuid(),
});

export const textSnippetSchema = z.object({
  title: z.string().trim().min(1, "Bitte Titel angeben.").max(200),
  body: z.string().trim().min(1, "Bitte Text angeben.").max(4000),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const textSnippetUpdateSchema = textSnippetSchema.extend({
  id: z.string().uuid(),
});

export const contactSchema = z.object({
  kind: z.enum(contactKinds),
  displayName: z.string().trim().min(1, "Bitte einen Namen angeben.").max(200),
  companyName: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  mobile: z.string().trim().max(60).optional().nullable(),
  street: z.string().trim().max(200).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  kundenNummer: z.string().trim().max(60).optional().nullable(),
});
export const contactUpdateSchema = contactSchema.extend({
  id: z.string().uuid(),
});

export const invoiceCreateSchema = z.object({
  projectId: z.string().uuid(),
  /** Angenommene Offerte als Quelle — Positionen werden serverseitig kopiert. */
  fromQuoteId: z.string().uuid().optional().nullable(),
  invoiceKind: z.enum(["standard", "deposit", "final"]).default("standard"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum.")
    .optional()
    .nullable(),
  introText: z.string().max(4000).optional().nullable(),
  footerText: z.string().max(4000).optional().nullable(),
  vatRate: z.coerce.number().min(0).max(100),
  /** Bei fromQuoteId ignoriert (kommt dann aus der Offerte). */
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  skontoPercent: z.coerce.number().min(0).max(100).default(0),
  skontoDays: z.coerce.number().int().min(0).max(365).default(0),
  /** Bei fromQuoteId ignoriert (Positionen kommen aus der Offerte). */
  lineItems: z.array(quoteLineItemSchema),
});

export const invoiceUpdateSchema = z.object({
  invoiceId: z.string().uuid(),
  invoiceKind: z.enum(["standard", "deposit", "final"]).default("standard"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum.")
    .optional()
    .nullable(),
  introText: z.string().max(4000).optional().nullable(),
  footerText: z.string().max(4000).optional().nullable(),
  vatRate: z.coerce.number().min(0).max(100),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  skontoPercent: z.coerce.number().min(0).max(100).default(0),
  skontoDays: z.coerce.number().int().min(0).max(365).default(0),
  lineItems: z.array(quoteLineItemSchema).min(1, "Mindestens eine Position erfassen."),
});

export const invoiceStatusSchema = z.object({
  invoiceId: z.string().uuid(),
  projectId: z.string().uuid(),
  status: z.enum(invoiceStatuses),
});

/** Rechnung per E-Mail versenden (PDF mit Zahlteil im Anhang). */
export const invoiceSendSchema = z.object({
  invoiceId: z.string().uuid(),
  projectId: z.string().uuid(),
  recipientEmail: z.string().trim().email("Ungültige E-Mail-Adresse."),
  message: z.string().trim().max(2000).optional().nullable(),
});

/** Terminbestätigung per E-Mail an Mieter/Verwaltung. */
export const appointmentConfirmationSendSchema = z.object({
  appointmentId: z.string().uuid(),
  projectId: z.string().uuid(),
  recipientEmail: z.string().trim().email("Ungültige E-Mail-Adresse."),
});

/** Admin weist eine zur Freigabe eingereichte Offerte zurück — Büro sieht den Grund. */
export const quoteApprovalRejectSchema = z.object({
  quoteId: z.string().uuid(),
  projectId: z.string().uuid(),
  note: z.string().trim().max(2000).optional().nullable(),
});

/** Offerte per E-Mail versenden (PDF im Anhang). */
export const quoteSendSchema = z.object({
  quoteId: z.string().uuid(),
  projectId: z.string().uuid(),
  recipientEmail: z.string().trim().email("Ungültige E-Mail-Adresse."),
  /** Optionaler persönlicher Text über dem Standard-Mailtext. */
  message: z.string().trim().max(2000).optional().nullable(),
});
