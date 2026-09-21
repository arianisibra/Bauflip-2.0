# Analyse Kundenwünsche Gross Storenbau — Stand 21.09.2026

Vier Wünsche des Kunden, untersucht in Code (`main`, Stand `b719dde` auf dem VPS) und in der
gemeinsamen Supabase-Datenbank. Alles hier ist gemessen oder im Code nachgelesen; Ungeprüftes ist
ausdrücklich so markiert. **Nichts wurde verändert** — weder Code noch Daten.

| # | Wunsch | Kern des Befunds |
|---|---|---|
| A | Bestellformulare nachträglich fehlerfrei ändern | 294 von 297 Rapporten lassen sich nicht mehr speichern; alte Masse unsichtbar |
| B | Vorlage «Ersatzteile» entfernen | Löschen ist von der DB gesperrt (zu Recht); «Deaktivieren» existiert, hat aber eine Falle |
| C | Neuer Status «Angebot abgelehnt» | Braucht Eintrag in `workflow_stages` **vor** dem Code-Deploy, sonst lehnt die DB jede Speicherung ab |
| D | «Werkstatt fertig» durch den Reparierenden | Knopf existiert nur im Büro; Monteur sieht Werkstatt-Projekte ohne Termin gar nicht |

---

## A · Bestellformulare nachträglich ändern

### Was passiert ist
Am **18.09.2026, 13:30–13:43** wurden alle fünf Vorlagen im Editor umgebaut
(`order_form_templates.updated_at`). Der Editor vergibt Feldschlüssel aus der Beschriftung
(`components/app/order-form-cms-editor.tsx:112` `nextKeyFromLabel`): Ist der Schlüssel noch belegt,
hängt er `_2` an. Wer ein neues Feld «Stückzahl» anlegt, **solange das alte noch existiert**, und das
alte danach löscht, bekommt `stuckzahl_2`. Genau das ist passiert.

| Vorlage | altes Feld | Rapporte | heute |
|---|---|---|---|
| STOFF | breite_total, hohe_total, stuckzahl | je 96 | neu als `…_2` |
| STOFF | saum_oben / saum_unten / volant_nr | 93 / 92 / 35 | neu als `…_2` |
| LAMELLENSTOREN | stuckzahl | 142 | neu als `stuckzahl_2` |
| STOFF, LAMELLEN, ROLLLADEN, GELENKARM | position | 96 / 141 / 34 / 24 | ersatzlos entfernt (vom Kunden bestätigt: nicht nötig) |
| STOFF | stoff_nr_2 | 73 | ersatzlos entfernt (**Absicht ungeklärt**) |
| ERSATZTEILE | aufzugsband / gurtwickler / sonstiges | 4 / 1 / 1 | ersatzlos entfernt |

### Drei Folgen
1. **Speichern scheitert.** `lib/order-forms/validate-submission.ts:60-63` wirft
   `Unbekanntes Feld „position" für Vorlage.` Der Bearbeiten-Dialog
   (`technician-report-edit-overlay.tsx:179`) sendet die gespeicherten Werte inklusive alter Schlüssel.
   Gezählt: **294 von 297** Rapporten mit Formular. Server-Log 21.09. 10:22–10:25 UTC: 7 Versuche.
2. **Alte Masse sind unsichtbar.** Die Anzeige (`lib/order-forms/filled-fields.ts`) läuft über die
   *heutigen* Vorlagenfelder. Werte unter altem Schlüssel sind gespeichert, erscheinen aber nicht.
   Beispiel 18.09., Frau Howald (STOFF): Breite 3300 / Höhe 1800 / Stk 1.
3. **Der Kunde sieht nur Englisch.** Next.js schwärzt in Produktion jede *geworfene*
   Server-Action-Meldung. Der deutsche Satz existiert im Browser nicht mehr.

