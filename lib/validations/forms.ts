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
  contactName: z.string().min(2, "Bitte Kontaktnamen erfassen."),
  contactEmail: z.email("Bitte eine gültige E-Mail angeben.").or(z.literal("")),
  contactPhone: z.string().min(6, "Bitte Telefonnummer erfassen."),
  contactStreet: z.string().optional(),
  contactPostalCode: z.string().optional(),
  contactCity: z.string().optional(),
  /** Wenn gesetzt: bestehenden Kontakt verwenden, keinen neuen anlegen */
  contactId: z
    .union([z.literal(""), z.string().uuid()])
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
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
  assignedTechnicianId: z.string().optional(),
  planningNotes: z.string().optional(),
  accessNotes: z.string().optional(),
  keyHandlingNotes: z.string().optional(),
});

export const reportSchema = z.object({
  projectId: z.string().min(1),
  outcome: z.enum(["direkt_geloest", "ersatzteil_noetig", "werkstatt_noetig", "vollersatz_noetig"]),
  summary: z.string().trim().min(10, "Bitte eine klare Diagnose erfassen (mindestens 10 Zeichen)."),
  measurementsJson: z.string().trim().min(2, "Messdaten fehlen."),
  workDescription: z.string().trim().min(5, "Bitte Massnahme beschreiben."),
  serviceSelections: z.string().optional(),
  articleSelections: z.string().optional(),
  timeSpentMinutes: z.coerce.number().min(0).optional(),
});

export const quoteSchema = z.object({
  projectId: z.string().min(1),
  version: z.coerce.number().min(1),
  warrantyText: z.string().optional(),
  validityDays: z.coerce.number().int().min(1).max(365).optional(),
  leadTimeText: z.string().optional(),
  downPaymentPercent: z.coerce.number().min(0).max(100).optional(),
  paymentTermsText: z.string().optional(),
  salutationText: z.string().optional(),
  textBlocks: z.string().optional(),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  vatPercent: z.coerce.number().min(0).max(100).optional(),
  quoteItemsJson: z.string().optional(),
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

export const finalizeDocumentSchema = z.object({
  projectId: z.string().min(1),
  documentType: z.enum(["quote", "invoice", "delivery"]),
  documentId: z.string().min(1),
  deliveryChannel: z.enum(["email", "post"]).optional(),
  emailTo: z.string().optional(),
  emailCc: z.string().optional(),
  emailBcc: z.string().optional(),
  emailSubject: z.string().optional(),
  emailHtml: z.string().optional(),
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
  type: z.enum(["contacts", "articles"]),
  csvText: z.string().min(1, "CSV-Inhalt fehlt."),
});

export const articleSaveSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name ist Pflicht."),
  sku: z.string().min(1, "Artikelnummer ist Pflicht."),
  categoryId: z.string().min(1, "Kategorie wählen."),
  supplierId: z.string().optional(),
  purchasePrice: z.string().optional(),
  salePrice: z.string().optional(),
  unit: z.string().min(1, "Einheit ist Pflicht."),
  descriptionLong: z.string().optional(),
  descriptionShort: z.string().optional(),
  inStock: z.number().int().min(0),
});

export const articleCategoryCreateSchema = z.object({
  name: z.string().min(1, "Kategoriename ist Pflicht."),
  templateScope: z.enum(["storen", "sonnenstoren", "dl", "generic"]),
});

