# Plan: Dokument-Vorlagen (individuelle & bestehende Formate, Word-Templates)

Stand: Juli 2026, Branch `bauflip-os` (Entwicklungs-Branch — kein Merge nach `main`).

Ziel: Bauflip verschickt Aufträge, Offerten, Rapporte und Rechnungen **im Format,
das der Kunde will** — eigene Layouts erstellen ODER bestehende Word-/Format-Vorlagen
übernehmen. Kernidee: von **Code-Layout** (heute) zu **Template-Layout**.

## 0. Getroffene Entscheide / Annahmen

| Entscheid | Begründung |
|---|---|
| **Word-(.docx)-Vorlagen mit Platzhaltern** als primärer Weg | Kunde bringt seine **bestehende** Word-Datei mit → Platzhalter rein → lebende Vorlage. Vertrautes Werkzeug, „eigenes Format" ohne Dev. |
| **Self-Service: Betriebe pflegen ihre Vorlagen selbst** (Admin/Büro) | Spiegelt das bewährte `order-forms`-Muster (per-Org-Templates). Zentrale/Pro-Kunde-Pflege = spätere Stufe (D3). |
| **QR-Rechnung: Inhalt templatebar, Zahlteil bleibt fixer compliant Block** | Eine freie Vorlage kann keinen spec-konformen Swiss-QR-Zahlteil erzeugen (mm-genau, Scannability). Nicht verhandelbar. |
| **Aufträge/Offerten/Rapporte zuerst** (kein QR-Konflikt), Rechnung in Stufe 2 | Sofortiger Nutzen ohne Compliance-Risiko. |
| **`docxtemplater`** als Engine (Word rein → Word raus) | Etabliert, kein Server-seitiges Office nötig für .docx-Ausgabe. |
| **PDF-Ausgabe via Gotenberg** (self-hosted Docker, LibreOffice/Chromium) | Saubere HTTP-API `.docx → .pdf`; keine fragile In-Process-Konvertierung. Optional in D1, falls .docx-Ausgabe reicht. |

---

## 1. Architektur (drei Teile)

### 1.1 Feld-Katalog (`lib/documents/field-catalog.ts`, pure)
Alle verfügbaren Platzhalter als benannte Tokens + Resolver, der aus einem Projekt-/
Offert-/Rechnungs-Bundle ein flaches Datenobjekt für docxtemplater baut. Der Katalog
ist der Vertrag zwischen „Kunde gestaltet Word" und „Bauflip füllt".

Gruppen (Beispiele):
- **Firma/Absender:** `firma_name`, `firma_strasse`, `firma_plz_ort`, `firma_iban`, `firma_uid`
- **Projekt:** `projekt_nr`, `projekt_titel`, `projekt_datum`
- **Mieter/Kunde:** `mieter_name`, `mieter_telefon`, `mieter_mail`
- **Verwaltung:** `verwaltung_name`, `verwaltung_mail`
- **Objekt/Adresse:** `objekt_strasse`, `objekt_plz`, `objekt_ort`
- **Offerte:** `offerte_nr`, `offerte_gueltig_bis`, `offerte_total`, `offerte_netto`, `offerte_mwst`
- **Rechnung:** `rechnung_nr`, `rechnung_faellig`, `rechnung_referenz`, `rechnung_total`
- **Positionen (Schleife):** `{#positionen}{beschreibung} {menge} {einheit} {einzelpreis} {zeilentotal}{/positionen}`

Der Katalog wird als **„Platzhalter-Referenz"-Datei** (Download-.docx/PDF) exportiert,
damit der Kunde weiss, welche Felder er ins Word setzen kann.

### 1.2 Vorlagen-Speicher
- Neue Tabelle **`document_templates`** (Migration).
- Die .docx-Datei liegt im **Supabase Storage** (eigener Bucket, wie Logos/Attachments).
- Pro Org + Dokumenttyp genau **eine Standard-Vorlage** (`is_default`), beliebig viele weitere.

### 1.3 Render-/Binding-Schicht (`lib/documents/render-docx.ts`, server-only)
- Template-Bytes aus Storage laden → `docxtemplater` mit gebundenen Daten füllen → `.docx`-Bytes.
- Optional `renderPdf()` → Gotenberg (`POST /forms/libreoffice/convert`) → `.pdf`-Bytes.
- **Sicherheit:** Upload validieren (Template parsen, Fehler abfangen), Angular-/JS-Parser
  von docxtemplater **aus** lassen (keine Eval), Dateigrösse begrenzen, nur `.docx` zulassen.

