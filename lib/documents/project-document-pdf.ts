import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type {
  Delivery,
  Invoice,
  Project,
  Quote,
  SupplierOrderSubmission,
  SupplierOrderTemplate,
  TechnicianReport,
} from "@/lib/domain/types";

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

export async function appendSupplierOrderPages(
  basePdf: Uint8Array,
  submissions: SupplierOrderSubmission[],
  templates: SupplierOrderTemplate[],
  bundle: BundleForDocument,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(basePdf);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const templateById = new Map(templates.map((t) => [t.id, t]));

  const sorted = [...submissions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const sub of sorted) {
    const tmpl = templateById.get(sub.templateId) ?? null;
    let page = doc.addPage([595, 842]);
    let y = 800;
    const left = 48;
    const minY = 56;

    const ensureSpace = (needed: number) => {
      if (y - needed < minY) {
        page = doc.addPage([595, 842]);
        y = 800;
      }
    };

    const drawLine = (text: string, size = 11, bold = false, color = rgb(0.17, 0.2, 0.24)) => {
      for (const wrapped of wrapText(text, 80)) {
        ensureSpace(size + 10);
        page.drawText(wrapped, {
          x: left,
          y,
          size,
          font: bold ? fontBold : fontRegular,
          color,
        });
        y -= size + 5;
      }
    };

    page.drawText("Bauflip Feldrapport", {
      x: left,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.07, 0.42, 0.75),
    });
    y -= 22;

    drawLine(`${tmpl?.supplierName ?? "Lieferant"} — ${tmpl?.name ?? "Bestellformular"}`, 14, true);
    drawLine(`Status: ${sub.status} · erfasst ${formatDate(sub.createdAt)}`, 10);
    y -= 8;

    let values: Record<string, string> = {};
    try {
      const parsed = JSON.parse(sub.valuesJson ?? "{}") as Record<string, unknown>;
      values = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v ?? "").trim()]));
    } catch {
      values = {};
    }

    const entries = Object.entries(values).filter(([, v]) => v.length > 0);
    if (entries.length === 0) {
      drawLine("(Keine Felder ausgefüllt)", 10, false, rgb(0.45, 0.45, 0.45));
    } else {
      for (const [key, value] of entries) {
        const def = tmpl?.fieldDefinitions?.find((f) => f.key === key);
        const label = def?.label ?? key;
        drawLine(`${label}: ${value}`, 11);
      }
    }

    y -= 8;
    ensureSpace(28);
    drawLine(`Projekt: ${bundle.project.title}`, 9, false, rgb(0.4, 0.45, 0.5));
    drawLine(`Projekt-ID: ${bundle.project.id}`, 9, false, rgb(0.4, 0.45, 0.5));
  }

  return doc.save();
}

/** Einzelnes Monteur-Bestellformular als PDF (Deckblatt + Felder), z. B. für Admin/Büro-Download. */
export async function generateSupplierSubmissionPdf(
  bundle: BundleForDocument,
  submission: SupplierOrderSubmission,
  template: SupplierOrderTemplate,
) {
  const baseBytes = await generateProjectPdf({
    title: "Lieferanten-Bestellformular",
    documentLabel: "Bauflip Projektdokument",
    documentNumber: `BF-${submission.id.slice(0, 8)}`,
    status: submission.status,
    createdAt: submission.createdAt,
    detailLines: [
      `${template.supplierName} — ${template.name}`,
      "Ausführliche Angaben folgen auf der nächsten Seite.",
    ],
    bundle,
  });
  return appendSupplierOrderPages(baseBytes, [submission], [template], bundle);
}

function outcomeLabel(outcome: TechnicianReport["outcome"]) {
  switch (outcome) {
    case "direkt_geloest":
      return "Direkt geloest";
    case "ersatzteil_noetig":
      return "Ersatzteil noetig";
    case "werkstatt_noetig":
      return "Werkstatt noetig";
    case "vollersatz_noetig":
      return "Vollersatz noetig";
    default:
      return outcome;
  }
}

export async function generateTechnicianReportPdf(
  bundle: BundleForDocument,
  report: TechnicianReport,
  options?: {
    supplierSubmissions?: SupplierOrderSubmission[];
    supplierTemplates?: SupplierOrderTemplate[];
  },
) {
  const measurements = (() => {
    try {
      return JSON.parse(report.measurementsJson) as Record<string, unknown>;
    } catch {
      return {};
    }
  })();

  const compactMeasurements = Object.entries(measurements)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .filter(([k]) => !k.startsWith("xxx"))
    .slice(0, 8)
    .map(([k, v]) => `${k}: ${String(v)}`);

  const subs = (options?.supplierSubmissions ?? []).filter((s) => s.projectId === bundle.project.id);
  const tmpls = options?.supplierTemplates ?? [];

  const baseBytes = await generateProjectPdf({
    title: "Monteur-Rapport",
    documentLabel: "Bauflip Feldrapport",
    documentNumber: `R-${report.id.slice(0, 8)}`,
    status: outcomeLabel(report.outcome),
    createdAt: report.createdAt,
    detailLines: [
      `Zusammenfassung: ${report.summary || "—"}`,
      `Massnahme: ${report.workDescription || "—"}`,
      `Arbeitszeit: ${report.timeSpentMinutes != null ? `${report.timeSpentMinutes} Minuten` : "—"}`,
      ...(compactMeasurements.length > 0 ? ["Messwerte:", ...compactMeasurements] : []),
      subs.length > 0
        ? `Bestellformular: ${subs.length} Erfassung(en), siehe folgende Seiten.`
        : `Bestellformular: keine Lieferantenbestellung zu diesem Projekt erfasst.`,
    ],
    bundle,
  });

  if (subs.length === 0) {
    return baseBytes;
  }
  return appendSupplierOrderPages(baseBytes, subs, tmpls, bundle);
}
