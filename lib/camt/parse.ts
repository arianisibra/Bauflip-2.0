import { XMLParser } from "fast-xml-parser";

/**
 * camt.053 (Tagesauszug) / camt.054 (Gutschrifts-Avis) — ISO-20022-XML.
 * Wir lesen nur Gutschriften (CdtDbtInd = CRDT) und extrahieren genau das,
 * was für den Zahlungsabgleich zählt: Betrag, Valuta, Referenz, Zahler-Name.
 *
 * Beide Formate teilen dieselbe Ntry/TxDtls-Struktur (054 ist im Kern eine
 * Teilmenge von 053) — ein Parser für beide, toleranter Zugriff auf optionale
 * Felder, weil Banken hier in Details variieren.
 */

export type CamtCreditEntry = {
  /** Gutgeschriebener Betrag, immer positiv. */
  amount: number;
  currency: string;
  /** Valuta-Datum (YYYY-MM-DD) — das eigentliche "wann kam das Geld". */
  valueDate: string;
  /** QRR/SCOR-Referenz aus CdtrRefInf, falls vorhanden — ungetrimmt aus der Datei. */
  reference: string | null;
  /** Name des Auftraggebers/Zahlers, falls vorhanden. */
  debtorName: string | null;
  /** Unstrukturierte Mitteilung (Fallback-Info für die Vorschau). */
  remittanceInfo: string | null;
};

export class CamtParseError extends Error {}

/** fast-xml-parser liefert bei genau einem Kind ein Objekt, bei mehreren ein Array. */
function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  // fast-xml-parser kann bei gemischtem Inhalt { "#text": "..." } liefern.
  if (typeof value === "object" && "#text" in (value as Record<string, unknown>)) {
    return textOf((value as Record<string, unknown>)["#text"]);
  }
  return null;
}

function extractReference(txDtls: Record<string, unknown> | undefined): string | null {
  if (!txDtls) return null;
  const rmtInf = txDtls.RmtInf as Record<string, unknown> | undefined;
  const strd = rmtInf?.Strd;
  // Strd kann ein Array sein (mehrere Remittance-Blöcke) — erste mit Referenz gewinnt.
  for (const block of asArray(strd as Record<string, unknown> | Record<string, unknown>[])) {
    const cdtrRefInf = (block as Record<string, unknown>)?.CdtrRefInf as
      | Record<string, unknown>
      | undefined;
    const ref = textOf(cdtrRefInf?.Ref);
    if (ref) return ref;
  }
  return null;
}

function extractDebtorName(txDtls: Record<string, unknown> | undefined): string | null {
  if (!txDtls) return null;
  const relatedParties = txDtls.RltdPties as Record<string, unknown> | undefined;
  const dbtr = relatedParties?.Dbtr as Record<string, unknown> | undefined;
  return textOf(dbtr?.Nm);
}

function extractRemittanceInfo(txDtls: Record<string, unknown> | undefined): string | null {
  if (!txDtls) return null;
  const rmtInf = txDtls.RmtInf as Record<string, unknown> | undefined;
  const ustrd = rmtInf?.Ustrd;
  if (ustrd) return textOf(Array.isArray(ustrd) ? ustrd[0] : ustrd);
  // Strukturierte Mitteilung ohne CdtrRefInf, aber mit AddtlRmtInf.
  for (const block of asArray(rmtInf?.Strd as Record<string, unknown> | Record<string, unknown>[])) {
    const addtl = textOf((block as Record<string, unknown>)?.AddtlRmtInf);
    if (addtl) return addtl;
  }
  return null;
}

/** Eine Ntry (Bucheintrag) kann mehrere TxDtls enthalten (Sammelbuchung) — wir zerlegen sie. */
function entriesFromNtry(ntry: Record<string, unknown>): CamtCreditEntry[] {
  const cdtDbtInd = textOf(ntry.CdtDbtInd);
  if (cdtDbtInd !== "CRDT") return [];

  const amtNode = ntry.Amt as Record<string, unknown> | string | number | undefined;
  const ntryAmount = Number(textOf(amtNode) ?? "0");
  const ntryCurrency =
    typeof amtNode === "object" && amtNode !== null
      ? String((amtNode as Record<string, unknown>)["@_Ccy"] ?? "CHF")
      : "CHF";
  const valueDate =
    textOf((ntry.ValDt as Record<string, unknown> | undefined)?.Dt) ??
    textOf((ntry.BookgDt as Record<string, unknown> | undefined)?.Dt) ??
    null;

  const ntryDtls = ntry.NtryDtls as Record<string, unknown> | undefined;
  const txDtlsList = asArray(
    ntryDtls?.TxDtls as Record<string, unknown> | Record<string, unknown>[] | undefined,
  );

  if (txDtlsList.length === 0) {
    // Keine Detail-Transaktionen — die Ntry selbst trägt die Summe, ohne Referenz zuordenbar.
    if (!valueDate) return [];
    return [
      {
        amount: ntryAmount,
        currency: ntryCurrency,
        valueDate,
        reference: null,
        debtorName: null,
        remittanceInfo: null,
      },
    ];
  }

  return txDtlsList.flatMap((txDtls) => {
    const detail = txDtls as Record<string, unknown>;
    const amtDtls = detail.Amt as Record<string, unknown> | string | number | undefined;
    const amount = amtDtls != null ? Number(textOf(amtDtls) ?? "0") : ntryAmount;
    const currency =
      typeof amtDtls === "object" && amtDtls !== null
        ? String((amtDtls as Record<string, unknown>)["@_Ccy"] ?? ntryCurrency)
        : ntryCurrency;
    if (!valueDate || !Number.isFinite(amount) || amount <= 0) return [];
    return [
      {
        amount,
        currency,
        valueDate,
        reference: extractReference(detail),
        debtorName: extractDebtorName(detail),
        remittanceInfo: extractRemittanceInfo(detail),
      },
    ];
  });
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

/**
 * Parst eine camt.053/054-XML-Datei zu einer flachen Liste von Gutschriften.
 * Wirft `CamtParseError` bei unlesbarem XML oder fehlender Kontostruktur —
 * die aufrufende Action übersetzt das in eine verständliche Meldung.
 */
export function parseCamtXml(xml: string): CamtCreditEntry[] {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch (err) {
    throw new CamtParseError(err instanceof Error ? err.message : "XML konnte nicht gelesen werden.");
  }

  const document = doc.Document as Record<string, unknown> | undefined;
  // camt.053 root: BkToCstmrStmt/Stmt · camt.054 root: BkToCstmrDbtCdtNtfctn/Ntfctn.
  const container =
    (document?.BkToCstmrStmt as Record<string, unknown> | undefined) ??
    (document?.BkToCstmrDbtCdtNtfctn as Record<string, unknown> | undefined);
  const statements = asArray(
    (container?.Stmt ?? container?.Ntfctn) as Record<string, unknown> | Record<string, unknown>[] | undefined,
  );
  if (statements.length === 0) {
    throw new CamtParseError("Keine camt.053/054-Struktur gefunden (Stmt/Ntfctn fehlt).");
  }

  const entries: CamtCreditEntry[] = [];
  for (const stmt of statements) {
    const ntries = asArray(
      (stmt as Record<string, unknown>).Ntry as Record<string, unknown> | Record<string, unknown>[] | undefined,
    );
    for (const ntry of ntries) {
      entries.push(...entriesFromNtry(ntry as Record<string, unknown>));
    }
  }
  return entries;
}
