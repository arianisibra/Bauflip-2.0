---
name: monteur-workflow-klarziehen
overview: Klarer, geführter Ablauf für Admin vs. Monteur – inklusive Zugriffslogik, geführtem Projekt-Workflow und extrem einfacher Monteur-Oberfläche.
todos:
  - id: align-workflow-roles
    content: Rollen- und Status-Übergangslogik in project-workflow / guided-flow so anpassen, dass Admin alles, Monteur nur seine Steps bearbeiten kann.
    status: completed
  - id: simplify-tech-flow
    content: Monteur-Flow Mein Tag → Projekt → Rapport/Zeiten vereinfachen und konsistent auf zugewiesene Einsätze beschränken.
    status: completed
  - id: consolidate-permissions-ui
    content: UI-Komponenten für geführten Prozess so anpassen, dass Monteur klar nur seine Schritte bearbeiten kann und sonst saubere Hinweise sieht.
    status: completed
isProject: false
---

### Ziel

- **Admin**: Kann den kompletten Projekt‑Workflow steuern, Termine planen, Status wechseln, Kontakte pflegen, Offerten/Bestellungen/Rechnungen anstossen. Sieht und bearbeitet alles.
- **Monteur (technician)**: Sieht **nur seine Einsätze/Projekte** und kann **nur die für ihn vorgesehenen Schritte** bearbeiten (Rapport, Zeiten, einfache Rückmeldungen). Oberfläche extrem reduziert: **Mein Tag → Projekt → Rapport/Zeiten**, sonst nichts.
- Der Ablauf folgt dem **Storenmonteur‑Guide** (`docs/storenmonteur-workflow-landkarte.md`): klare Besitzerwechsel pro Phase und saubere Übergaben Büro ↔ Monteur.

### 1. Rollen- & Zugriffsmodell schärfen

- **Rollenquellen vereinheitlichen**
  - Sicherstellen, dass `session.role` immer konsistent mit `profiles.role` und `organization_memberships.role` ist.
  - Wo heute Fallbacks (`office`) verwendet werden (z.B. in `proxy.ts`, `getCurrentSession`), dokumentieren und bei Bedarf hart auf `technician` setzen, wenn `profiles.role = 'technician'`.
- **Admin‐Rechte**
  - In allen relevanten Server‑Actions (`einstellungen/actions.ts`, Projekt‑Actions, Import/Export) Admin automatisch erlauben.
  - Admin darf **jeden Schritt** im Workflow bearbeiten, auch „Rapport & Bestandsaufnahme“.
- **Monteur‐Rechte**
  - In `lib/workflow/project-workflow.ts` und `project-guided-flow.ts` explizit definieren, welche Status‑Übergänge für `role === 'technician'` erlaubt sind (z.B. `besichtigung → bericht_ausstehend / bericht_fertig`, `ausfuehrung_geplant → ausfuehrung_erledigt`).
  - In `project-guided-process.tsx` pro Step anzeigen, **wer zuständig ist** und ob der aktuelle User bearbeiten darf – sonst klarer Hinweis wie im Screenshot („Ihre Rolle darf diesen Schritt nicht bearbeiten“), aber nur dort, wo es wirklich Sinn macht.

### 2. Projekt-Workflow nach Guide ausrichten

- **Status & Step‑Owner klarziehen** (in `project-workflow.ts` und `project-workflow-rail.ts`):
  - Steps 1–2 (Intake, Ersttermin) → **office/admin**.
  - Step 3 „Rapport & Bestandsaufnahme“ (Status `besichtigung` / `bericht_ausstehend` / `bericht_fertig`) → **Monteur**.
  - Step 4–5 (Offerte & Freigabe, Material & Bestellung) → **office/admin**.
  - Step 6–7 (Ausführungstermin, Montage & Fertigmeldung) → **Monteur**.
  - Step 8 (Rechnung & Abschluss) → **office/admin**.
- **Validation pro Step**
  - Für Monteur‑Steps: Pflichtfelder wie Rapport‑Daten, Messwerte, Fotos/Notizen müssen gesetzt sein, bevor `technician` den Status weiterziehen darf.
  - Für Admin/Office‑Steps: Termine, Kundenkontakte, Bestellentscheid usw. validieren.

### 3. Monteur-Flow: Mein Tag → Projekt → Rapport

- `**/tag` (Mein Tag) weiter schärfen**
  - Nur Projekte anzeigen, bei denen der Monteur **als Techniker zugewiesen** ist (über `appointments.assigned_technician_id`).
  - Der Klick auf einen heutigen Einsatz führt direkt auf eine schlanke **Projekt‑/Terminansicht**, die genau das zeigt, was der Monteur braucht (Kunde, Ort, Zugang, Kurzhinweise, Status, grosser Button „Rapport ausfüllen“).
  - Offene Rapporte (Status `bericht_ausstehend`) bleiben als To‑Do‑Liste sichtbar.