### Falle beim Beheben
`updateTechnicianReportAction` (`app/(app)/projekte/actions.ts:456-474`) speichert nur das
validierte Ergebnis (nur heutige Schlüssel); `updateTechnicianReport` löscht die Formularzeilen und
fügt neu ein. **Nur die Ablehnung zu entfernen würde beim nächsten Speichern die alten Werte löschen.**

### Lösung
1. **Validierung:** Beim Bearbeiten eines bestehenden Rapports Schlüssel, die schon gespeichert waren
   und die Vorlage nicht mehr kennt, unverändert in das Ergebnis übernehmen. Neue unbekannte
   Schlüssel weiterhin ablehnen. Dafür braucht die Aktion die bisher gespeicherten Werte des Rapports.
2. **Einmalige Datenübernahme** alt → `_2` (nur wo `_2` leer ist), damit Masse wieder sichtbar und
   bearbeitbar sind. Idempotent, vorher Tabelle sichern. Wirkt auf **beide** Apps.
3. **Editor:** vor dem Entfernen eines Feldes warnen («in N Rapporten verwendet»); beim Neuanlegen
   eines gleichnamigen Feldes den frei gewordenen Schlüssel wiederverwenden statt `_2`.
4. **Meldungen:** erwartbare Fachfehler als Rückgabewert (`{ ok:false, error }`) statt `throw` —
   betrifft auch «in den Ferien» (21.09., 7×) und die Formular-Validierung.
5. **Anzeige (optional):** gespeicherte Werte ohne Vorlagenfeld unter «Frühere Felder» zeigen.

`bauflip-os` hat dieselbe Validierung (1 Treffer) — der Fix gehört auf beide Zweige.

---

## B · Vorlage «Ersatzteile» entfernen

- **Löschen ist gesperrt:** `technician_report_order_forms_template_id_fkey … ON DELETE RESTRICT`.
  ERSATZTEILE steckt in **6 Rapporten** (zuletzt 10.06.2026). Server-Log 18.09. 11:31–11:42 UTC:
  8 Löschversuche, alle mit englischem Platzhalter beim Kunden. Die Sperre ist richtig — Löschen
  würde Rapportdaten verwaisen lassen.
- **Deaktivieren existiert bereits:** Schalter «aktiv» im Editor (`order-form-cms-editor.tsx:597`,
  `updateOrderFormCmsAction` übergibt `isActive`). Deaktiviert verschwindet die Vorlage aus neuen
  Rapporten. *Live nicht getestet.*
- **Falle:** Die Bearbeiten-Aktion lädt nur aktive Vorlagen und wirft sonst
  `Unbekannte oder inaktive Bestellformular-Vorlage.` (`actions.ts:458`). Nach dem Deaktivieren
  wären die 6 alten Ersatzteile-Rapporte nicht mehr speicherbar — gleiche Fehlerklasse wie A.

### Lösung
1. Knopf «Löschen»: bei verwendeten Vorlagen stattdessen «Deaktivieren» anbieten, mit Erklärung
   und der Zahl betroffener Rapporte. Nur unbenutzte Vorlagen wirklich löschen.
2. Bearbeiten-Aktion: für **bereits vorhandene** Formularzeilen auch inaktive Vorlagen akzeptieren.
3. Sofort möglich ohne Deploy: ERSATZTEILE im Editor öffnen, «aktiv» abwählen, speichern.
   Einschränkung bis zum Fix: die 6 alten Rapporte lassen sich dann nicht bearbeiten
   (tun sie wegen A heute ohnehin nicht).

---

## C · Neuer Status «Angebot abgelehnt»

### Wie Status heute funktionieren
- `projects.status` ist **Text ohne festen Wertebereich**. Seit 18.08.2026 prüft der Trigger
  `projects_status_dynamic_check` → `validate_project_status()` jeden Wert gegen
  **`workflow_stages.key` der Organisation** (Migration `20260818160000`, von `bauflip-os`, gemeinsame DB).