export const profileSettingsSchema = z.object({
  displayName: z.string().min(1, "Anzeigename ist Pflicht."),
  calendarPosition: z.coerce.number().int().min(0).max(9999),
  billingIban: z.string().optional(),
  billingCreditorName: z.string().optional(),
  billingCreditorStreet: z.string().optional(),
  billingCreditorPostalCode: z.string().optional(),
  billingCreditorCity: z.string().optional(),
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

const supplierTemplateFieldSchema = z.object({
  key: z.string().optional().default(""),
  label: z.string().trim().min(1, "Feld-Label ist Pflicht."),
  type: z.enum(["text", "number", "select", "article"]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1)).optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  showWhen: z.array(z.object({
    fieldKey: z.string().trim().min(1),
    operator: z.enum(["equals", "not_equals"]),
    value: z.string().trim().min(1),
  })).optional(),
  requireWhen: z.array(z.object({
    fieldKey: z.string().trim().min(1),
    operator: z.enum(["equals", "not_equals"]),
    value: z.string().trim().min(1),
  })).optional(),
});

export const supplierTemplateSaveSchema = z.object({
  id: z.string().optional(),
  supplierId: z.string().optional().default(""),
  supplierName: z.string().trim().min(1, "Lieferantenname ist Pflicht."),
  name: z.string().trim().min(1, "Formularname ist Pflicht."),
  fieldDefinitions: z.array(supplierTemplateFieldSchema).min(1, "Mindestens ein Feld ist erforderlich."),
}).superRefine((data, ctx) => {
  const seen = new Set<string>();
  const allKeys = new Set<string>();
  for (const field of data.fieldDefinitions) {
    const key = (field.key ?? "").trim().toLowerCase();
    if (key) {
      allKeys.add(key);
    }
  }
  for (const field of data.fieldDefinitions) {
    if (field.type === "select" && (!field.options || field.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Dropdown-Feld "${field.label}" braucht mindestens eine Option.`,
      });
    }
    const key = (field.key ?? "").trim().toLowerCase();
    if (!key) {
      continue;
    }
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Feld-Schlüssel doppelt: ${field.key}`,
      });
      continue;
    }
    seen.add(key);

    for (const condition of [...(field.showWhen ?? []), ...(field.requireWhen ?? [])]) {
      const ref = condition.fieldKey.trim().toLowerCase();
      if (!allKeys.has(ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Bedingung verweist auf unbekanntes Feld: ${condition.fieldKey}`,
        });
      }
    }
  }
});

export const supplierTemplateDeleteSchema = z.object({
  templateId: z.string().min(1),
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
  amount: z.string().min(1),
  currency: z.enum(["CHF", "EUR"]),
  debtorName: z.string().min(2),
  debtorStreet: z.string().min(2),
  debtorPostalCode: z.string().min(2),
  debtorCity: z.string().min(2),
  debtorCountry: z.string().min(2).max(2).optional(),
  reference: z.string().min(2),
  message: z.string().min(1),
});

const contactPersonDraftSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.union([z.literal(""), z.string().email()]),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  roleTitle: z.string().optional(),
});

const contactAddressDraftSchema = z.object({
  label: z.string().optional(),
  street: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().min(2).optional(),
  isPrimary: z.boolean().optional(),
});

export const projectStammdatenUpdateSchema = z.object({
  projectId: z.string().min(1),
  contactId: z.string().min(1),
  title: z.string().min(2, "Titel ist zu kurz."),
  tenantUnit: z.string().optional(),
  sitePhone: z.string().optional(),
  siteMobile: z.string().optional(),
  referenceCode: z.string().optional(),
  technicianNotes: z.string().optional(),
  propertyId: z.string().optional(),
  mapsUrl: z.union([z.literal(""), z.string().url()]).optional(),
  workTypeId: z.string().optional(),
  contactPersonId: z.string().optional(),
  serviceAddressId: z.string().optional(),
  billingAddressId: z.string().optional(),
  hintsAndNotes: z.string().optional(),
  nextOwnerUserId: z.string().optional(),
  newWorkTypeName: z.string().optional(),
  intakeOriginalText: z.string().optional(),
  accessNotes: z.string().optional(),
  keyHandlingNotes: z.string().optional(),
  timingNotes: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const contactCreateSchema = z.object({
  partyKind: z.enum(["privat", "firma"]),
  category: z.enum(["kunde", "lieferant", "partner", "sonstiges"]),
  contactNumber: z.string().optional(),
  name: z.string().min(2, "Name ist Pflicht."),
  uidNumber: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email().or(z.literal("")),
  website: z.union([z.literal(""), z.string().url()]).optional(),
  street: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  managedObjectLabel: z.string().optional(),
  persons: z.array(contactPersonDraftSchema).optional(),
  addresses: z.array(contactAddressDraftSchema).optional(),
});

const contactPersonDraftWithIdSchema = contactPersonDraftSchema.extend({
  id: z.string().optional(),
});

const contactAddressDraftWithIdSchema = contactAddressDraftSchema.extend({
  id: z.string().optional(),
});

/** Bearbeiten inkl. Ansprechpartner & Zusatzadressen (id optional = neu). */
export const contactUpdateSchema = contactCreateSchema.extend({
  id: z.string().min(1, "Kontakt-ID fehlt."),
  persons: z.array(contactPersonDraftWithIdSchema).optional(),
  addresses: z.array(contactAddressDraftWithIdSchema).optional(),
});
