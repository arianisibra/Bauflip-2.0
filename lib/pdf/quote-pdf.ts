import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Quote } from "@/lib/domain/types";
import type { OrganizationBranding, OrganizationBillingSettings } from "@/lib/domain/types";
import type { QuotePdfProjectHead } from "@/lib/db/quotes";
import { roundRappen } from "@/lib/quotes/totals";

// A4 in PDF-Punkten
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const FONT_SIZE = 10;
const LINE_HEIGHT = 14;
const GRAY = rgb(0.45, 0.45, 0.45);
const BLACK = rgb(0.1, 0.1, 0.12);
const RULE = rgb(0.8, 0.8, 0.82);

/** Spalten der Positionstabelle: [x-Start, Breite]; Beträge rechtsbündig. */
const COLS = {
  pos: { x: MARGIN, w: 24 },
  description: { x: MARGIN + 28, w: 235 },
  quantity: { x: MARGIN + 271, w: 46 },
  unit: { x: MARGIN + 321, w: 40 },
  unitPrice: { x: MARGIN + 365, w: 60 },
  lineTotal: { x: MARGIN + 429, w: CONTENT_WIDTH - 429 + MARGIN - 0 },
} as const;

/** CHF im Schweizer Format mit einfachem Apostroph (WinAnsi-sicher). */
export function formatChf(value: number): string {
  const [int, frac] = value.toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${grouped}.${frac}`;
}

function formatDateCh(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
}

/** Ersetzt Zeichen ausserhalb von WinAnsi (Standard-Fonts können kein Unicode). */
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

/**
 * Briefkopf-Zeilen aus den Zahlungsdaten (organizations.billing_*): Name (Fallback
 * `branding.name`) + Adresse/Telefon/E-Mail/Website/MwSt-Nr., wo gesetzt. Gemeinsam
 * genutzt von Offerten- und Rechnungs-PDF, damit beide denselben Briefkopf zeigen.
 */
export function letterheadLines(
  billing: OrganizationBillingSettings,
  fallbackName: string,
): { name: string; lines: string[] } {
  const name = billing.creditorName?.trim() || fallbackName;
  const streetLine = [billing.creditorStreet, billing.creditorBuildingNumber].filter(Boolean).join(" ");
  const cityLine = [billing.creditorPostalCode, billing.creditorCity].filter(Boolean).join(" ");
  const lines = [streetLine, cityLine, billing.phone, billing.email, billing.website, billing.vatNumber].filter(
    (l): l is string => Boolean(l && l.trim()),
  );
  return { name, lines };
}

export type QuotePdfInput = {
  quote: Quote;
  project: QuotePdfProjectHead;
  branding: OrganizationBranding;
  billing: OrganizationBillingSettings;
  /** Logo-Bytes (PNG/JPG), bereits geladen — null wenn keins vorhanden/ladbar. */
  logo: { bytes: Uint8Array; mimeType: string } | null;
};

type Cursor = { page: PDFPage; y: number };

export async function buildQuotePdf(input: QuotePdfInput): Promise<Uint8Array> {
  const { quote, project, branding, billing, logo } = input;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const title = quote.quoteNumber ? `Offerte ${quote.quoteNumber}` : "Offerte";
  doc.setTitle(title);
  doc.setAuthor(branding.name);

  const cursor: Cursor = { page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]), y: PAGE_HEIGHT - MARGIN };

  const newPageIfNeeded = (needed: number) => {
    if (cursor.y - needed < MARGIN) {
      cursor.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursor.y = PAGE_HEIGHT - MARGIN;
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
    cursor.page.drawText(t, { x: drawX, y: cursor.y, size, font: f, color: opts.color ?? BLACK });
  };

  const drawParagraph = (text: string, x: number, maxWidth: number, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const size = opts.size ?? FONT_SIZE;
    for (const line of wrapText(text, opts.font ?? font, size, maxWidth)) {
      newPageIfNeeded(LINE_HEIGHT);
      if (line) drawText(line, x, opts);
      cursor.y -= LINE_HEIGHT;
    }
  };

  // ── Kopf: Logo/Firmenname rechts oben ─────────────────────────────────────
  const headerTop = cursor.y;
  let headerBottom = headerTop;
  if (logo) {
    try {
      const image = logo.mimeType.includes("png")
        ? await doc.embedPng(logo.bytes)
        : await doc.embedJpg(logo.bytes);
      const maxW = 140;
      const maxH = 48;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      cursor.page.drawImage(image, { x: PAGE_WIDTH - MARGIN - w, y: headerTop - h, width: w, height: h });
      headerBottom = headerTop - h;
    } catch {
      // Logo nicht einbettbar → nur Name
    }
  }
  cursor.y = headerBottom - (logo ? LINE_HEIGHT : 0);
  const { name: senderName, lines: senderLines } = letterheadLines(billing, branding.name);
  drawText(senderName, 0, { font: bold, size: 11, rightAlignEnd: PAGE_WIDTH - MARGIN });
  for (const line of senderLines) {
    cursor.y -= 12;
    drawText(line, 0, { size: 8, color: GRAY, rightAlignEnd: PAGE_WIDTH - MARGIN });
  }
  const rightBottom = cursor.y;

  // ── Adressblock links (auf Höhe des Kopfs) ────────────────────────────────
  cursor.y = headerTop - 40;
  const addressLines = [
    project.tenantName ?? project.managementName ?? "",
    project.serviceStreet ?? "",
    [project.servicePostalCode, project.serviceCity].filter(Boolean).join(" "),
  ].filter((l) => l.trim());
  for (const line of addressLines) {
    drawText(line, MARGIN);
    cursor.y -= LINE_HEIGHT;
  }

  // ── Titel + Metadaten (unterhalb des höheren der beiden Kopf-Blöcke) ──────
  cursor.y = Math.min(cursor.y, rightBottom) - 30;
  drawText(title, MARGIN, { font: bold, size: 16 });
  cursor.y -= 22;

  const metaPairs: [string, string][] = [
    ["Datum", formatDateCh(quote.createdAt)],
    ...(quote.validUntil ? ([["Gültig bis", formatDateCh(quote.validUntil)]] as [string, string][]) : []),
    ...(project.referenceCode ? ([["Projekt-Nr.", project.referenceCode]] as [string, string][]) : []),
    ["Projekt", project.title],
  ];
  for (const [label, value] of metaPairs) {
    drawText(label, MARGIN, { color: GRAY });
    drawText(value, MARGIN + 70);
    cursor.y -= LINE_HEIGHT;
  }

  // ── Einleitungstext ───────────────────────────────────────────────────────
  if (quote.introText) {
    cursor.y -= 10;
    drawParagraph(quote.introText, MARGIN, CONTENT_WIDTH);
  }

  // ── Positionstabelle ──────────────────────────────────────────────────────
  cursor.y -= 16;
  newPageIfNeeded(3 * LINE_HEIGHT);
  const drawTableHeader = () => {
    drawText("Pos.", COLS.pos.x, { font: bold, size: 9, color: GRAY });
    drawText("Beschreibung", COLS.description.x, { font: bold, size: 9, color: GRAY });
    drawText("Menge", 0, { font: bold, size: 9, color: GRAY, rightAlignEnd: COLS.quantity.x + COLS.quantity.w });
    drawText("Einheit", COLS.unit.x, { font: bold, size: 9, color: GRAY });
    drawText("Preis", 0, { font: bold, size: 9, color: GRAY, rightAlignEnd: COLS.unitPrice.x + COLS.unitPrice.w });
    drawText("Total", 0, { font: bold, size: 9, color: GRAY, rightAlignEnd: PAGE_WIDTH - MARGIN });
    cursor.y -= 6;
    cursor.page.drawLine({
      start: { x: MARGIN, y: cursor.y },
      end: { x: PAGE_WIDTH - MARGIN, y: cursor.y },
      thickness: 0.7,
      color: RULE,
    });
    cursor.y -= LINE_HEIGHT;
  };
  drawTableHeader();

  for (const item of quote.lineItems) {
    const descLines = wrapText(item.description, font, FONT_SIZE, COLS.description.w);
    const rowHeight = Math.max(descLines.length, 1) * LINE_HEIGHT + 4;
    if (cursor.y - rowHeight < MARGIN) {
      cursor.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursor.y = PAGE_HEIGHT - MARGIN;
      drawTableHeader();
    }
    drawText(String(item.position), COLS.pos.x, { color: GRAY });
    drawText(String(item.quantity), 0, { rightAlignEnd: COLS.quantity.x + COLS.quantity.w });
    if (item.unit) drawText(item.unit, COLS.unit.x);
    drawText(formatChf(item.unitPrice), 0, { rightAlignEnd: COLS.unitPrice.x + COLS.unitPrice.w });
    drawText(formatChf(item.lineTotal), 0, { rightAlignEnd: PAGE_WIDTH - MARGIN });
    for (const line of descLines) {
      drawText(line, COLS.description.x);
      cursor.y -= LINE_HEIGHT;
    }
    cursor.y -= 4;
  }

  // ── Summen ────────────────────────────────────────────────────────────────
  newPageIfNeeded(6 * LINE_HEIGHT + 12);
  cursor.page.drawLine({
    start: { x: COLS.unitPrice.x, y: cursor.y + LINE_HEIGHT - 6 },
    end: { x: PAGE_WIDTH - MARGIN, y: cursor.y + LINE_HEIGHT - 6 },
    thickness: 0.7,
    color: RULE,
  });
  const subtotal = roundRappen(quote.lineItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const discountAmount = roundRappen(subtotal - quote.totalNet);
  const totals: [string, string, PDFFont][] = [
    ...(discountAmount > 0
      ? ([
          ["Zwischentotal CHF", formatChf(subtotal), font],
          [`Rabatt ${quote.discountPercent}%`, `-${formatChf(discountAmount)}`, font],
        ] as [string, string, PDFFont][])
      : []),
    ["Netto CHF", formatChf(quote.totalNet), font],
    [`MwSt. ${quote.vatRate}%`, formatChf(quote.totalGross - quote.totalNet), font],
    ["Total CHF", formatChf(quote.totalGross), bold],
  ];
  for (const [label, value, f] of totals) {
    drawText(label, COLS.unitPrice.x - 40, { font: f });
    drawText(value, 0, { font: f, rightAlignEnd: PAGE_WIDTH - MARGIN });
    cursor.y -= LINE_HEIGHT;
  }

  // ── Schlusstext ───────────────────────────────────────────────────────────
  if (quote.outroText) {
    cursor.y -= 16;
    drawParagraph(quote.outroText, MARGIN, CONTENT_WIDTH);
  }

  return doc.save();
}

/** Logo von der Branding-URL laden — Fehler werden verschluckt (PDF ohne Logo). */
export async function fetchLogoBytes(
  logoUrl: string | null,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") ?? "";
    if (!mimeType.includes("png") && !mimeType.includes("jpeg") && !mimeType.includes("jpg")) {
      return null;
    }
    return { bytes: new Uint8Array(await res.arrayBuffer()), mimeType };
  } catch {
    return null;
  }
}
