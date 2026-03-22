import Papa from "papaparse";
import type { Article, Customer } from "@/lib/domain/types";

export function parseCustomerCsv(csvText: string): Omit<Customer, "id" | "createdAt">[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data.map((row) => ({
    name: row.name?.trim() ?? "",
    email: row.email?.trim() || null,
    phone: row.phone?.trim() || null,
    street: row.street?.trim() || null,
    postalCode: row.postalCode?.trim() || null,
    city: row.city?.trim() || null,
  }));
}

export function parseArticleCsv(csvText: string): Omit<Article, "id" | "createdAt">[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data.map((row) => ({
    name: row.name?.trim() ?? "",
    sku: row.sku?.trim() ?? "",
    category: row.category?.trim() ?? "Divers",
    supplierId: row.supplierId?.trim() || null,
    inStock: Number(row.inStock ?? "0"),
  }));
}

export function toCsv<T extends object>(rows: T[]) {
  return Papa.unparse(rows);
}
