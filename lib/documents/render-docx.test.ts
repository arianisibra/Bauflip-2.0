import assert from "node:assert/strict";
import { test } from "node:test";
import PizZip from "pizzip";
import { findUnknownTemplateTags, renderDocxTemplate } from "./render-docx.ts";
import {
  QUOTE_DOCUMENT_TOKEN_KEYS,
  SAMPLE_QUOTE_DOCUMENT_DATA,
} from "./quote-document-data.ts";

/** Baut eine minimale, gültige .docx mit dem gegebenen Fliesstext (inkl. {tokens}). */
function makeDocx(bodyText: string): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
      `</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
      `<w:p><w:r><w:t xml:space="preserve">${bodyText}</w:t></w:r></w:p>` +
      `</w:body></w:document>`,
  );
  return zip.generate({ type: "nodebuffer" });
}

function docxText(bytes: Buffer): string {
  const xml = new PizZip(bytes).file("word/document.xml")!.asText();
  return xml.replace(/<[^>]+>/g, "");
}

const sample = SAMPLE_QUOTE_DOCUMENT_DATA as unknown as Record<string, unknown>;

test("findUnknownTemplateTags: gültige Bauflip-Tokens ergeben keine Funde", () => {
  const doc = makeDocx("Offerte {offerte_nummer} für {kunde_name}: {total_brutto}");
  assert.deepEqual(findUnknownTemplateTags(doc, QUOTE_DOCUMENT_TOKEN_KEYS, sample), []);
});

test("findUnknownTemplateTags: Positions-Schleife mit gültigen Feldern ist ok", () => {
  const doc = makeDocx("{#positionen}{beschreibung} {einzelpreis}{/positionen}");
  assert.deepEqual(findUnknownTemplateTags(doc, QUOTE_DOCUMENT_TOKEN_KEYS, sample), []);
});

test("findUnknownTemplateTags: unbekannte Tokens werden gemeldet", () => {
  const doc = makeDocx("Angebot {Angebotsnummer} — {Total}");
  const unknown = findUnknownTemplateTags(doc, QUOTE_DOCUMENT_TOKEN_KEYS, sample);
  assert.deepEqual(unknown.sort(), ["Angebotsnummer", "Total"]);
});

test("renderDocxTemplate: fehlende Tokens werden leer statt «undefined» gerendert", () => {
  const out = renderDocxTemplate(makeDocx("A {offerte_nummer} B {unbekannt} C"), {
    offerte_nummer: "OF-1",
  });
  const text = docxText(out);
  assert.ok(text.includes("OF-1"), "bekannter Wert eingesetzt");
  assert.ok(!text.includes("undefined"), "kein «undefined» im Output");
  assert.ok(text.includes("A OF-1 B  C"), `leer gerendert, war: "${text}"`);
});
