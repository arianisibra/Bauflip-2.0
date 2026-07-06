"use client";

import Papa from "papaparse";

/**
 * CSV im Browser erzeugen und herunterladen. Semikolon-Delimiter + UTF-8-BOM,
 * damit Excel (CH/DE-Locale) Spalten und Umlaute korrekt öffnet.
 */
export function downloadCsv(
  filename: string,
  rows: Record<string, string | number | null>[],
): void {
  const csv = Papa.unparse(rows, { delimiter: ";" });
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
