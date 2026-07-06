# Bauflip — Ausbau-Roadmap (Analyse & Optionen)

Stand: Juli 2026, Branch `bauflip-os`. Dieses Dokument fasst zusammen, **wo die App steht**, **welche Ausbau-Optionen** sich ergeben und **in welcher Reihenfolge** sie sinnvoll sind. Es ergänzt [DEVELOPER_OVERVIEW.md](./DEVELOPER_OVERVIEW.md) (Ist-Zustand) um die Soll-Perspektive.

---

## 1. Ausgangslage

Bauflip deckt den operativen Kern ab: **Intake → Termin → Einsatz → Rapport → Status-Workflow**, mit Multi-Tenancy (RLS), drei Rollen (`admin`/`office`/`technician`), Zeiterfassung, Abwesenheiten und Bestellformular-CMS.

**Zentrale Beobachtung:** Der Status-Workflow verspricht mehr, als die App einlöst. Status wie `offerte_senden`, `bestellen`, `abrechnen` existieren — aber **Offerte, Bestellung und Rechnung existieren nirgends als Objekt**. Die App *trackt* diese Schritte, *erledigt* sie aber nicht. Das ist die natürlichste Wachstumsrichtung.

### Bereits vorbereitet, aber ungenutzt

| Vorbereitung | Fundort | Legt nahe |
|---|---|---|
| `pdf-lib` installiert | `package.json` | PDF-Dokumente (Offerte, Rapport, Bestellung) |
| `nodemailer` installiert | `package.json` | E-Mail-Versand (Offerten, Bestätigungen) |
| `papaparse` installiert | `package.json` | CSV-Import/-Export (Lohn, Buchhaltung) |
| `qrcode` installiert (nur MFA) | `components/auth/mfa-setup-form.tsx` | Schweizer QR-Rechnung |
| Google/Microsoft Kalender-OAuth Env-Vars | `.env.example` | Kalender-Sync war geplant (kein Code vorhanden) |
| Organization-Branding (Name + Logo) | `getOrganizationBranding` | White-Label-Grundlage |
| Strukturierte Massaufnahme | `technician_reports.measurements_json` | Datenbasis für Offert-Positionen |

---

## 2. Ausbau-Optionen im Überblick

### A. Dokumente & Geld — den Workflow zu Ende bauen *(grösster Hebel)*

- **Offerten**: Aus Projekt + Rapport eine Offerte als PDF generieren und per Mail versenden. Statuswechsel `offerte_senden → offerte_gesendet` passiert dann automatisch statt manuell. → Detailplan in Abschnitt 3.
- **Rechnungen**: Rapport-Arbeitszeit + Material → Rechnung bei Status `abrechnen`; Schweizer QR-Rechnung (`qrcode` vorhanden). Alternativ zuerst nur Export an Buchhaltung.
- **Lieferanten-Bestellungen**: Bestellformulare werden heute nur gespeichert (`technician_report_order_forms`). Nächster Schritt: als PDF/Mail direkt an den Lieferanten (`supplier_name` existiert am Template), Status `bestellen → bestellt` automatisch.
- **Material-/Preisstamm**: Neue Tabelle mit Artikeln/Preisen pro Organisation — Voraussetzung für Offerten und Rechnungen mit Positionen.

### B. Kommunikation mit Kunden

- **Terminbestätigung/-erinnerung** an Mieter per E-Mail (Kontaktdaten + Termine vorhanden; `nodemailer` vorhanden).
- **Intake-Automatisierung**: `source` kennt schon `whatsapp | telefon | email`. E-Mail-Eingang (oder WhatsApp Business API), der automatisch einen Projektentwurf anlegt — optional mit KI-Extraktion von Name/Adresse/Problem aus `intakeOriginalText`.
- **Kundenportal** (später): Statuseinsicht per Magic-Link für Verwaltungen (`managementEmail` existiert am Projekt).

### C. Integrationen

- **Kalender-Sync** Google/Microsoft (Env-Vars in `.env.example` bereits dokumentiert): Monteur-Termine in den persönlichen Kalender pushen.
- **Buchhaltung**: Bexio (Schweizer Zielgruppe), später Abacus. Erster Schritt: CSV-Export.
- **Lohnexport** aus der Zeiterfassung (CSV via `papaparse`).

### D. Feld-Erfahrung vertiefen

- **Fotos im Rapport**: Attachments existieren projektseitig, aber der Monteur-Rapport hat keinen Foto-Upload. Vorher/Nachher-Bilder sind im Handwerk fast Pflicht. *(kleiner Aufwand, hoher Alltagswert)*
- **Kundensignatur** auf dem Rapport (Canvas → ins PDF).
- **Offline-Fähigkeit / PWA**: Monteure arbeiten in Kellern/Rohbauten. TanStack Query + Realtime-Bridge sind eine gute Basis für optimistische Offline-Mutationen. *(grösserer Aufwand)*

### E. Die «OS»-Richtung — Plattform statt Storen-App

Vom Storen-Tool zum konfigurierbaren **Betriebssystem für Handwerksbetriebe**:

- **Formular-Builder generalisieren**: Das Order-Form-CMS (`lib/order-forms/`) ist schon ein generischer Formular-Builder — dasselbe Muster auf Rapport- und Intake-Felder ausweiten (pro Organisation konfigurierbar statt hartkodiert).
- **Status-Workflow pro Organisation konfigurierbar**: Heute hartkodiert in `lib/domain/types.ts`; viel Logik hängt an den Enum-Werten (Automationen, Badge-Farben, Filter). Grösster Umbau, aber Kern der Plattform-These.
- **Self-Service-SaaS**: Registrierung, Subscription (Stripe), Org-Erstellung ohne `bootstrap:first-admin`-Script. Multi-Tenancy, RLS und Branding sind vorhanden.

