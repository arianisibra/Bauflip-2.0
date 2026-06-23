# Performance-Pass — Büro- & Monteur-Kern

Kurzbericht: grösste Bremsen, Ursache, Änderung, erwartete Wirkung.

| Problem | Ursache | Änderung | Wirkung |
|--------|---------|----------|---------|
| Langsame „Mein Tag“-Seite (`/tag`) | **N+1:** Pro eindeutigem Projekt der Tagesliste wurde `getProjectCore` aufgerufen (je 4 parallele Queries: Projekt, Termine, Anhänge, Rapporte). | Adress- und Mieter-Kurzinfos kommen aus dem bestehenden `appointments`→`projects`-Join in `listWeekTasks` (`tenant_name`, `service_*`). Felder `tenantDisplay` / `serviceAddressShort` auf `WeekTaskItem`; `getProjectCore`-Schleife auf `/tag` entfernt. | **1 Haupt-Query + 1 Profil-Batch** statt 1 + N×4 Queries. Deutlich weniger DB-Roundtrips und kleinere Payload je Request. |
| Grosse JSON-Payload auf `/projekte` | `listProjectsForOffice` lud **alle** Projekt-Spalten (`PROJECT_DB_COLUMNS`), obwohl die Tabelle nur Liste + Sheet-Titel braucht; Details kommen per `getProjectSheetDataAction`. | Neues schmales Select `PROJECT_LIST_COLUMNS` und Typ `OfficeProjectListItem` (nur `id`, `title`, `type`, `status`, `displayLabel`). | Weniger Daten über das Netz und aus Postgres pro Listen-Request. |
| Unnötig breite Kind-Tabellen in `getProjectCore` | `select('*')` auf Anhänge und Rapporte. | Explizite Spaltenlisten `ATTACHMENT_DB_COLUMNS`, `TECH_REPORT_DB_COLUMNS`; robustes Mapping für `measurements_json` (JSON vs. String). | Kleinere Zeilen, weniger Serialisierung. |
| Doppelte Branding-Queries im selben Request | `getOrganizationBranding` konnte mehrfach pro Render-Baum aufgerufen werden. | `getOrganizationBranding` mit **`cache()`** aus `react` umschlossen (Request-Deduplizierung). | Max. ein Org-Lookup pro Request bei mehrfachen Aufrufen. |
| Session-Profil etwas schwerer als nötig | `profiles.select('*')` inkl. ggf. ungenutzter Spalten. | Explizites `select` nur für Karten-/Session-Felder. | Etwas weniger Payload pro Auth-Request. |
| Grosser initialer Client-Bundle auf `/projekte` | `ProjektSheetEditor` und `IntakeForm` lagen statisch im gleichen Chunk wie die Liste. | **`next/dynamic`** für Sheet-Editor und Intake; Editor erst wenn Sheet geöffnet. | Schnelleres erstes Interaktionsfenster; weniger JS Parse/Compile bis zur ersten Nutzung. |
| Viele Re-Renders bei Suche in der Projektliste | Jede Tastatur-Eingabe renderte alle Zeilen neu. | **`memo`**-Zeilenkomponente `ProjectTableRow` + stabile **`useCallback`**-Handler für Öffnen/Löschen. | Weniger React-Commit-Arbeit bei Filter-Updates (stabile Props für unveränderte Zeilen). |
| Fonts blockieren / gross | Vier Poppins-Gewichte (400–700). | Reduktion auf **400 + 600**, `display: "swap"`, `adjustFontFallback: true`. | Weniger Font-Bytes, schnelleres First Paint (besonders Mobile). |
| DB: Range-Scan auf `appointments.starts_at` | Filter nur über Zeitraum; ohne passenden Index mehr Heap-Reads. | Migration `idx_appointments_starts_at`, `idx_projects_org_created_at`. | Stabilere Planwahl bei Wochenansicht und Projektliste nach Organisation. |
| Leerer Bildschirm bei langsamer Monteur-Navigation | Kein `loading.tsx` unter `app/(tech)`. | `app/(tech)/loading.tsx` mit bestehendem `BauflipLoading`. | Sofortiges visuelles Feedback beim Seitenwechsel (Mobile). |

## Hinweise

- **Kein globales React-Context-State-Management** im Kern — wenig Hebel für Provider-Optimierung; Fokus lag auf Datenweg und Bundles.
- Nach Deploy: Migration `20260409000000_perf_core_indexes.sql` anwenden (`supabase db push`). Anschliessend ggf. `EXPLAIN (ANALYZE)` für `listWeekTasks`-ähnliche Queries prüfen.
- Weitere Stufen (optional): `loading.tsx` unter `app/(tech)`; serverseitiges `unstable_cache` für Projektliste mit `revalidateTag` an Server-Actions — bewusst **nicht** eingebaut, um keine veralteten Listen über User-Grenzen hinweg zu riskieren; Request-`cache()` ist sicherer für Deduplizierung innerhalb eines Requests.
