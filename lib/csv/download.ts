"use client";

/**
 * CSV im Browser erzeugen und herunterladen. Semikolon-Delimiter + UTF-8-BOM,
 * damit Excel (CH/DE-Locale) Spalten und Umlaute korrekt öffnet.
 *
 * papaparse wird erst beim Klick geladen (dynamic import) — hält die
 * Seiten-Bundles der Export-Routen schlank.
 */

/**
 * Schutz vor CSV-/Formel-Injection: Zellen, die Excel als Formel interpretieren
 * würde (`=`, `+`, `-`, `@`, Tab, CR am Anfang), bekommen ein `'`-Prefix.
 * Zahlen bleiben unangetastet.
 */
function escapeFormulaCell(value: string | number | null): string | number | null {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export async function downloadCsv(
  filename: string,
  rows: Record<string, string | number | null>[],
): Promise<void> {
  const Papa = (await import("papaparse")).default;
  const safeRows = rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, escapeFormulaCell(value)])),
  );
  const csv = Papa.unparse(safeRows, { delimiter: ";" });
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
