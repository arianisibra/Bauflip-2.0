import Papa from "papaparse";
import type { Contact, ContactCategory, ContactPartyKind } from "@/lib/domain/types";
import type { Article } from "@/lib/domain/types";
import type { ArticleImportRow } from "@/lib/db/repository";

/** Feste Spaltenreihenfolge für Vorlage, Export und Import (Header müssen enthalten sein, Schreibweise egal). */
export const CONTACT_IMPORT_FIELDS = [
  "contactNumber",
  "partyKind",
  "category",
  "name",
  "uidNumber",
  "email",
  "phone",
  "mobile",
  "street",
  "postalCode",
  "city",
  "website",
  "managedObjectLabel",
  "bexioContactId",
] as const;

export const ARTICLE_IMPORT_FIELDS = [
  "name",
  "sku",
  "bexioArticleId",
  "categoryName",
  "supplierId",
  "purchasePrice",
  "salePrice",
  "unit",
  "descriptionShort",
  "descriptionLong",
  "inStock",
] as const;

export type ContactImportField = (typeof CONTACT_IMPORT_FIELDS)[number];
export type ArticleImportField = (typeof ARTICLE_IMPORT_FIELDS)[number];

export function stripCsvBom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

function pickCi(row: Record<string, string>, canonical: string): string {
  const hit = Object.keys(row).find((k) => k.trim().toLowerCase() === canonical.toLowerCase());
  return hit ? (row[hit] ?? "").trim() : "";
}

function parseMetaFields(csvText: string): string[] {
  const text = stripCsvBom(csvText);
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, preview: 1 });
  const raw = parsed.meta.fields ?? [];
  return raw.map((f) => f.replace(/^\uFEFF/, "").trim()).filter(Boolean);
}

function isBexioContactHeader(fieldsLc: string[]): boolean {
  const required = ["kontakt nr.", "vorname", "nachname", "firma", "e-mail"];
  return required.every((col) => fieldsLc.includes(col));
}

/** Prüft, ob alle erwarteten Spalten vorhanden sind. */
export function validateContactImportCsvHeaders(csvText: string): string | null {
  const fieldsLc = parseMetaFields(csvText).map((f) => f.toLowerCase());

  const hasStandard = CONTACT_IMPORT_FIELDS.every((col) =>
    fieldsLc.includes(col.toLowerCase()),
  );
  if (hasStandard) {
    return null;
  }

  if (isBexioContactHeader(fieldsLc)) {
    return null;
  }

  return "CSV-Header unbekannt. Bitte entweder die Bauflip-Kontaktvorlage oder den Bexio-Kontakt-Export verwenden.";
}

export function validateArticleImportCsvHeaders(csvText: string): string | null {
  const fields = parseMetaFields(csvText).map((f) => f.toLowerCase());
  const hasCat = fields.includes("categoryname") || fields.includes("category");
  if (!hasCat) {
    return `Spalte „categoryName“ fehlt. Bitte die Vorlage verwenden.`;
  }
  for (const col of ARTICLE_IMPORT_FIELDS) {
    if (col === "categoryName" || col === "bexioArticleId") {
      continue;
    }
    if (!fields.includes(col.toLowerCase())) {
      return `Spalte „${col}“ fehlt. Bitte die aktuelle Vorlage herunterladen und die Kopfzeile nicht ändern.`;
    }
  }
  return null;
}

/** Leere Vorlage: UTF-8 mit BOM, Kopfzeile + eine leere Datenzeile (Excel-kompatibel). */
export function buildContactTemplateCsv(): string {
  const empty = Object.fromEntries(CONTACT_IMPORT_FIELDS.map((k) => [k, ""])) as Record<string, string>;
  return "\uFEFF" + Papa.unparse([empty], { columns: [...CONTACT_IMPORT_FIELDS] });
}

export function buildArticleTemplateCsv(): string {
  const empty = Object.fromEntries(ARTICLE_IMPORT_FIELDS.map((k) => [k, ""])) as Record<string, string>;
  return "\uFEFF" + Papa.unparse([empty], { columns: [...ARTICLE_IMPORT_FIELDS] });
}

/** Export derselben Spaltenfolge wie die Vorlage. */
export function contactsToStandardCsv(contacts: Contact[]): string {
  const rows = contacts.map((c) => ({
    contactNumber: c.contactNumber ?? "",
    partyKind: c.partyKind,
    category: c.category,
    name: c.name,
    uidNumber: c.uidNumber ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    mobile: c.mobile ?? "",
    street: c.street ?? "",
    postalCode: c.postalCode ?? "",
    city: c.city ?? "",
    website: c.website ?? "",
    managedObjectLabel: c.managedObjectLabel ?? "",
    bexioContactId: c.bexioContactId ?? "",
  }));
  return "\uFEFF" + Papa.unparse(rows, { columns: [...CONTACT_IMPORT_FIELDS] });
}

export function articlesToStandardCsv(articles: Article[]): string {
  const rows = articles.map((a) => ({
    name: a.name,
    sku: a.sku,
    bexioArticleId: a.bexioArticleId ?? "",
    categoryName: a.categoryName ?? "",
    supplierId: a.supplierId ?? "",
    purchasePrice: a.purchasePrice ?? "",
    salePrice: a.salePrice ?? "",
    unit: a.unit,
    descriptionShort: a.descriptionShort ?? "",
    descriptionLong: a.descriptionLong ?? "",
    inStock: a.inStock,
  }));
  return "\uFEFF" + Papa.unparse(rows, { columns: [...ARTICLE_IMPORT_FIELDS] });
}

