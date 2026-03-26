import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Delivery, Invoice, Project, Quote } from "@/lib/domain/types";

type BundleForDocument = {
  project: Project;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
};

function formatDate(v: string | null | undefined) {
  if (!v) {
    return "—";
  }
  try {
    return new Date(v).toLocaleDateString("de-CH");
  } catch {
    return v;
  }
}

function wrapText(text: string, maxLen = 92) {
  if (text.length <= maxLen) {
    return [text];
  }
  const words = text.split(" ");
  const out: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length > maxLen) {
      if (current) {
        out.push(current);
      }
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) {
    out.push(current);
  }
  return out;
}

async function generateProjectPdf(params: {
  title: string;
  documentLabel: string;
  documentNumber: string;
  status: string;
  createdAt: string;
  detailLines: string[];
  bundle: BundleForDocument;
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const left = 48;

  const draw = (text: string, size = 11, bold = false, color = rgb(0.17, 0.2, 0.24)) => {
    page.drawText(text, {
      x: left,
      y,
      size,
      font: bold ? fontBold : fontRegular,
      color,
    });
    y -= size + 6;
  };

  draw(params.documentLabel, 11, true, rgb(0.07, 0.42, 0.75));
  draw(params.title, 20, true);
  y -= 2;
  draw(`Projekttitel: ${params.bundle.project.title}`, 11);
  draw(`Kunde: ${params.bundle.contactName}`, 11);
  draw(`E-Mail: ${params.bundle.contactEmail ?? "—"}   Telefon: ${params.bundle.contactPhone ?? "—"}`, 10);
  y -= 10;

  draw(`Dokument-Nr.: ${params.documentNumber}`, 11, true);
  draw(`Status: ${params.status}`, 11);
  draw(`Erstellt am: ${formatDate(params.createdAt)}`, 11);
  y -= 12;

  draw("Inhalt", 12, true);
  for (const line of params.detailLines) {
    for (const wrapped of wrapText(line)) {
      draw(`- ${wrapped}`, 11);
    }
  }

  y -= 10;
  draw("Automatisch aus den aktuellen Projektdaten generiert.", 9, false, rgb(0.4, 0.45, 0.5));
  draw(`Projekt-ID: ${params.bundle.project.id}`, 9, false, rgb(0.4, 0.45, 0.5));

  return doc.save();
}

export async function generateQuotePdf(bundle: BundleForDocument, quote: Quote) {
  return generateProjectPdf({
    title: "Offerte",
    documentLabel: "Bauflip Projektdokument",
    documentNumber: `Q-${quote.version}`,
    status: quote.status,
    createdAt: quote.createdAt,
    detailLines: [
      `Offerte Version ${quote.version}.`,
      `Referenzcode: ${bundle.project.referenceCode ?? "—"}.`,
      `Arbeitsart: ${bundle.project.workTypeId ?? "—"}.`,
      "Dieses PDF wurde beim Finalisieren erstellt.",
    ],
    bundle,
  });
}

export async function generateInvoicePdf(bundle: BundleForDocument, invoice: Invoice) {
  return generateProjectPdf({
    title: "Rechnung",
    documentLabel: "Bauflip Projektdokument",
    documentNumber: invoice.invoiceNumber ?? `INV-${invoice.id.slice(0, 8)}`,
    status: invoice.status,
    createdAt: invoice.createdAt,
    detailLines: [
      `Rechnung ${invoice.invoiceNumber ?? "(ohne Nummer)"}.`,
      `Projektstatus: ${bundle.project.status}.`,
      `Hinweise: ${bundle.project.hintsAndNotes ?? "—"}.`,
      "Dieses PDF wurde beim Finalisieren erstellt.",
    ],
    bundle,
  });
}

export async function generateDeliveryPdf(bundle: BundleForDocument, delivery: Delivery) {
  return generateProjectPdf({
    title: "Lieferschein",
    documentLabel: "Bauflip Projektdokument",
    documentNumber: delivery.deliveryNoteNumber ?? `DN-${delivery.id.slice(0, 8)}`,
    status: delivery.finalizedAt ? "finalisiert" : "entwurf",
    createdAt: delivery.createdAt,
    detailLines: [
      `Lieferscheinnummer: ${delivery.deliveryNoteNumber ?? "—"}.`,
      `Wareneingang am: ${formatDate(delivery.arrivedAt)}.`,
      `Zu Bestellung: ${delivery.purchaseOrderId ?? "—"}.`,
      "Dieses PDF wurde beim Finalisieren erstellt.",
    ],
    bundle,
  });
}
