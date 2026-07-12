import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CamtParseError, parseCamtXml } from "@/lib/camt/parse";

/** camt.053 (Tagesauszug): 2 Gutschriften — eine mit QRR-Referenz, eine ohne (nur Ustrd). */
const CAMT_053_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <Stmt>
      <Id>STMT-0001</Id>
      <Ntry>
        <Amt Ccy="CHF">1334.49</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-07-10</Dt></BookgDt>
        <ValDt><Dt>2026-07-10</Dt></ValDt>
        <NtryDtls>
          <TxDtls>
            <Amt Ccy="CHF">1334.49</Amt>
            <RltdPties>
              <Dbtr><Nm>Familie Muster</Nm></Dbtr>
            </RltdPties>
            <RmtInf>
              <Strd>
                <CdtrRefInf>
                  <Ref>210000000003139471430009017</Ref>
                </CdtrRefInf>
              </Strd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="CHF">250.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-07-10</Dt></BookgDt>
        <ValDt><Dt>2026-07-11</Dt></ValDt>
        <NtryDtls>
          <TxDtls>
            <Amt Ccy="CHF">250.00</Amt>
            <RltdPties>
              <Dbtr><Nm>Hans Beispiel</Nm></Dbtr>
            </RltdPties>
            <RmtInf>
              <Ustrd>Rechnung RE-2026-1042</Ustrd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="CHF">99.90</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <ValDt><Dt>2026-07-10</Dt></ValDt>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

/** camt.054 (Gutschrifts-Avis): eine Notification, ein Entry mit SCOR-Referenz. */
const CAMT_054_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.08">
  <BkToCstmrDbtCdtNtfctn>
    <Ntfctn>
      <Id>AVIS-0001</Id>
      <Ntry>
        <Amt Ccy="CHF">899.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <ValDt><Dt>2026-07-12</Dt></ValDt>
        <NtryDtls>
          <TxDtls>
            <Amt Ccy="CHF">899.00</Amt>
            <RltdPties>
              <Dbtr><Nm>Verwaltung Muster AG</Nm></Dbtr>
            </RltdPties>
            <RmtInf>
              <Strd>
                <CdtrRefInf>
                  <Ref>RF18539007547034</Ref>
                </CdtrRefInf>
              </Strd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Ntfctn>
  </BkToCstmrDbtCdtNtfctn>
</Document>`;

/** Sammelbuchung: eine Ntry mit zwei TxDtls (mehrere Zahlungen in einer Buchung). */
const CAMT_053_COLLECTIVE_BOOKING = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <Stmt>
      <Ntry>
        <Amt Ccy="CHF">600.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <ValDt><Dt>2026-07-10</Dt></ValDt>
        <NtryDtls>
          <TxDtls>
            <Amt Ccy="CHF">400.00</Amt>
            <RmtInf><Strd><CdtrRefInf><Ref>REF-AAA</Ref></CdtrRefInf></Strd></RmtInf>
          </TxDtls>
          <TxDtls>
            <Amt Ccy="CHF">200.00</Amt>
            <RmtInf><Strd><CdtrRefInf><Ref>REF-BBB</Ref></CdtrRefInf></Strd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

describe("parseCamtXml — camt.053", () => {
  it("extracts only credit entries with amount, currency, value date, reference", () => {
    const entries = parseCamtXml(CAMT_053_SAMPLE);
    assert.equal(entries.length, 2); // DBIT-Eintrag ausgefiltert

    assert.deepEqual(entries[0], {
      amount: 1334.49,
      currency: "CHF",
      valueDate: "2026-07-10",
      reference: "210000000003139471430009017",
      debtorName: "Familie Muster",
      remittanceInfo: null,
    });
  });

  it("falls back to unstructured remittance info when no CdtrRefInf is present", () => {
    const entries = parseCamtXml(CAMT_053_SAMPLE);
    const second = entries[1];
    assert.equal(second.reference, null);
    assert.equal(second.remittanceInfo, "Rechnung RE-2026-1042");
    assert.equal(second.debtorName, "Hans Beispiel");
  });

  it("splits a collective booking (one Ntry, multiple TxDtls) into separate entries", () => {
    const entries = parseCamtXml(CAMT_053_COLLECTIVE_BOOKING);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].amount, 400);
    assert.equal(entries[0].reference, "REF-AAA");
    assert.equal(entries[1].amount, 200);
    assert.equal(entries[1].reference, "REF-BBB");
  });
});

describe("parseCamtXml — camt.054", () => {
  it("reads notifications the same way as statements", () => {
    const entries = parseCamtXml(CAMT_054_SAMPLE);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].amount, 899);
    assert.equal(entries[0].reference, "RF18539007547034");
    assert.equal(entries[0].debtorName, "Verwaltung Muster AG");
  });
});

describe("parseCamtXml — Fehlerfälle", () => {
  it("throws CamtParseError on invalid XML", () => {
    assert.throws(() => parseCamtXml("not xml at all <<<"), CamtParseError);
  });

  it("throws CamtParseError when neither Stmt nor Ntfctn is present", () => {
    assert.throws(
      () => parseCamtXml(`<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><Foo/></Document>`),
      CamtParseError,
    );
  });

  it("returns an empty list for a statement with no entries", () => {
    const entries = parseCamtXml(
      `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt><Stmt><Id>EMPTY</Id></Stmt></BkToCstmrStmt></Document>`,
    );
    assert.deepEqual(entries, []);
  });
});