- Gross Storenbau hat dort **16 Stufen**, deckungsgleich mit `projectStatuses` in `lib/domain/types.ts`.
- `main` kennt die Status **hartcodiert**; `bauflip-os` hat einen Workflow-Editor
  (`workflow-stages-manager.tsx`, `workflow-transitions-manager.tsx`) und liest die DB-Tabellen.
- Zähler und Listen-RPC gruppieren generisch nach `status` — brauchen keine Änderung.

### Was zu ändern ist (main)
| Ort | Änderung |
|---|---|
| DB `workflow_stages` | Zeile für Gross Storenbau, z. B. key `offerte_abgelehnt`, Label «OFFERTE ABGELEHNT», `sort_order` nach `offerte_gesendet` |
| DB `workflow_transitions` | `offerte_gesendet → offerte_abgelehnt` (für bauflip-os-Logik und Konsistenz) |
| `lib/domain/types.ts:7` | in `projectStatuses` aufnehmen; Label (~:387) und Farbe (~:410) |
| `projekt-sheet-editor.tsx:325` | `STATUS_PIPELINE.offerte_gesendet` um «OFFERTE ABGELEHNT» ergänzen; Folgeaktion für den neuen Status; `STATUS_ACTION_TONE` |
| `monteur-auftrag-client.tsx:228` | Beschreibung für Monteur-Ansicht |
| Filter, zod-Schemas | leiten sich aus `projectStatuses` ab — automatisch |

### Reihenfolge ist zwingend
**Erst die DB-Zeile, dann der Code-Deploy.** Umgekehrt lehnt der Trigger jedes Setzen des neuen
Status ab (`Unbekannter Status … für diese Organisation`). Die DB-Zeile allein ist harmlos.

### Offene Fachfragen
1. **Was passiert nach «abgelehnt»?** Heute zählt «Aktiv» = alles ausser `abgeschlossen`
   (hart in RPC und Client). Ein abgelehntes Angebot bliebe für immer unter «Aktiv». Vorschlag:
   Folgeknöpfe «ABSCHLIESSEN» und «NEUE OFFERTE» (→ `offerte_senden`).
2. **Altbestand:** 110 Projekte stehen auf `offerte_gesendet`. Sollen alte davon auf «abgelehnt»?
3. **Bezeichnung:** «Angebot» oder «Offerte»? Die bestehenden Status heissen durchgehend «Offerte».

---

## D · «Werkstatt fertig» durch die reparierende Person

### Ist-Zustand
- Der Knopf existiert nur im Büro-Sheet: `STATUS_PIPELINE.werkstatt → montagebereit`
  («WERKSTATT FERTIG»), geschützt durch `requireOfficeSession` (Rollen office/admin).
- Der Monteur-Bereich hat genau **eine** Aktion: `submitTechnicianReportAction`. Status ändert er
  nur indirekt über den Rapport (`nextStatus`). Seiten: `tag`, `wochenplan`, `zeit`, `auftrag/[id]`, `profil`.
- **Datenbankregeln** (`projects_read_role_based`, `projects_update_role_based`): Ein Monteur darf ein
  Projekt nur sehen/ändern, wenn er `next_owner_user_id` ist **oder** einen Termin darauf hat.
  Ein Werkstatt-Projekt ohne Termin ist für ihn unsichtbar.
- Bei Gross Storenbau stehen aktuell **0 Projekte** auf `werkstatt` und 0 auf `abholbereit` — der
  Status wird faktisch nicht benutzt, vermutlich genau wegen dieser Lücke.
- Team: Gazmend (admin, 141 Rapporte/30 T.), Konrad und Sulaiman (technician, 99 / 55).

### Lösung — zwei Bausteine
1. **Sichtbarkeit:** Im Monteur-Bereich eine Liste «Werkstatt» (Projekte der Organisation mit Status
   `werkstatt`). Dafür braucht es Lesezugriff — entweder beim Wechsel auf `werkstatt` die zuständige
   Person als `next_owner_user_id` setzen (Feld existiert, keine neue Regel nötig), oder eine enge
   Lese-Funktion nur für diesen Status.
