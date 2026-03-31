---
name: tag-monteur-feinschliff
overview: Feinschliff der /tag-Ansicht für Monteure mit mehr Kontext pro Einsatz, direktem Zugang zu Rapporten und besserem Verhalten ohne heutige Einsätze.
todos:
  - id: tag-cards-context
    content: Auf /tag mehr Kontext pro Einsatz anzeigen (Kunde, Ort, klarere Labels) ohne die Karten zu überladen.
    status: completed
  - id: tag-open-rapports-todos
    content: Sektion für offene Rapporte auf /tag als klar erkennbare To-Do-Liste für Monteure ausformen.
    status: completed
  - id: tag-empty-state-next-appointments
    content: Leerlauf-Zustand auf /tag verbessern, indem bei keinen heutigen Einsätzen die nächsten Termine angezeigt werden.
    status: completed
isProject: false
---

### Ziel

Die Ansicht `/tag` wird für Monteure so verfeinert, dass sie **ohne Tippen** sofort die wichtigsten Infos zu heutigen Einsätzen sehen (Kunde, Ort, Zugang), bei offenen Rapporten direkt starten können und bei Leerlauf einen sinnvollen Hinweis auf kommende Termine bekommen. Alles bleibt extrem einfach und iPhone‑freundlich.

### Aktueller Stand

- Layout für Monteure: `[app/(tech)/layout.tsx](app/(tech)/layout.tsx)` – prüft Rolle `technician` und rendert eine schmale Spalte mit Bottom‑Navigation (`/tag`, `/zeiten`, `/profil`).
- Mein‑Tag‑Ansicht: `[app/(tech)/tag/page.tsx](app/(tech)/tag/page.tsx)`
  - Zeigt Begrüssung und Titel „Mein Tag“.
  - Listet **heutige Einsätze** basierend auf `listWeekTasks()` – jede Karte zeigt Zeitspanne und Typ (Besichtigung/Ausführung) + Projekttitel.
  - Darunter optional **„Offene Rapporte“** – Links auf `/rapport/[projectId]`.
- Zeiterfassung: `[app/(tech)/zeiten/page.tsx](app/(tech)/zeiten/page.tsx)` – nutzt ebenfalls `listWeekTasks()` und verlinkt auf Termin‑Details.
- Termin‑Details & Rapport: `[app/(tech)/termine/[id]/page.tsx](app/(tech)/termine/[id]/page.tsx)`, `[app/(tech)/rapport/[projectId]/page.tsx](app/(tech)/rapport/[projectId]/page.tsx)` sind bereits mobil optimiert.

### Wünsche aus deiner Antwort

- **Mehr Kontext pro Einsatz** direkt auf `/tag`:
  - Kundenname + Ort.
  - (Später) Telefonnummer und Zugang-/Schlüssel‑Notiz.
  - Fokus bleibt auf **heute**, kein komplexes Wochen‑UI.
- **Aktion**: Offene Rapporte sollen von `/tag` aus direkt geöffnet werden (ist technisch schon so, kann visuell noch klarer gemacht werden).
- **Leerlauf**: Wenn keine Einsätze heute, soll `/tag` zusätzlich auf **nächste Termine** hinweisen.

### Geplanter Feinschliff

1. **Mehr Infos auf den Einsatz‑Karten auf /tag**
  - Die Datenquelle `listWeekTasks()` liefert heute bereits `projectTitle`, Status, Zeiten und Techniker‑Zuweisung.
  - Plan:
    - In `[app/(tech)/tag/page.tsx](app/(tech)/tag/page.tsx)` bei der Erzeugung der Karten ergänzen wir unter dem Titel eine zweite Zeile für **Kunde + Ort**, sofern diese Informationen über das `Project` direkt verfügbar sind (ggf. über `getProjectBundle` oder Erweiterung von `WeekTaskItem`).
    - Wenn Adresse oder Ort nicht direkt im Task vorhanden ist, nutzen wir einen kompakten Fallback wie „Details im Auftrag“ und verschieben tiefere Infos weiter in die Terminseite.
  - Ziel: Der Monteur sieht auf einen Blick, **wo** er hin muss und **für wen** der Einsatz ist.
