import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { Invoice, OrganizationBillingSettings } from "@/lib/domain/types";
import { invoiceKindLabels } from "@/lib/domain/types";
import type { OrganizationBranding } from "@/lib/domain/types";
import type { QuotePdfProjectHead } from "@/lib/db/quotes";
import { formatChf, letterheadLines } from "@/lib/pdf/quote-pdf";
import { roundRappen } from "@/lib/quotes/totals";
import { formatIban } from "@/lib/qr-bill/iban";
import { buildQrBillPayload, splitStreetAndNumber, type QrBillAddress } from "@/lib/qr-bill/payload";
import { formatPaymentReference } from "@/lib/qr-bill/reference";

// A4 in PDF-Punkten; Zahlteil-Masse in mm gemäss Style Guide.
const MM = 72 / 25.4;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const FONT_SIZE = 10;
const LINE_HEIGHT = 14;
const GRAY = rgb(0.45, 0.45, 0.45);
const BLACK = rgb(0.1, 0.1, 0.12);
const RULE = rgb(0.8, 0.8, 0.82);

const PAYMENT_PART_HEIGHT = 105 * MM;
const RECEIPT_WIDTH = 62 * MM;
const QR_SIZE = 46 * MM;

const COLS = {
  pos: { x: MARGIN, w: 24 },
  description: { x: MARGIN + 28, w: 235 },
  quantity: { x: MARGIN + 271, w: 46 },
  unit: { x: MARGIN + 321, w: 40 },
  unitPrice: { x: MARGIN + 365, w: 60 },
} as const;

