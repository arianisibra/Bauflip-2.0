# Plan: Produkte (Preisstamm) + Kontakte

Ausbau auf `bauflip-os`. Zwei Themen: **Produkte** (der Preisstamm existiert schon —
nur aufwerten) und **Kontakte** (Neubau; alte contacts-Tabellen wurden beim Downsizing
gedroppt).

## Entscheidungen
- **Produkte: P1 + P2** (Modell erweitern + Such-Picker).
- **Kontakte: Stufe 2, in 2 Schritten** (erst Verzeichnis + Autofill, dann
  `contact_id`-Verknüpfung + Historie).

## Defaults (offene Fragen, vorläufig so angenommen)
1. Kontakte pflegen: **Admin + Büro** schreiben, Monteur read-only.
2. Kundennummer: **automatisch** per Nummernkreis, überschreibbar. *(offen)*
3. Pflichtfelder: nur **Name**, Rest optional.
4. Bexio-Import bestehender Kontakte: **später** (nicht in Schritt 1/2).

---

## Produkte (Preisstamm)

### P1 — Modell erweitern ✅ (umgesetzt)
- Migration `20260808120000_price_book_details.sql`: `price_book_items +=`
  `description`, `category`, `article_number` (alle nullable) + Index
  `(org, is_active, category, sort_order, name)`.
- `PriceBookItem`-Typ, Repo (`lib/db/price-book.ts`), Zod (`priceBookItemSchema`),
  Actions und Manager-UI (`price-book-manager.tsx`) um die drei Felder erweitert.

### P2 — Such-Picker ✅ (umgesetzt)
- Neue Komponente `components/app/price-book-picker.tsx`: Freitextsuche über
  Name/Kategorie/Artikelnummer/Beschreibung, Klick fügt Position hinzu. Ersetzt das
  bisherige `Select` in **Offerten- und Rechnungs-Editor**. Beim Übernehmen wird die
  **Beschreibung** (falls vorhanden) als Positions-Text genutzt, sonst der Name.

### Später (nicht in P1/P2)
- P3: Bexio-Artikel-Sync (`articles.bexio_article_id` gab es früher schon).

---

## Kontakte

### Datenmodell (neu)
`contacts` — org-scoped, RLS wie `price_book_items` (Admin/Büro schreiben):
```
id, organization_id,
kind (privat|mieter|verwaltung|eigentuemer|lieferant),
display_name, company_name, email, phone, mobile,
street, postal_code, city, country, notes,
kunden_nummer, bexio_contact_id (null),
is_active, created_at, updated_at, created_by
```
Indizes: `(org, is_active, display_name)` + Trigram-Suche auf Name/Firma.

### Schritt 1 — Verzeichnis + Autofill
- Migration `contacts` + RLS + Indizes.
- Domain-Typen, Zod, `lib/db/contacts.ts` (CRUD + Suche), Actions/Hooks/Keys/Realtime.
- **„Kontakte"-Seite** (Liste, Suche, Anlegen/Bearbeiten) + Nav-Punkt.
- **„Kontakt wählen"** in „Neue Anfrage" und im Projekt-Sheet → füllt die
  bestehenden `tenant_*`/`management_*`-Felder (zwei Rollen: Mieter + Verwaltung).
- Liste **optimistisch** (add/remove per `setQueryData`), damit sie NICHT in den
  Infinite-Query-Refresh-Bug der Projektliste läuft.

### Schritt 2 — Verknüpfung + Historie
- Migration `projects += tenant_contact_id, management_contact_id`
  (FK → contacts, nullable, `on delete set null`). Bestehende Felder bleiben als
  **Snapshot** (Dokument-Stabilität).
- Beim Autofill die `contact_id` mitsetzen; optionaler Backfill per Namensabgleich.
- **Kontakt-Detailseite**: Projekte/Offerten/Rechnungen + Umsatz (Join über
  `project.*_contact_id`).
- **Bexio**: `bexio_contact_id` speichern → Push nutzt den Link statt Namenssuche
  (verhindert Dubletten).

## Aufwand (grob)
- Produkte P1+P2: ~0,5–1 Tag (erledigt).
- Kontakte Schritt 1: ~1,5–2 Tage.
- Kontakte Schritt 2: ~1–1,5 Tage.