---

## 2. Datenmodell (Migration)

```sql
create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('auftrag','offerte','rapport','rechnung')),
  name text not null,
  storage_path text not null,        -- Pfad im Storage-Bucket
  output_format text not null default 'pdf' check (output_format in ('docx','pdf')),
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Genau eine Standard-Vorlage je (org, kind):
create unique index document_templates_one_default
  on public.document_templates (organization_id, kind) where is_default;
-- RLS: org-scoped, Admin/Büro (Muster wie payment_imports).
```
Später (D3): `customer_template_bindings` (Verwaltung/Kunde → Vorlage).

---

## 3. UI-Fluss

### Verwaltung (Einstellungen → neue Sektion «Dokumentvorlagen»)
Konsistent mit dem UX-Redesign: **Zusammenfassungs-Zeile + Verwalten-Fenster**.
- Liste je Dokumenttyp; **.docx hochladen**, umbenennen, als Standard setzen, löschen.
- **„Platzhalter-Referenz herunterladen"** (Feld-Katalog als .docx).
- **Vorschau**: Vorlage mit einem echten/Demo-Projekt füllen → Ergebnis ansehen.

### Beim Versenden/Download (Offerte/Rechnung/Auftrag)
- Existiert eine Vorlage für den Typ: kleines **„Vorlage: Standard ▾"** (Auswahl).
- Keine Vorlage: **Fallback auf die heutige programmatische PDF** (nichts geht verloren).

---

## 4. QR-Rechnung: der Split (Stufe D2)

```
Rechnung = [ Inhalt aus Vorlage → PDF ]  +  [ QR-Zahlteil: programmatisch, compliant ]
```
- Body via Template rendern → PDF (Gotenberg).
- QR-Zahlteil-Seite weiter mit `pdf-lib` erzeugen (bestehender, geprüfter Code).
- Beide PDFs **mergen** (pdf-lib) → finale Rechnung. Compliance bleibt garantiert.

---

## 5. Stufen & Aufwand

| Stufe | Inhalt | Aufwand | Abhängigkeit |
|---|---|---|---|
| **D1 — Fundament** | Feld-Katalog, `document_templates`-Migration + Storage-Bucket, `render-docx.ts` (docxtemplater), Upload/Verwalten-UI, Platzhalter-Referenz, Anwendung auf **Auftrag/Offerte/Rapport** | 2–3 Tage | Gotenberg nur nötig, wenn PDF-Ausgabe (sonst .docx) |
| **D2 — QR-Rechnung** | Template-Body + fixer Zahlteil, PDF-Merge, Vorlage-Auswahl beim Rechnungsversand | ~2 Tage | D1 |
| **D3 — Pro-Kunde** | `customer_template_bindings`, automatische Formatwahl je Verwaltung, Vorschau/Versionierung-Feinschliff | ~2 Tage | D1/D2 |

**Empfehlung:** D1 zuerst — grösster Nutzen („bring your own format"), kein QR-Risiko.

---

## 6. Voraussetzungen (User/Ops)
1. **Entscheid Ausgabe:** reicht **.docx** (kein Server-Office nötig) oder braucht es **PDF**
   (dann **Gotenberg-Container** auf dem VPS betreiben)? Empfehlung: PDF via Gotenberg.
2. **Beispiel-Vorlage** eines echten Kunden (die gewünschte „Bexio-Optik"), um den
   Feld-Katalog gegen einen realen Bedarf zu schärfen.

## 7. Risiken & Gegenmassnahmen

| Risiko | Gegenmassnahme |
|---|---|
| `.docx → PDF`-Treue nicht 100% | Gotenberg (LibreOffice) statt pure JS; Vorschau vor Live-Nutzung |
| Template-Injection (docxtemplater-CVEs) | JS/Angular-Parser aus, Upload validieren, Grösse/Typ begrenzen |
| QR-Compliance bricht durch freie Vorlage | Zahlteil nie templatebar — fixer generierter Block (Split D2) |
| Vorlagen-Editor unterschätzt | D1 bewusst schlank (Upload + Standard + Vorschau), Editor-Komfort später |
| Feld-Katalog trifft echten Bedarf nicht | Katalog an einer realen Kundenvorlage kalibrieren (Voraussetzung 2) |
