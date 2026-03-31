---
name: monteur-iphone-ansicht
overview: Einfache, iPhone-taugliche Monteur-Ansicht mit Fokus auf heutigem Tag, Rapport und Zeiterfassung.
todos:
  - id: entry-routing
    content: Einstiegspunkt /tech klar auf die "Mein Tag"-Ansicht leiten und im Monteur-Layout eine einfache Bottom-Nav vorsehen.
    status: completed
  - id: optimize-today-view
    content: Bestehende Seite app/(tech)/tag/page.tsx als zentrale "Mein Tag"-Ansicht für iPhone optimieren (Kacheln, Texte, Abstände).
    status: completed
  - id: add-time-tracking
    content: Neue Zeiterfassungsseite im Monteur-Bereich entwerfen (Start/Stop pro heutigem Einsatz, einfache Übersicht).
    status: completed
  - id: add-profile-settings
    content: Mini-Profil-/Einstellungsseite für Monteure entwerfen mit wenigen, klar verständlichen Optionen.
    status: completed
  - id: error-and-back-nav
    content: Konsistente Rücknavigation und einfache Fehlerzustände im Monteur-Bereich vorsehen (immer Rückweg zu "Mein Tag").
    status: completed
isProject: false
---

### Ziel

Eine **sehr einfache Monteur-Ansicht**, die auf dem iPhone sofort verständlich ist: Fokus auf **heutige Einsätze**, **Rapport pro Projekt**, **Start/Stop-Zeiterfassung** und ein paar **persönliche Einstellungen**. Kein komplexes Kanban im Feld, nur der Überblick über heutige Aufgaben.

### Ist-Stand (kurz)

- Es existiert bereits ein schlankes Monteur-Layout in `[app/(tech)/layout.tsx](app/(tech)/layout.tsx)` ohne Sidebar, mit maximal 400–500px Breite.
- Die Seite `[app/(tech)/tag/page.tsx](app/(tech)/tag/page.tsx)` zeigt **"Deine Einsätze heute"** und **offene Rapporte** als Kacheln – bereits gut für Mobile.
- Über `[app/(tech)/termine/[id]/page.tsx](app/(tech)/termine/[id]/page.tsx)` sieht der Monteur Projektdetails und kann zum Rapport springen.
- `[app/(tech)/rapport/[projectId]/page.tsx](app/(tech)/rapport/[projectId]/page.tsx)` rendert das eigentliche Rapport-Formular (`TechnicianRapportTech`).
- Eine allgemeine Zeiterfassung existiert als Seite `/zeiterfassung` in der Haupt-App, ist aber nicht in die Monteur-Navigation integriert.

### Geplante Struktur der Monteur-Ansicht

- **Ein Einstiegspunkt**: `/tech` leitet direkt auf `/(tech)/tag` – **"Mein Tag"**.
- **Screen 1 – Mein Tag** (`app/(tech)/tag/page.tsx` erweitern):
  - Oben Begrüssung und Datum (bestehender Header beibehalten).
  - **Liste "Heutige Einsätze"** (bestehende Kacheln, leicht grössere Touch-Flächen).
  - **Sektion "Offene Rapporte"** (bestehend), klar getrennt mit kleinem Badge (z.B. "Überfällig").
  - **Fester Footer-Bereich** am unteren Rand mit 2–3 Haupt-Buttons:
    - **"Mein Tag"** (aktiv, zeigt diese Seite).
    - **"Zeiten"** (neue Zeiterfassungsansicht).
    - Optional ein kleines Icon für **Profil/Einstellungen**.
- **Screen 2 – Einsatz-Details & Rapport-Link** (`app/(tech)/termine/[id]/page.tsx` minimal anpassen):
  - Bestehende Struktur beibehalten (Projektinfos, Adresse, Hinweise, Button "Rapport ausfüllen").
  - Buttons **gross, vollflächig** und gut tappbar (z.B. volle Breite, 44–48px Höhe).
  - Link zurück zu "Mein Tag" unten konsistent gestylt.
- **Screen 3 – Rapport** (`app/(tech)/rapport/[projectId]/page.tsx`):
  - `TechnicianRapportTech` beibehalten.
  - Umrahmung durch einen einfachen Header (Projekttitel, Kunde, kurze Adresse) und fixe Buttons oben/unten:
    - "Zurück" zu Einsatz/Tag.
    - Klarer **"Speichern"-Button** am unteren Rand mit voller Breite.