function sanitizeWinAnsi(text: string): string {
  return text.replace(/[^\x00-\xffŒœŠšŽž‘’“”–—…]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of sanitizeWinAnsi(text).split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function formatDateCh(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
}

/** Betragsanzeige im Zahlteil: Leerzeichen als Tausendertrennzeichen (Spec). */
function formatAmountForPaymentPart(value: number): string {
  const [int, frac] = value.toFixed(2).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${frac}`;
}

export type InvoicePdfInput = {
  invoice: Invoice;
  project: QuotePdfProjectHead;
  branding: OrganizationBranding;
  billing: OrganizationBillingSettings;
  logo: { bytes: Uint8Array; mimeType: string } | null;
};

/** Gläubiger-Adresse aus den Org-Zahlungsdaten (Name/PLZ/Ort sind validiert Pflicht). */
function creditorFromBilling(billing: OrganizationBillingSettings): QrBillAddress {
  return {
    name: billing.creditorName ?? "",
    street: billing.creditorStreet,
    buildingNumber: billing.creditorBuildingNumber,
    postalCode: billing.creditorPostalCode ?? "",
    city: billing.creditorCity ?? "",
    country: "CH",
  };
}

/** Debitor aus Projekt-Kopf — null, wenn Name oder PLZ/Ort fehlen (Feld bleibt leer). */
function debtorFromProject(project: QuotePdfProjectHead): QrBillAddress | null {
  const name = project.tenantName ?? project.managementName;
  if (!name || !project.servicePostalCode || !project.serviceCity) return null;
  const { street, buildingNumber } = splitStreetAndNumber(project.serviceStreet);
  return {
    name,
    street,
    buildingNumber,
    postalCode: project.servicePostalCode,
    city: project.serviceCity,
    country: "CH",
  };
}

function addressDisplayLines(address: QrBillAddress): string[] {
  const streetLine = [address.street, address.buildingNumber].filter(Boolean).join(" ");
  return [address.name, streetLine, `${address.postalCode} ${address.city}`].filter(Boolean);
}

type PaymentPartFonts = { regular: PDFFont; bold: PDFFont };

/** Zeichnet Empfangsschein + Zahlteil in den untersten 105 mm der Seite. */
async function drawPaymentPart(
  doc: PDFDocument,
  page: PDFPage,
  fonts: PaymentPartFonts,
  input: InvoicePdfInput,
): Promise<void> {
  const { invoice, project, billing } = input;
  const creditor = creditorFromBilling(billing);
  const debtor = debtorFromProject(project);
  const amountDue = roundRappen(invoice.totalGross - invoice.deductedAmount);

  const payload = buildQrBillPayload({
    iban: billing.iban ?? "",
    creditor,
    amount: amountDue,
    currency: "CHF",
    debtor,
    referenceType: invoice.referenceType,
    reference: invoice.paymentReference,
    unstructuredMessage: invoice.invoiceNumber ? `Rechnung ${invoice.invoiceNumber}` : "Rechnung",
  });

  // QR-Code als PNG einbetten (Fehlerkorrektur M, ohne Quiet-Zone — Rand liefert das Layout).
  const qrPngBytes = await QRCode.toBuffer(payload, {
    errorCorrectionLevel: "M",
    type: "png",
    margin: 0,
    width: 640,
  });
  const qrImage: PDFImage = await doc.embedPng(qrPngBytes);

  const partTop = PAYMENT_PART_HEIGHT;
  const white = rgb(1, 1, 1);

  // Hintergrund weiss + Trennlinien.
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: partTop, color: white });
  page.drawLine({
    start: { x: 0, y: partTop },
    end: { x: PAGE_WIDTH, y: partTop },
    thickness: 0.5,
    color: BLACK,
  });
  page.drawLine({
    start: { x: RECEIPT_WIDTH, y: 0 },
    end: { x: RECEIPT_WIDTH, y: partTop },
    thickness: 0.5,
    color: BLACK,
  });
  const hint = "Vor der Einzahlung abzutrennen";
  page.drawText(hint, {
    x: PAGE_WIDTH / 2 - fonts.regular.widthOfTextAtSize(hint, 7) / 2,
    y: partTop + 2,
    size: 7,
    font: fonts.regular,
    color: BLACK,
  });

  const drawBlock = (
    x: number,
    yStart: number,
    labelSize: number,
    valueSize: number,
    blocks: { label: string; values: string[] }[],
  ): number => {
    let y = yStart;
    for (const block of blocks) {
      page.drawText(sanitizeWinAnsi(block.label), {
        x, y, size: labelSize, font: fonts.bold, color: BLACK,
      });
      y -= labelSize + 3;
      for (const value of block.values) {
        page.drawText(sanitizeWinAnsi(value), {
          x, y, size: valueSize, font: fonts.regular, color: BLACK,
        });
        y -= valueSize + 2;
      }
      y -= 6;
    }
    return y;
  };

  const ibanDisplay = formatIban(billing.iban ?? "");
  const referenceDisplay =
    invoice.referenceType !== "NON" && invoice.paymentReference
      ? formatPaymentReference(invoice.referenceType, invoice.paymentReference)
      : null;
  const amountDisplay = formatAmountForPaymentPart(amountDue);

  // ── Empfangsschein (links, 62 mm) ──────────────────────────────────────────
  const rx = 5 * MM;
  page.drawText("Empfangsschein", { x: rx, y: partTop - 10 * MM + 14, size: 11, font: fonts.bold, color: BLACK });

  const receiptBlocks: { label: string; values: string[] }[] = [
    { label: "Konto / Zahlbar an", values: [ibanDisplay, ...addressDisplayLines(creditor)] },
  ];
  if (referenceDisplay) receiptBlocks.push({ label: "Referenz", values: [referenceDisplay] });
  receiptBlocks.push(
    debtor
      ? { label: "Zahlbar durch", values: addressDisplayLines(debtor) }
      : { label: "Zahlbar durch (Name/Adresse)", values: [] },
  );
  drawBlock(rx, partTop - 14 * MM, 6, 8, receiptBlocks);

  // Betrag (Empfangsschein, unten)
  page.drawText("Währung", { x: rx, y: 16 * MM, size: 6, font: fonts.bold, color: BLACK });
  page.drawText("Betrag", { x: rx + 14 * MM, y: 16 * MM, size: 6, font: fonts.bold, color: BLACK });
  page.drawText("CHF", { x: rx, y: 12 * MM, size: 8, font: fonts.regular, color: BLACK });
  page.drawText(amountDisplay, { x: rx + 14 * MM, y: 12 * MM, size: 8, font: fonts.regular, color: BLACK });

  const annahme = "Annahmestelle";
  page.drawText(annahme, {
    x: RECEIPT_WIDTH - 5 * MM - fonts.bold.widthOfTextAtSize(annahme, 6),
    y: 7 * MM,
    size: 6,
    font: fonts.bold,
    color: BLACK,
  });

  // ── Zahlteil (rechts, 148 mm) ─────────────────────────────────────────────
  const px = RECEIPT_WIDTH + 5 * MM;
  page.drawText("Zahlteil", { x: px, y: partTop - 10 * MM + 14, size: 11, font: fonts.bold, color: BLACK });

  // QR-Code 46×46 mm mit Schweizerkreuz-Overlay.
  const qrX = px;
  const qrY = partTop - 17 * MM - QR_SIZE;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: QR_SIZE, height: QR_SIZE });

  const crossCenterX = qrX + QR_SIZE / 2;
  const crossCenterY = qrY + QR_SIZE / 2;
  const whiteBox = 8 * MM;
  const blackBox = 7 * MM;
  const armLength = 4.7 * MM;
  const armWidth = 1.4 * MM;
  page.drawRectangle({
    x: crossCenterX - whiteBox / 2, y: crossCenterY - whiteBox / 2,
    width: whiteBox, height: whiteBox, color: white,
  });
  page.drawRectangle({
    x: crossCenterX - blackBox / 2, y: crossCenterY - blackBox / 2,
    width: blackBox, height: blackBox, color: BLACK,
  });
  page.drawRectangle({
    x: crossCenterX - armWidth / 2, y: crossCenterY - armLength / 2,
    width: armWidth, height: armLength, color: white,
  });
  page.drawRectangle({
    x: crossCenterX - armLength / 2, y: crossCenterY - armWidth / 2,
    width: armLength, height: armWidth, color: white,
  });

  // Betrag (Zahlteil, unter dem QR)
  page.drawText("Währung", { x: px, y: 16 * MM, size: 8, font: fonts.bold, color: BLACK });
  page.drawText("Betrag", { x: px + 18 * MM, y: 16 * MM, size: 8, font: fonts.bold, color: BLACK });
  page.drawText("CHF", { x: px, y: 11 * MM, size: 10, font: fonts.regular, color: BLACK });
  page.drawText(amountDisplay, { x: px + 18 * MM, y: 11 * MM, size: 10, font: fonts.regular, color: BLACK });

  // Rechte Spalte (Angaben)
  const infoX = px + QR_SIZE + 5 * MM;
  const infoBlocks: { label: string; values: string[] }[] = [
    { label: "Konto / Zahlbar an", values: [ibanDisplay, ...addressDisplayLines(creditor)] },
  ];
  if (referenceDisplay) infoBlocks.push({ label: "Referenz", values: [referenceDisplay] });
  if (invoice.invoiceNumber) {
    infoBlocks.push({ label: "Zusätzliche Informationen", values: [`Rechnung ${invoice.invoiceNumber}`] });
  }
  infoBlocks.push(
    debtor
      ? { label: "Zahlbar durch", values: addressDisplayLines(debtor) }
      : { label: "Zahlbar durch (Name/Adresse)", values: [] },
  );
  drawBlock(infoX, partTop - 14 * MM, 8, 10, infoBlocks);
}

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const { invoice, project, branding, billing, logo } = input;

  if (!billing.iban) {
    throw new Error("Keine IBAN hinterlegt — Zahlungsdaten in den Einstellungen erfassen.");
  }

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const documentLabel = invoiceKindLabels[invoice.invoiceKind];
  const title = invoice.invoiceNumber ? `${documentLabel} ${invoice.invoiceNumber}` : documentLabel;
  doc.setTitle(title);
  doc.setAuthor(branding.name);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPageIfNeeded = (needed: number, floor = MARGIN) => {
    if (y - needed < floor) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawText = (
    text: string,
    x: number,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; rightAlignEnd?: number } = {},
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? FONT_SIZE;
    const t = sanitizeWinAnsi(text);
    const drawX = opts.rightAlignEnd != null ? opts.rightAlignEnd - f.widthOfTextAtSize(t, size) : x;
    page.drawText(t, { x: drawX, y, size, font: f, color: opts.color ?? BLACK });
  };

  // ── Kopf: Logo/Firmenname rechts oben ─────────────────────────────────────
  const headerTop = y;
  let headerBottom = headerTop;
  if (logo) {
    try {
      const image = logo.mimeType.includes("png")
        ? await doc.embedPng(logo.bytes)
        : await doc.embedJpg(logo.bytes);
      const scale = Math.min(140 / image.width, 48 / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, { x: PAGE_WIDTH - MARGIN - w, y: headerTop - h, width: w, height: h });
      headerBottom = headerTop - h;
    } catch {
      // Logo nicht einbettbar → nur Name
    }
  }
  y = headerBottom - (logo ? LINE_HEIGHT : 0);
  const { name: senderName, lines: senderLines } = letterheadLines(billing, branding.name);
  drawText(senderName, 0, { font: bold, size: 11, rightAlignEnd: PAGE_WIDTH - MARGIN });
  for (const line of senderLines) {
    y -= 12;
    drawText(line, 0, { size: 8, color: GRAY, rightAlignEnd: PAGE_WIDTH - MARGIN });
  }
  y -= LINE_HEIGHT;
  const rightBottom = y;

  // ── Adressblock (Debitor) ─────────────────────────────────────────────────
  y = headerTop - 40;
  const addressLines = [
    project.tenantName ?? project.managementName ?? "",
    project.serviceStreet ?? "",
    [project.servicePostalCode, project.serviceCity].filter(Boolean).join(" "),
  ].filter((l) => l.trim());
  for (const line of addressLines) {
    drawText(line, MARGIN);
    y -= LINE_HEIGHT;
  }

  // ── Titel + Meta (unterhalb des höheren der beiden Kopf-Blöcke) ────────────
  y = Math.min(y, rightBottom) - 30;
  drawText(title, MARGIN, { font: bold, size: 16 });
  y -= 22;

  const metaPairs: [string, string][] = [
    ["Datum", formatDateCh(invoice.createdAt)],
    ...(invoice.dueDate ? ([["Fällig am", formatDateCh(invoice.dueDate)]] as [string, string][]) : []),
    ...(invoice.skontoPercent > 0
      ? ([["Skonto", `${invoice.skontoPercent}% bei Zahlung innert ${invoice.skontoDays} Tagen`]] as [
          string,
          string,
        ][])
      : []),
    ...(project.referenceCode ? ([["Projekt-Nr.", project.referenceCode]] as [string, string][]) : []),
    ["Projekt", project.title],
    ...(project.customerNumber ? ([["Kunden-Nr.", project.customerNumber]] as [string, string][]) : []),
    ...(project.projectManagerName ? ([["Projektleiter", project.projectManagerName]] as [string, string][]) : []),
  ];
  for (const [label, value] of metaPairs) {
    drawText(label, MARGIN, { color: GRAY });
    drawText(value, MARGIN + 70);
    y -= LINE_HEIGHT;
  }

  // ── Einleitungstext ───────────────────────────────────────────────────────
  if (invoice.introText) {
    y -= 10;
    for (const line of wrapText(invoice.introText, font, FONT_SIZE, CONTENT_WIDTH)) {
      newPageIfNeeded(LINE_HEIGHT);
      if (line) drawText(line, MARGIN);
      y -= LINE_HEIGHT;
    }
  }

  // ── Positionstabelle ──────────────────────────────────────────────────────
  y -= 16;
  newPageIfNeeded(3 * LINE_HEIGHT);
  const drawTableHeader = () => {
    drawText("Pos.", COLS.pos.x, { font: bold, size: 9, color: GRAY });
    drawText("Beschreibung", COLS.description.x, { font: bold, size: 9, color: GRAY });
    drawText("Menge", 0, { font: bold, size: 9, color: GRAY, rightAlignEnd: COLS.quantity.x + COLS.quantity.w });
    drawText("Einheit", COLS.unit.x, { font: bold, size: 9, color: GRAY });
    drawText("Preis", 0, { font: bold, size: 9, color: GRAY, rightAlignEnd: COLS.unitPrice.x + COLS.unitPrice.w });
    drawText("Total", 0, { font: bold, size: 9, color: GRAY, rightAlignEnd: PAGE_WIDTH - MARGIN });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.7,
      color: RULE,
    });
    y -= LINE_HEIGHT;
  };
  drawTableHeader();

  let displayPos = 0;
  for (const item of invoice.lineItems) {
    if (item.itemType === "header") {
      const headerLines = wrapText(item.description, bold, FONT_SIZE, CONTENT_WIDTH);
      const headerHeight = Math.max(headerLines.length, 1) * LINE_HEIGHT + 10;
      if (y - headerHeight < MARGIN) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
        drawTableHeader();
      }
      y -= 6;
      for (const line of headerLines) {
        drawText(line, COLS.pos.x, { font: bold });
        y -= LINE_HEIGHT;
      }
      y -= 4;
      continue;
    }
    const descLines = wrapText(item.description, font, FONT_SIZE, COLS.description.w);
    const rowHeight = Math.max(descLines.length, 1) * LINE_HEIGHT + 4;
    if (y - rowHeight < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      drawTableHeader();
    }
    displayPos += 1;
    drawText(String(displayPos), COLS.pos.x, { color: GRAY });
    if (item.itemType === "open") {
      if (item.unit) drawText(item.unit, COLS.unit.x);
      drawText("nach Aufwand", 0, { color: GRAY, rightAlignEnd: PAGE_WIDTH - MARGIN });
    } else {
      drawText(String(item.quantity), 0, { rightAlignEnd: COLS.quantity.x + COLS.quantity.w });
      if (item.unit) drawText(item.unit, COLS.unit.x);
      drawText(formatChf(item.unitPrice), 0, { rightAlignEnd: COLS.unitPrice.x + COLS.unitPrice.w });
      drawText(formatChf(item.lineTotal), 0, { rightAlignEnd: PAGE_WIDTH - MARGIN });
    }
    for (const line of descLines) {
      drawText(line, COLS.description.x);
      y -= LINE_HEIGHT;
    }
    y -= 4;
  }

  // ── Summen ────────────────────────────────────────────────────────────────
  const amountDue = roundRappen(invoice.totalGross - invoice.deductedAmount);
  const hasDeduction = invoice.invoiceKind === "final" && invoice.deductedAmount > 0;
  newPageIfNeeded((hasDeduction ? 8 : 6) * LINE_HEIGHT + 12);
  page.drawLine({
    start: { x: COLS.unitPrice.x, y: y + LINE_HEIGHT - 6 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + LINE_HEIGHT - 6 },
    thickness: 0.7,
    color: RULE,
  });
  const subtotal = roundRappen(invoice.lineItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const discountAmount = roundRappen(subtotal - invoice.totalNet);
  const totals: [string, string, PDFFont][] = [
    ...(discountAmount > 0
      ? ([
          ["Zwischentotal CHF", formatChf(subtotal), font],
          [`Rabatt ${invoice.discountPercent}%`, `-${formatChf(discountAmount)}`, font],
        ] as [string, string, PDFFont][])
      : []),
    ["Netto CHF", formatChf(invoice.totalNet), font],
    [`MwSt. ${invoice.vatRate}%`, formatChf(invoice.totalGross - invoice.totalNet), font],
    ["Total CHF", formatChf(invoice.totalGross), hasDeduction ? font : bold],
    ...(hasDeduction
      ? ([
          ["Bereits akontiert", `-${formatChf(invoice.deductedAmount)}`, font],
          ["Zu bezahlen CHF", formatChf(amountDue), bold],
        ] as [string, string, PDFFont][])
      : []),
  ];
  for (const [label, value, f] of totals) {
    drawText(label, COLS.unitPrice.x - 40, { font: f });
    drawText(value, 0, { font: f, rightAlignEnd: PAGE_WIDTH - MARGIN });
    y -= LINE_HEIGHT;
  }

  // ── Zahlteil: unten auf der letzten Seite; neue Seite, wenn zu wenig Platz ─
  if (y < PAYMENT_PART_HEIGHT + 10 * MM) {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }
  await drawPaymentPart(doc, page, { regular: font, bold }, input);

  return doc.save();
}
