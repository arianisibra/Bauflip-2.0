/**
 * Single source of truth for outbound webhook `eventType` strings.
 * Zapier can filter on the JSON root field `eventType` or the `X-Bauflip-Event` header (same value).
 */
export const BAUFLIP_ZAPIER_EVENTS = {
  QUOTE_CREATED: "bauflip.quote.created",
  /** Nicht mehr aus BauFlip gesendet — nur noch `bauflip.quote.created` (Finalisierung inkl. `pdfPath`). */
  QUOTE_FINALIZED: "bauflip.quote.finalized",
  /** Rechnung vorbereitet oder finalisiert — wie Offerte immer dasselbe `eventType`; mit `pdfPath` = nach Finalisieren. */
  INVOICE_CREATED: "bauflip.invoice.created",
  REPORT_CREATED: "bauflip.report.created",
  INTEGRATION_TEST: "bauflip.integration.test",
} as const;

export type BauflipZapierEventType = (typeof BAUFLIP_ZAPIER_EVENTS)[keyof typeof BAUFLIP_ZAPIER_EVENTS];