function parsePartyKind(raw: string | undefined): ContactPartyKind {
  return raw?.trim().toLowerCase() === "privat" ? "privat" : "firma";
}

function parseCategory(raw: string | undefined): ContactCategory {
  const v = raw?.trim().toLowerCase();
  if (v === "lieferant" || v === "partner" || v === "sonstiges") {
    return v;
  }
  return "kunde";
}

function parseStandardContactCsv(csvText: string): Omit<Contact, "id" | "createdAt">[] {
  const parsed = Papa.parse<Record<string, string>>(stripCsvBom(csvText), {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data.map((row) => ({
    organizationId: null,
    contactNumber: pickCi(row, "contactNumber") || null,
    partyKind: parsePartyKind(pickCi(row, "partyKind")),
    category: parseCategory(pickCi(row, "category")),
    name: pickCi(row, "name"),
    uidNumber: pickCi(row, "uidNumber") || null,
    email: pickCi(row, "email") || null,
    phone: pickCi(row, "phone") || null,
    mobile: pickCi(row, "mobile") || null,
    street: pickCi(row, "street") || null,
    postalCode: pickCi(row, "postalCode") || null,
    city: pickCi(row, "city") || null,
    website: pickCi(row, "website") || null,
    managedObjectLabel: pickCi(row, "managedObjectLabel") || null,
    bexioContactId: pickCi(row, "bexioContactId") || null,
  }));
}

function parseBexioContactCsv(csvText: string): Omit<Contact, "id" | "createdAt">[] {
  const parsed = Papa.parse<Record<string, string>>(stripCsvBom(csvText), {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data.map((row) => {
    const firstName = pickCi(row, "Vorname");
    const lastName = pickCi(row, "Nachname");
    const company = pickCi(row, "Firma");
    const companyExtra = pickCi(row, "Firmennamen-Zusatz");
    const nameRecipient = pickCi(row, "Name des Empfängers");
    const nameExtra = pickCi(row, "Namens-Zusatz");
    const bexioId = pickCi(row, "Kontakt Nr.");

    const streetBase = [pickCi(row, "Strasse"), pickCi(row, "Haus-Nr.")]
      .filter(Boolean)
      .join(" ")
      .trim();
    const addressExtra = pickCi(row, "Adresszusatz");
    const streetCombined = [streetBase, addressExtra].filter(Boolean).join(", ").trim();

    const postalCode = pickCi(row, "PLZ") || null;
    const city = pickCi(row, "Ort") || null;

    const email = pickCi(row, "E-Mail") || null;
    const phone = pickCi(row, "Telefon") || null;
    const mobile = pickCi(row, "Mobile") || null;

    const rawCategory = pickCi(row, "Kategorie");
    const category = parseCategory(rawCategory);

    const partyKind: ContactPartyKind = company ? "firma" : "privat";

    const nameCandidates = [
      [company, companyExtra].filter(Boolean).join(" ").trim(),
      [nameRecipient, nameExtra].filter(Boolean).join(" ").trim(),
      `${firstName} ${lastName}`.trim(),
    ].filter((v) => v.length > 0);

    const name = nameCandidates[0] || "Kontakt";

    const managedObjectLabelParts = [pickCi(row, "Branche")].filter(Boolean);
    const managedObjectLabel =
      managedObjectLabelParts.length > 0 ? managedObjectLabelParts.join(" · ") : null;

    return {
      organizationId: null,
      contactNumber: null,
      partyKind,
      category,
      name,
      uidNumber: null,
      email,
      phone,
      mobile,
      street: streetCombined || null,
      postalCode,
      city,
      website: null,
      managedObjectLabel,
      bexioContactId: bexioId || null,
    };
  });
}

export function parseContactCsv(csvText: string): Omit<Contact, "id" | "createdAt">[] {
  const fieldsLc = parseMetaFields(csvText).map((f) => f.toLowerCase());
  if (isBexioContactHeader(fieldsLc)) {
    return parseBexioContactCsv(csvText);
  }
  return parseStandardContactCsv(csvText);
}

function parseOptionalPrice(raw: string | undefined): number | null {
  const t = raw?.trim();
  if (!t) {
    return null;
  }
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseArticleCsv(csvText: string): ArticleImportRow[] {
  const parsed = Papa.parse<Record<string, string>>(stripCsvBom(csvText), {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data.map((row) => {
    const categoryName =
      pickCi(row, "categoryName") || pickCi(row, "category") || "Sonstiges";
    return {
      name: pickCi(row, "name"),
      sku: pickCi(row, "sku"),
      bexioArticleId: pickCi(row, "bexioArticleId") || null,
      categoryName,
      supplierId: pickCi(row, "supplierId") || null,
      purchasePrice: parseOptionalPrice(pickCi(row, "purchasePrice")),
      salePrice: parseOptionalPrice(pickCi(row, "salePrice")),
      unit: pickCi(row, "unit") || "Stk",
      descriptionLong: pickCi(row, "descriptionLong") || null,
      descriptionShort: pickCi(row, "descriptionShort") || null,
      inStock: Number(pickCi(row, "inStock") || "0") || 0,
    };
  });
}

export function toCsv<T extends object>(rows: T[]) {
  return Papa.unparse(rows);
}