### F. Auswertungen / Dashboard

Fehlt komplett: Durchlaufzeiten pro Status, offene Offerten, Umsatz pro Monat, Monteur-Auslastung. Daten liegen in `projects` / `appointments` / `time_entries` — überwiegend Lesearbeit + Charts.

---

## 3. Detailplan: Offerten (Priorität 1)

**Ziel:** Büro erstellt aus einem Projekt eine Offerte mit Positionen, generiert ein PDF im Org-Branding und versendet es per E-Mail. Statuswechsel läuft automatisch.

### 3.1 Datenmodell (neue Migrationen)

```
quotes
  id uuid pk
  organization_id uuid  → RLS wie projects
  project_id uuid       → fk projects
  quote_number text     → pro Org fortlaufend (analog project_number_counters + Trigger)
  status text           → draft | sent | approved | rejected  (eigener Lebenszyklus,
                          gespiegelt in project.status: offerte_gesendet / offerte_genehmigt)
  valid_until date
  intro_text text, outro_text text
  vat_rate numeric      → CH-MwSt., Default 8.1
  total_net / total_gross numeric  → denormalisiert für Liste
  sent_at timestamptz, sent_to_email text
  created_by uuid, created_by_display_name text   → Snapshot-Muster wie technician_reports
  created_at / updated_at

quote_line_items
  id uuid pk
  quote_id uuid fk
  position int
  description text
  quantity numeric, unit text
  unit_price numeric
  line_total numeric

price_book_items            (optional Phase 2 — Material-/Preisstamm)
  id, organization_id, name, unit, unit_price, is_active, sort_order
```

RLS-Policies analog `projects` (`current_organization_id()`), Nummernkreis-Trigger als `SECURITY DEFINER` (Muster: `20260420120000_fix_assign_project_reference_security_definer.sql`).

### 3.2 Domain & Validierung

- `lib/domain/types.ts`: `Quote`, `QuoteLineItem`, `quoteStatuses`, Labels/Badges (Muster `projectStatusLabels`).
- Statusregeln als pure functions (Muster `nextProjectStatusAfterAppointmentBooked`):
  - Offerte versendet → Projekt `offerte_gesendet`
  - Offerte angenommen → Projekt `offerte_genehmigt`
- `lib/validations/forms.ts`: `quoteSchema` (Positionen min. 1, Beträge ≥ 0, E-Mail-Validierung beim Versand).

### 3.3 Server-Seite

- `lib/db/repository.ts` (oder neu `lib/db/quotes.ts`, Datei ist bereits 2700+ Zeilen): Mapper + CRUD + `listQuotesForProject`, `getQuoteWithItems`.
- **PDF**: `lib/pdf/quote-pdf.ts` mit `pdf-lib` — Org-Logo/Name via `getOrganizationBranding`, Positionstabelle, Summen, MwSt.
- **Mail**: `lib/mail/send.ts` mit `nodemailer` (SMTP-Env-Vars in `.env.example` ergänzen); Versand-Action hängt PDF an, setzt `sent_at`, Projekt-Status, `revalidatePath` via `after()`.
- Server Actions in `app/(app)/projekte/quote-actions.ts`: create/update/delete/send, Rolle `office|admin` + `organizationId`-Check wie in `createIntakeAction`.

### 3.4 Client

- Neuer Tab/Abschnitt im **Projekt-Sheet** (`projekt-sheet-editor.tsx`): Offerten-Liste + Editor (Positionen, react-hook-form + Zod).
- Query-Keys in `lib/query/keys.ts` (`quotes.byProject(projectId)`), Invalidation-Helper in `invalidations.ts`, Realtime-Event `quote.changed` in `realtime.ts`/`publish.ts`.
- Vorbefüllung der Positionen aus `measurements_json` des letzten Rapports (Phase 2).

### 3.5 Aufwandsschätzung & Phasen

| Phase | Inhalt | Schätzung |
|---|---|---|
| 1 | Schema + CRUD + Sheet-UI (Entwurf speichern) | 2–3 Tage |
| 2 | PDF-Generierung + Download | 1–2 Tage |
| 3 | E-Mail-Versand + Status-Automation | 1–2 Tage |
| 4 | Preisstamm + Rapport-Vorbefüllung | 2–3 Tage |

---

## 4. Empfohlene Reihenfolge (gesamt)

1. **Offerten-PDF + Versand** (Abschnitt 3) — schliesst die grösste Workflow-Lücke, nutzt vorhandene Libs.
2. **Fotos im Rapport + Kundensignatur** — kleiner Aufwand, hoher Alltagswert für Monteure.
3. **Terminbestätigungen an Kunden** — klein, professionalisiert den Auftritt; nutzt die Mail-Infrastruktur aus Schritt 1.
4. **Rechnung/Export (Bexio/CSV) + Lohnexport** — macht `abrechnen` und Zeiterfassung durchgängig.
5. **Strategie-Entscheid**: vertikal bleiben (Storen perfekt bedienen) oder **Plattform** (Abschnitt E: konfigurierbare Workflows, Self-Service-SaaS) — teuer, aber skalierbar.

---

## 5. Offene Entscheide

- **SMTP-Provider** für Versand (z. B. Resend, Postmark, eigener SMTP)?
- **Rechnungen selbst erzeugen** (QR-Rechnung) oder **nur an Bexio übergeben**?
- **WhatsApp-Intake**: offizielle Business API (Kosten/Setup) vs. nur E-Mail-Intake?
- Plattform-These (E): eigener Entscheid mit Kundenfeedback — betrifft Architektur von Status-Enums und Formularen grundlegend.
