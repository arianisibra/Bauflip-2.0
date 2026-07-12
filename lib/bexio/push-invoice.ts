import "server-only";

import {
  BexioApiError,
  createBexioInvoice,
  getDefaultBexioUnitId,
  getDefaultBexioUserId,
} from "@/lib/bexio/client";
import { resolveBexioContactId } from "@/lib/bexio/contacts";
import { getBexioToken } from "@/lib/bexio/secrets";
import { getBexioSettings } from "@/lib/db/bexio";
import { getProjectForBexio, updateInvoiceBexioSync } from "@/lib/db/invoices";
import type { Invoice } from "@/lib/domain/types";

/**
 * Fertige Rechnung als Beleg zu Bexio übertragen (Modell A — Bauflip bleibt Rechnungssteller).
 * Idempotent: bereits übertragene Rechnungen (bexioInvoiceId gesetzt) werden übersprungen.
 * Wirft bei jedem Fehler (nicht verbunden, kein Mapping, API-Fehler) — Aufrufer entscheiden,
 * ob das den Rechnungsversand blockiert (Antwort: nie, siehe sendInvoiceAction).
 */
export async function pushInvoiceToBexio(organizationId: string, invoice: Invoice): Promise<number> {
  if (invoice.bexioInvoiceId) return invoice.bexioInvoiceId;

  try {
    const token = await getBexioToken(organizationId);
    if (!token) throw new Error("Bexio ist nicht verbunden.");

    const settings = await getBexioSettings(organizationId);
    if (!settings?.taxId || !settings.accountId) {
      throw new Error("Bexio-Mapping (Steuersatz/Ertragskonto) fehlt — in Einstellungen setzen.");
    }

    const project = await getProjectForBexio(invoice.projectId);
    if (!project) throw new Error("Projekt nicht gefunden.");

    const [contactId, userId, unitId] = await Promise.all([
      resolveBexioContactId(token, {
        id: project.id,
        bexioContactId: project.bexioContactId,
        name: project.title,
        email: invoice.sentToEmail,
      }),
      getDefaultBexioUserId(token),
      getDefaultBexioUnitId(token),
    ]);

    const created = await createBexioInvoice(token, {
      title: invoice.invoiceNumber ?? project.title,
      contact_id: contactId,
      user_id: userId,
      mwst_type: 0,
      mwst_is_net: true,
      show_position_taxes: true,
      is_valid_from: `${(invoice.sentAt ?? new Date().toISOString()).slice(0, 10)} 00:00:00`,
      is_valid_to: invoice.dueDate ? `${invoice.dueDate} 00:00:00` : null,
      reference: invoice.invoiceNumber ?? "",
      api_reference: invoice.id,
      positions: invoice.lineItems.map((item) => ({
        amount: String(item.quantity),
        unit_id: unitId,
        account_id: settings.accountId as number,
        tax_id: settings.taxId as number,
        text: item.description,
        unit_price: item.unitPrice.toFixed(2),
        discount_in_percent: "0",
      })),
    });

    await updateInvoiceBexioSync(invoice.id, {
      bexioInvoiceId: created.id,
      bexioSyncedAt: new Date().toISOString(),
    });
    return created.id;
  } catch (err) {
    const message = err instanceof BexioApiError ? err.message : err instanceof Error ? err.message : "Unbekannter Fehler.";
    await updateInvoiceBexioSync(invoice.id, { bexioSyncError: message }).catch(() => {});
    throw new Error(message);
  }
}