2. **Der Knopf:** Eine eng begrenzte Server-Aktion + DB-Funktion `werkstatt_fertig(project_id)`:
   prüft Mitgliedschaft in der Organisation, Rolle technician/office/admin und **aktuellen Status =
   `werkstatt`**, setzt dann `montagebereit` und `status_updated_source = 'manual'`. Keine generelle
   Statusfreigabe für Monteure. Danach Live-Meldung `project.core_changed`, damit das Büro es sofort sieht.

### Risiken
- Eine `SECURITY DEFINER`-Funktion in `public` ist für alle angemeldeten Rollen aufrufbar — die
  Prüfungen **müssen in der Funktion** stehen (auth.uid, Organisation, Status). Danach
  `supabase db advisors` laufen lassen.
- Die Funktion liegt in der gemeinsamen DB und wirkt auch für `bauflip-os`; dort gibt es frei
  konfigurierbare Stufen — die Funktion darf nur greifen, wenn die Organisation die Stufen
  `werkstatt` und `montagebereit` besitzt.

### Offene Fachfragen
1. **Wer repariert?** Konrad/Sulaiman (Rolle technician) oder Gazmend (admin — der könnte den Knopf
   heute schon drücken)? Eine eigene Werkstatt-Person ohne Konto?
2. **Was kommt nach «Werkstatt fertig»?** Heute `montagebereit`. Passt das, oder `abholbereit`?
3. Soll beim Wechsel auf `werkstatt` eine zuständige Person gewählt werden?

---

## Zusammenhänge

- **A, B und die englischen Meldungen sind eine Fehlerklasse:** Die App prüft gegen den *heutigen*
  Stand der Vorlagen und wirft Fachfehler, die Next.js schwärzt. Wer A sauber löst
  (gespeicherte Schlüssel mitführen, inaktive Vorlagen für Altzeilen erlauben, Fehler zurückgeben
  statt werfen), löst B und den Ferien-Fall mit.
- **C und D hängen am selben Status-System**, das auf `main` hartcodiert und auf `bauflip-os`
  datengetrieben ist. Jede Status-Änderung für Gross Storenbau braucht **DB-Zeile + Code**.
- **Alles braucht einen Deploy von `main`.** Der erste Deploy entwertet offene Tabs; Punkt 6 des
  Umsetzungsplans (Hinweis «Neue Version») sollte deshalb im selben Deploy mitgehen.
- **Gemeinsame Datenbank:** Datenübernahme (A), neue Funktion (D) und Stufen-Zeilen (C) wirken sofort
  auf beide Apps. Migrationen idempotent halten, vor A die Tabelle sichern.

## Empfohlene Reihenfolge

1. **A1 + A4 + B2** (Speichern wieder möglich, ohne Verlust; verständliche Meldungen) — dringend,
   blockiert den Kunden täglich.
2. **A2** Datenübernahme `_2` — nach Klärung von «Stoff-Nr. 2», mit Sicherung und Vorab-Zählung.
3. **C** neuer Status — klein, sobald die drei Fachfragen beantwortet sind. DB-Zeile zuerst.
4. **B1 + A3** Editor absichern (Warnung, Schlüssel wiederverwenden, Deaktivieren statt Löschen).
5. **D** Werkstatt — grösster Umbau (neue Liste, neue Aktion, DB-Funktion), braucht die Fachantworten.

## Was vom Kunden zu klären ist

1. «Stoff-Nr. 2» (73 Rapporte): absichtlich entfernt?
2. Status: Bezeichnung («Angebot»/«Offerte» abgelehnt), Folgeschritt, Umgang mit den 110 offenen Offerten.
3. Werkstatt: wer repariert, welcher Status folgt, soll eine zuständige Person gewählt werden?