2. **Offene Rapporte deutlicher als „To‑Dos“ kennzeichnen**
  - Die Sektion „Offene Rapporte“ existiert schon, ist aber visuell relativ ähnlich zu normalen Einsätzen.
  - Plan:
    - Titeltext anpassen auf etwas wie „Rapporte ausstehend“.
    - In den Karten einen kleinen Label „Rapport offen“/„Überfällig“ prominenter darstellen, damit der Monteur erkennt: **hier muss ich noch etwas nachholen**.
    - Optional einen kurzen erklärenden Text oberhalb der Liste (1 Zeile), z.B. „Diese Projekte brauchen noch einen Rapport von dir.“
3. **Besseres Verhalten, wenn heute keine Einsätze vorhanden sind**
  - Heute wird nur ein Hinweistext angezeigt.
  - Plan:
    - Unter dem bestehenden Hinweis eine kleine Box „Nächste Termine“ einführen.
    - Dazu in `[app/(tech)/tag/page.tsx](app/(tech)/tag/page.tsx)` neben den heutigen Aufgaben auch **kommende Aufgaben der Woche** (z.B. `tasks.filter(... > todayKey).slice(0, 3)`) berechnen.
    - Wenn vorhanden, 1–3 nächste Einsätze mit Zeit + Projekttitel als kleine Liste anzeigen, ohne das Layout zu überladen.
  - Ziel: Monteur sieht, dass heute nichts ansteht, aber morgen/übermorgen etwas kommt.
4. **Vorbereitung für Telefon/Zugang auf /tag (ohne Überladung)**
  - Du möchtest perspektivisch Telefonnummer und Zugang-/Schlüssel‑Notiz sehen, aber die Ansicht soll extrem einfach bleiben.
  - Plan für einen nächsten Schritt (optional, ohne jetzt zu implementieren):
    - Prüfen, ob `WeekTaskItem` oder ein ergänzender Call (`getProjectBundle` mit `Promise.all` begrenzt auf die 3–5 heutigen Einsätze) performant die Felder `contactPhone` und `accessNotes` liefern kann.
    - UX‑Entwurf: Telefonsymbol + sehr kurzer Zugangshinweis (1 Zeile) unterhalb des Titels, abgeschnitten bei zu viel Text.
  - In diesem Plan markieren wir das als **Folgeschritt**, damit die aktuelle Version nicht unnötig komplex wird.
5. **Copy & Kleinigkeiten**
  - Textfeinschliff in der Überschrift und Sektionen, z.B.:
    - „Heutige Einsätze“ → bleibt.
    - „Offene Rapporte“ → „Rapporte ausstehend“.
    - Hinweistext im Leerlauf ergänzt um die Info, dass kommende Termine unten angezeigt werden.
  - Sicherstellen, dass alles in **klarem, kurzem Deutsch** formuliert ist und auf kleinen iPhone‑Screens nicht umbricht.

### Ergebnis

Nach diesem Feinschliff sieht ein Monteur auf `/tag`:

- **Oben**: Begrüssung und kurzer Satz, was diese Seite ist.
- **Mitte**:
  - Karten mit heutigen Einsätzen inkl. Zeit, Typ, Kundenname und (wo möglich) Ort.
  - Tap auf eine Karte führt wie bisher zu den Termin‑Details.
- **Darunter**: Eine klar abgesetzte Liste „Rapporte ausstehend“, bei der ein Tap direkt in den Rapport führt.
- **Ganz unten bei Leerlauf**: Falls keine Einsätze heute, ein Hinweis + die nächsten 1–3 Einsätze der kommenden Tage.

Die Ansicht bleibt dabei **einspaltig, grossflächig und fingerfreundlich**, ohne Tabellen oder komplexe Filter.