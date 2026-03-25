import type { ArticleCategoryTemplateScope } from "@/lib/domain/types";

/** Platzhalter für Lang- und Kurzbeschreibung (werden später z. B. bei Angeboten ersetzt). */
export type ArticleTextPlaceholder = {
  token: string;
  label: string;
  /** In welchen Kategorie-Kontexten der Platzhalter typischerweise vorkommt */
  scopes: ArticleCategoryTemplateScope[];
};

export const ARTICLE_TEXT_PLACEHOLDERS: ArticleTextPlaceholder[] = [
  { token: "xxxBEZEICHNUNGxxx", label: "Artikelbezeichnung", scopes: ["generic", "storen", "sonnenstoren", "dl"] },
  { token: "xxxBREITExxx", label: "Breite", scopes: ["storen"] },
  { token: "xxxHOEHExxx", label: "Höhe", scopes: ["storen"] },
  { token: "xxxFARBESTOFFxxx", label: "Farbe Stoff", scopes: ["storen"] },
  { token: "xxxFARBERAHMENxxx", label: "Farbe Rahmen", scopes: ["storen"] },
  { token: "xxxSTOFFARTxxx", label: "Stoffart", scopes: ["storen"] },
  { token: "xxxORTxxx", label: "Ort", scopes: ["generic", "storen", "sonnenstoren", "dl"] },
  { token: "xxxDATUMxxx", label: "Datum", scopes: ["dl"] },
  { token: "xxxBEDIENUNGxxx", label: "Bedienung", scopes: ["storen"] },
  { token: "xxxAUSLADUNGxxx", label: "Ausladung", scopes: ["sonnenstoren"] },
];

/** Beispiel-Zahnrad / Lamellenstoren (nur Hilfe, kein technischer Platzhalter) */
export const ARTICLE_PLACEHOLDER_EXAMPLE_LAMELLEN =
  "Zahnrad für Lamellenstoren — in Beschreibungen z. B. mit xxxBEZEICHNUNGxxx, xxxBREITExxx, xxxHOEHExxx kombinieren.";