- **Zugriff vom Monteur auf Projekte einschränken**
  - In `getProjectBundle`-basierten Seiten für Monteur‑Routen (`/(tech)/termine/[id]`, `/(tech)/rapport/[projectId]`) bereits umgesetzt: nur zugelassen, wenn der Monteur einem Termin des Projekts zugewiesen ist (`assignedTechnicianId === session.user.id`).
  - Diese Logik beibehalten und in neuen Monteur‑Views konsequent wiederverwenden.
- **Rapport-Erfassung**
  - `TechnicianRapportTech` so verwenden, dass der Monteur den kompletten Rapport an einer Stelle erfassen kann (Messungen, Bilder/Anhänge via Chat, Entscheidung vor Ort).
  - Status‑Wechsel („Bericht fertig“) für `technician` nur von dort aus erlauben, mit klarer Rückmeldung.

### 4. Admin-/Office-Flow: Termine & Zuweisung an Monteur

- **Termin anlegen & Monteur zuweisen**
  - Auf der Projektseite (Phase 2 „Ersttermin / Aufmass“ und Phase 6 „Ausführung“) ist Office/Admin zuständig.
  - Im Termin‑Formular sicherstellen:
    - Dropdown `Monteur` speist sich aus `listProfilesByRole("technician")` (mit korrekten Rollen in `profiles`).
    - Bei Speichern wird `assigned_technician_id` gesetzt und der Termin erscheint in **„Mein Tag“** des Monteurs.
  - Optional: ICS/Outlook‑Mail an den Monteur wie bereits in `assignAppointmentToTechnicianCalendar` umgesetzt.
- **Geführter Prozess im Büro**
  - In `project-guided-process.tsx` bleibt Office‑Sicht vollständig: alle Steps, inkl. Hinweis, wenn der Monteur noch etwas tun muss (z.B. „Rapport fehlt“).

### 5. UI-Vereinfachung speziell für Monteure

- **Monteur‑Layout (`app/(tech)/layout.tsx`)**
  - Beibehalten: schmale Spalte, Bottom‑Nav (`Mein Tag`, `Zeiten`, `Profil`).
  - Keine Sidebar, keine komplexen Filter – maximal 1–2 Aktionen pro Screen.
- `**Mein Tag`**
  - Zeigt **heute** + „Nächste Termine“ (wie bereits umgesetzt) in klarer Reihenfolge.
  - Karten enthalten Zeit, Typ (Besichtigung/Ausführung), Projektname, Kunde+Ort.
- **Projekt‑Detail für Monteur**
  - Minimale Informationen: Adresse (mit Maps‑Link), Zugangsschlüssel‑Hinweise, Arbeitsart, Notiz „für Monteur“.
  - Ein grosser Primär‑Button: **„Rapport ausfüllen“**.
- **Rapport‑Seite**
  - Einfache Struktur, keine Büro‑Felder.
  - Am Ende klarer Call‑to‑Action: „Rapport speichern“ (und ggf. „Rapport fertig melden“ = Statuswechsel).

### 6. Rechteprüfung im Code konsolidieren

- **Server-Guards**
  - In zentralen Funktionen in `lib/workflow/project-workflow.ts` und den Projekt‑Actions eine kleine Helper‑Funktion verwenden, z.B. `assertProjectStepAllowed(step, role)`, um überall die gleiche Logik zu nutzen.
- **UI-Guards**
  - Komponenten wie `project-sheet-phase-panels` und `project-guided-process` zeigen die Bearbeitungsflächen nur, wenn `canEdit` für die aktuelle Rolle true ist, sonst lesend mit einem klaren Hinweis.

### 7. Test-Szenarien

- **Admin-Szenario**
  - Als `admin` ein neues Projekt anlegen, Ersttermin planen, Monteur zuweisen, Status von Intake bis `bericht_ausstehend` und weiter prüfen.
- **Monteur-Szenario**
  - Als `technician` einloggen, auf `/tag` Einsätze sehen, Projekt öffnen, Rapport ausfüllen, Status fortsetzen.
- **Grenzfälle**
  - Monteur versucht, einen Büro‑Step zu bearbeiten → sauberer Hinweis, keine Aktion.
  - Projekt ohne zugewiesenen Monteur → erscheint nicht auf `/tag`, Auswahl im Termin‑Formular zeigt „Kein Monteur verfügbar“ nur dann, wenn wirklich niemand als `technician` existiert.

Dieses Vorgehen stellt sicher, dass der **Ablauf aus dem Guide** im System abgebildet ist: Büro/Admin steuert den Prozess und Termine, Monteur arbeitet seine klaren Schritte ab – mit einer extrem einfachen Oberfläche und nur den Rechten, die er wirklich braucht.