- **Screen 4 – Zeiterfassung (neu)** unter `app/(tech)/zeiten/page.tsx`:
  - **Heutiger Einsatz** (falls gerade aktiv) mit grossem **Start/Stop-Button**.
  - Falls kein aktiver Einsatz läuft: Liste der heutigen Einsätze mit je einem kleineren Start-Button.
  - Anzeige der bisherigen Zeiten pro Einsatz (heute) in sehr einfacher Form (z.B. "1:15 h" pro Projekt).
  - Zeiterfassung basiert auf bestehenden Projekt-/Termin-IDs, um keine neue komplexe Logik zu erfinden (z.B. Speichern in einer einfachen `time_entries`-Tabelle oder bestehenden Feldern – Umsetzung folgt später).
- **Screen 5 – Mini-Einstellungen (neu)** unter `app/(tech)/profil/page.tsx`:
  - Anzeige des **Namens** und der **Rolle** des Monteurs.
  - Einfache Schalter wie **Dark Mode** (falls global vorhanden), Sprache (optional) oder "Feedback senden"-Link.
  - Kein Zugang zu System-/Organisations-Einstellungen, nur persönliche Dinge.

### UX-Richtlinien fürs iPhone

- **Touch-Ziele**: alle Haupt-Buttons mindestens 44px hoch, mit ausreichend Abstand.
- **Typografie**: max. 2 Schriftgrössen pro Screen (Titel + Body), keine langen Texte.
- **Karten/Kacheln**: jede Einsatz-Karte vollflächig tappbar (bereits so in `tag/page.tsx`, nur visuell leicht optimieren).
- **Navigation**: kein Hamburger, sondern klar sichtbare **Bottom-Nav** nur im Monteur-Bereich.
- **Performance**: vermeiden von grossen Tabellen oder verschachtelten Komponenten; straight-line Rendering mit `listWeekTasks` und Projektbundles.

### Technische Schritte (high-level, ohne Codeänderung jetzt)

1. **Navigation im Monteur-Bereich konsolidieren**
  - Sicherstellen, dass `/tech` als Startpunkt dient und direkt nach `/(tech)/tag` leitet.
  - In `layout.tsx` eine einfache Bottom-Nav hinzufügen, die auf `tag`, `zeiten` und `profil` verweist.
2. **"Mein Tag" optimieren**
  - In `[app/(tech)/tag/page.tsx](app/(tech)/tag/page.tsx)` die Kacheln leicht vergrössern und Labels klarer machen.
  - Überflüssigen Text reduzieren, Fokus auf Zeit, Titel und Art des Einsatzes.
3. **Zeiterfassung für Monteure ergänzen**
  - Neue Route `app/(tech)/zeiten/page.tsx` entwerfen, die sich auf **heutige Einsätze** und einen **Start/Stop-Flow** konzentriert.
  - Bestehende Datenquellen (`listWeekTasks`, Projekt-/Termin-IDs) wiederverwenden, um Zeiten mit Einsätzen zu verknüpfen.
  - Später: Abspeicherung an zentraler Stelle (z.B. Supabase-Tabelle für Zeitbuchungen), mit klarer Trennung zwischen Technikern und Büro-Auswertung.
4. **Mini-Profil/Einstellungen einführen**
  - Neue Route `app/(tech)/profil/page.tsx` mit Anzeige von Profil-Infos aus der Session (`session.profile`) und evtl. globalen UI-Einstellungen.
  - Nur Optionen anbieten, die den Monteur nicht verwirren (kein Rollen-/Org-Wechsel etc.).
5. **Konsistente Rückwege und Fehlerfälle**
  - Auf allen Monteur-Screens klare Back-Links zu "Mein Tag".
  - Bei `notFound()`/Berechtigungsfehlern eine einfache, verständliche Meldung anzeigen und Rückkehr zu "Mein Tag" anbieten.

### Abgrenzung

- **Kein volles Kanban** im Monteur-Interface – der Überblick über Projekte erfolgt über "Mein Tag" und Rapporte.
- **Keine Büro-/Admin-Einstellungen** im Monteur-Bereich – nur persönliche Mini-Einstellungen.
- **Keine komplexen Filter oder Suchmasken** – die Monteur-Ansicht zeigt vorrangig "heute" und offene Rapporte.

