# Bauflip Downsizing — Ergebnisdokumentation

## A. Entfernte Features

- **Kanban** (globale und projektbezogene Seiten, Boards, Spalten-Umbenennung).
- **Kontakte-CRM** (Listen, Detail, Import, Kunden-Redirects).
- **Artikel** inkl. Kategorien und Artikel-Editor.
- **Rapporte** (Büro-Rapportliste, Rapport-Neu-Flows, PDF-Route für Rapporte).
- **Team-Chat, Zeiterfassung, Termine-Kalenderseite** (eigenständige `/termine`-Ansicht).
- **Bestellformular-CMS** und Lieferanten-Template-Workflows.
- **Integrationen, Import/Export**.
- **Anpassbares Dashboard / KPI-Widgets** auf der Startseite.
- **API-Routen**: Kalender-OAuth (Google/Microsoft), Zapier/bexio-Webhook, Export, Import-Templates, Supplier-PDF, Projekt-Dokument-Signed-URL-Route.
- **Chatbot-FAB** im App-Layout.
- **Diverse Komponenten** (Kanban, Guided Process, Workflow-Rail, Offerten, CSV-Import, alte Rapport-Formulare, Kontakt-Sheets, …).

**Runde 2 (zusätzlich):**

- **Separate Projekt-Notizen** (`project_notes` / `ProjectNote` im Code) — Hinweise laufen über `hints_and_notes` und `access_notes` auf dem Projekt.
- **Eigene Büro-Startseite** unter `/` — nur noch Redirect nach `/projekte` (eine zentrale Listen-/Sheet-Logik).
- **Navigationseintrag „Aufträge“** (Duplikat zur Projektliste).
- **Debug-Seite** `/debug-session`.
- **Next.js-Route** `/rapport/[projectId]` — ersetzt durch **permanenten Redirect** in `next.config.ts` nach `/auftrag/[projectId]` (Bookmarks bleiben gültig).
- **Tote Repository-Helfer**: `addProjectNote`, `listProfilesForOrganization`.

## B. Entfernte Datenbankteile

**Migration 1:** [`supabase/migrations/20260407120000_downsize_core.sql`](supabase/migrations/20260407120000_downsize_core.sql) — siehe dort für den grossen Tabellen-Drop und Status-/Report-Vereinfachung.

**Migration 2 (Runde 2):** [`supabase/migrations/20260408000000_downsize_round2.sql`](supabase/migrations/20260408000000_downsize_round2.sql)

- **Tabelle** `project_notes` (inkl. RLS/Policies durch `CASCADE`).
- **Typ** `note_type`.
- **Spalten `projects`:** `key_handling_notes`, `timing_notes`, `internal_notes`, `technician_notes`.
- **Spalten `appointments`:** `access_notes`, `key_handling_notes`.

## C. Vereinfachte Kernstruktur

**Büro (`app/(app)`):**

- `/` — **Redirect** nach `/projekte`.
- `/projekte` — zentrale Seite: Liste, Intake, Sheet (Stammdaten, Termine, Anhänge, Rapport-Historie), Demo-Hinweis wenn Supabase fehlt.
- `/projekte/[id]` — Redirect auf `?openProjectId=…` (Deep Links).
- `/mitarbeiter`, `/einstellungen` — unverändert inhaltlich schlank gehalten.

**Navigation (Sidebar):** `Projekte`, `Mitarbeiter`, `Einstellungen` (kein separater „Aufträge“-Eintrag).

**Monteur (`app/(tech)`):**

- `/tag` — Tagesübersicht, Links zu `/auftrag/[projectId]`.
- `/auftrag/[projectId]` — eine Seite mit Kopfinfo, Problem, zwei Hauptaktionen, minimalem Formular.
- `/profil` — Profil (bestehend).
- `/rapport/...` — nur noch **HTTP-Redirect** (Next-Konfiguration), keine App-Route mehr.

**Kernobjekte:** `organizations`, `organization_memberships`, `profiles`, `projects` (eingebettete Stammdaten), `appointments`, `project_attachments`, `technician_reports`.

**Datenzugriff:** [`lib/db/repository.ts`](lib/db/repository.ts) — `getProjectCore` ohne Notiz-Tabelle; Projektlisten und Kern laden explizite Spaltenlisten (`PROJECT_DB_COLUMNS`, `APPOINTMENT_DB_COLUMNS`).

## D. Performance-Fixes

- Schlanker Daten-Layer; keine parallelen `project_notes`-Queries mehr.
- Weniger Spalten pro Zeile in DB und Mappern.
- Dependencies entfernt: `@dnd-kit/*`, `pdf-lib`, `papaparse`, `nodemailer` (siehe [`package.json`](package.json)).

## E. Risiken / Migrationshinweise

- **Breaking:** Alle zuvor genannten URLs und Integrationen sind weg. **`/debug-session`** existiert nicht mehr.
- **Datenverlust Runde 2:** In `project_notes` und den entfernten Textspalten gespeicherte Inhalte gehen mit Migration `20260408000000_downsize_round2.sql` verloren — vor Produktion **Backup**.
- **Bookmarks:** `/rapport/:id` leitet nach `/auftrag/:id` um (308/ permanent laut Next).
- Nach `db push` Security/Performance Advisors in Supabase prüfen.

## F. Offene Punkte

- ESLint-Warnungen zu `<img>` in Mitarbeiter-/Einstellungs-UI (optional auf `next/image` umstellen).
