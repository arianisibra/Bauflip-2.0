"use server";

import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/organization";
import { getCachedSessionProfile } from "@/lib/auth/session";
import { CamtParseError, parseCamtXml } from "@/lib/camt/parse";
import { matchCamtEntries, type CamtMatchResult } from "@/lib/camt/match";
import {
  listInvoicesForPaymentMatching,
  setInvoiceStatus,
  type InvoiceForPaymentMatching,
} from "@/lib/db/invoices";
import { createPaymentImportLog, listPaymentImportsForOrg } from "@/lib/db/payment-imports";
import type { PaymentImport } from "@/lib/domain/types";
import { publish } from "@/lib/realtime/publish";

const MAX_CAMT_FILE_BYTES = 10 * 1024 * 1024;

export type PaymentImportPreview = {
  filename: string;
  results: CamtMatchResult<InvoiceForPaymentMatching>[];
};

/** Datei parsen + gegen offene/bezahlte Rechnungen abgleichen — keine Schreiboperation. */
export async function previewPaymentImportAction(formData: FormData): Promise<PaymentImportPreview> {
  const session = await requireOfficeSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine camt-Datei (.xml) wählen.");
  }
  if (file.size > MAX_CAMT_FILE_BYTES) {
    throw new Error("Datei ist zu gross (max. 10 MB) — das ist keine gültige camt-Datei.");
  }

  const xml = await file.text();
  let entries;
  try {
    entries = parseCamtXml(xml);
  } catch (err) {
    if (err instanceof CamtParseError) {
      throw new Error(`Datei konnte nicht gelesen werden: ${err.message}`);
    }
    throw new Error("Datei konnte nicht gelesen werden — ist es eine camt.053/054-XML?");
  }
  if (entries.length === 0) {
    throw new Error("Keine Gutschriften in dieser Datei gefunden.");
  }

  const invoices = await listInvoicesForPaymentMatching(session.organizationId);
  const results = matchCamtEntries(entries, invoices);

  return { filename: file.name, results };
}

const confirmSchema = z.object({
  filename: z.string().trim().min(1),
  /** Nur die vom Büro bestätigten Zuordnungen — typischerweise alle "matched"-Einträge. */
  applications: z
    .array(
      z.object({
        invoiceId: z.string().uuid(),
        projectId: z.string().uuid(),
        /** Valuta-Datum aus der camt-Datei (YYYY-MM-DD) — wird zu paid_at. */
        valueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .max(500),
  summary: z.object({
    entriesTotal: z.number().int().min(0),
    entriesMatched: z.number().int().min(0),
    entriesAlreadyPaid: z.number().int().min(0),
    entriesAmountMismatch: z.number().int().min(0),
    entriesUnmatched: z.number().int().min(0),
  }),
});

export type ConfirmPaymentImportResult = {
  appliedCount: number;
  failedCount: number;
  import: PaymentImport;
};

/**
 * Bestätigte Zuordnungen anwenden: Rechnungen auf "bezahlt" (mit Valuta-Datum) +
 * Import-Protokoll. Ein einzelner fehlgeschlagener Statusübergang (z. B. Rechnung
 * wurde inzwischen storniert) blockiert nicht die übrigen — wird nur gezählt.
 */
export async function confirmPaymentImportAction(values: unknown): Promise<ConfirmPaymentImportResult> {
  const session = await requireOfficeSession();
  if (!session.organizationId) throw new Error("Keine Organisation.");

  const parsed = confirmSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  const { filename, applications, summary } = parsed.data;

  const profile = await getCachedSessionProfile(session);
  const changedProjectIds = new Set<string>();
  let appliedCount = 0;
  let failedCount = 0;

  // Nach Projekt gruppieren und die Gruppen parallel abarbeiten.
  //
  // Vorher lief die ganze Liste streng nacheinander, mit je drei Rundreisen zur
  // Datenbank pro Rechnung — bei einem camt-Auszug mit vielen Zahlungen summiert
  // sich das spürbar. Innerhalb einer Gruppe bleibt es bewusst sequenziell:
  // Mehrere Rechnungen desselben Projekts nacheinander abarbeiten verhindert,
  // dass zwei Schreibvorgänge auf derselben Projektzeile kollidieren.
  const nachProjekt = new Map<string, typeof applications>();
  for (const application of applications) {
    const liste = nachProjekt.get(application.projectId) ?? [];
    liste.push(application);
    nachProjekt.set(application.projectId, liste);
  }

  const gruppenErgebnisse = await Promise.all(
    [...nachProjekt.entries()].map(async ([projectId, gruppe]) => {
      let erfolg = 0;
      let fehler = 0;
      for (const application of gruppe) {
        try {
          await setInvoiceStatus(application.invoiceId, projectId, "paid", {
            paidAt: new Date(`${application.valueDate}T12:00:00Z`).toISOString(),
          });
          erfolg += 1;
        } catch {
          fehler += 1;
        }
      }
      return { projectId, erfolg, fehler };
    }),
  );

  for (const { projectId, erfolg, fehler } of gruppenErgebnisse) {
    if (erfolg > 0) changedProjectIds.add(projectId);
    appliedCount += erfolg;
    failedCount += fehler;
  }

  const paymentImport = await createPaymentImportLog(session.organizationId, {
    filename,
    importedByProfileId: profile.userId,
    importedByDisplayName: profile.displayName,
    entriesTotal: summary.entriesTotal,
    entriesMatched: summary.entriesMatched,
    entriesAlreadyPaid: summary.entriesAlreadyPaid,
    entriesAmountMismatch: summary.entriesAmountMismatch,
    entriesUnmatched: summary.entriesUnmatched,
  });

  // Auch hier parallel: Die Benachrichtigungen sind voneinander unabhängig.
  await Promise.all(
    [...changedProjectIds].map((projectId) =>
      publish(session.organizationId!, { type: "invoice.changed", projectId }),
    ),
  );

  return { appliedCount, failedCount, import: paymentImport };
}

export async function listPaymentImportsAction(): Promise<PaymentImport[]> {
  const session = await requireOfficeSession();
  if (!session.organizationId) return [];
  return listPaymentImportsForOrg(session.organizationId);
}
