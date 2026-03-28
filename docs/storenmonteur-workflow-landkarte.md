# Storenmonteur-Workflow: Landkarte zu Bauflip (Ist)

Dieses Dokument verbindet den **realen Betriebsablauf** mit dem, was in **Bauflip 2.0** heute schon existiert: Datenfelder, Projektstatus, Screens und Rollen. Es ist die **Referenz**, um Features gezielt zu bauen — ohne generisches CRM-Denken, sondern mit **Monteur im Fokus**, **Führung** und **wenig Fehlerfläche**.

---

## Leitprinzipien (für Produkt und Entwicklung)

- **Ein gestresster Monteur** muss ohne Schulung verstehen: Was ist jetzt zu tun? Wo steht das Projekt?
- **So wenig wie möglich pro Schritt** entscheiden und klicken; die nächste sinnvolle Aktion soll **sichtbar** sein.
- **Nichts vom Kunden verlieren**: Originaltext, Zugang, Schlüssel, Zeiten — Pflichtfelder und Sprach-/Texteingabe (`VoiceTextarea`) sind dafür da.
- **Übergaben Büro ↔ Monteur** wie echte Übergaben behandeln: Notizen, Chat, Anhänge, Status — nicht „nice to have“.
- **Fehler verhindern** (Pflichtfelder vor Statuswechsel) vor „Fehler anzeigen“.
- **Mobile / Aussendienst** bei jeder neuen Ansicht mitdenken (Techniker-Navigation ist bewusst schlank: siehe unten).

---

## Rollen & Navigation (heute)

| Rolle | Sidebar (Auszug) | Rolle im Workflow |
|--------|-------------------|-------------------|
| **Admin** | volle Navigation inkl. Import, Integrationen | Freigaben, Bestellung, Rechnung, Konfiguration |
| **Office** | Übersicht, Kontakte, Termine, Projekte, Artikel, Team-Chat, Bestellformular, … | Erfassung, Termine, Offerte, Kommunikation |
| **Technician (Monteur)** | Übersicht, **Projekte**, **Termine**, **Rapporte**, **Team-Chat** | Einsatz, Rapport, keine Kontakt-Stammdaten-Fläche in der Nav |

Quelle: `lib/navigation/sidebar-config.ts`

**Monteur-Fokus:** Der Monteur soll **Projekte** und **Rapporte** schnell erreichen — das ist in der Nav schon priorisiert. Was noch fehlt, ist eine **dedizierte „Mein Einsatz“-Ansicht** (ein Screen, alles Wichtige), nicht mehr Menüpunkte.

---

## Projektstatus im System (technische Wahrheit)

Die Maschine steckt in `lib/workflow/project-workflow.ts`. Labels in `statusLabels`.

Reihenfolge (vereinfacht):  
`anfrage` → `termin_geplant` → `besichtigung` → (`bericht_ausstehend` → `bericht_fertig`) → `offerte_in_arbeit` → `offerte_gesendet` → `genehmigt` → `bestellung` → `bestellt` → `ware_eingetroffen` → `ausfuehrung_geplant` → `ausfuehrung_erledigt` → `rechnung` → `abgeschlossen`

**Besonderheit:** Von `besichtigung` gibt es im Code **zwei** Wege: direkt `ausfuehrung_erledigt` (schnell erledigt) oder `bericht_ausstehend` (Rapport nötig). Das entspricht eurer Realität „direkt lösbar“ vs. „nicht direkt lösbar“.

**Pflichtfelder** beim Übergang sind pro Schritt definiert (z. B. `intakeOriginalText`, `accessNotes`, `timingNotes`). Wo überall nur `intakeOriginalText` steht, ist das ein **technisches Platzhalter-Niveau** — für echte Qualität sollten später **sinnvolle** Pflichten pro Phase ergänzt werden (z. B. Rapport-Messdaten vor `bericht_fertig`).

---

## End-to-End: eure 18 Schritte ↔ Bauflip

Legende: **Daten** = Modell/Felder · **UI** = wo es passiert · **Gap** = fehlt oder nur teilweise

### 1. Auftragseingang

| Aspekt | In Bauflip |
|--------|------------|
| Kanal WhatsApp / Telefon / E-Mail | `Project.source`: `whatsapp` \| `telefon` \| `email` (Anfrage-Formular) |
| Kunde, Problem/Wunsch | `Intake` + `Project`: Kontaktfelder, `intakeOriginalText` |
| Nichts verlieren, chaotische Infos | `intakeOriginalText` + `VoiceTextarea` auf Anfrage und Projekt; **kein separates „Sprachnotiz“-Asset** außerhalb Text/Chat — **Gap:** strukturierte Ablage von Sprachdateien optional |

**UI:** `/anfrage/neu` — `components/app/intake-form.tsx`

### 2. Erfassung

| Aspekt | In Bauflip |
|--------|------------|
| Auftrag im System | `createIntakeAction` legt Projekt + Kontakt an |
| Kunde wählen/neu | über Intake-Kontaktfelder; Kontakte für Office in `/kontakte` |
| Bemerkungen kritisch | `intakeOriginalText`, `accessNotes`, `keyHandlingNotes`, `timingNotes`, `internalNotes` auf `Project` |

### 3. Projektanlage

| Aspekt | In Bauflip |
|--------|------------|
| Verknüpfung Kunde | `contactId`, Stammdaten-Formular |
| Projektart Reparatur / Ersatz / Neuinstallation | `Project.type`: `reparatur` \| `ersatz` \| `neuinstallation` (eure „Neumontage“ = `neuinstallation`) |
| Interne Notizen | `internalNotes`, `technicianNotes`, `hintsAndNotes`, `ProjectNote` |

**UI:** `ProjectStammdatenForm` auf `projekte/[id]` — Monteur: **read-only** (`stammdatenReadOnly`).

### 4. Terminierung (Ersttermin / Aufmass)

| Aspekt | In Bauflip |
|--------|------------|
| Termin im System | `Appointment`, `addAppointmentAction` |
| Kalender / Monteur | `assignAppointmentWithCalendarAction` (ICS-Mail); `assignedTechnicianId` |
| Benachrichtigung | E-Mail mit ICS — **Gap:** Push/In-App-Notification |

**UI:** `/termine` + Terminbereich auf Projektseite

### 5. Aufmass / Vor-Ort

| Aspekt | In Bauflip |
|--------|------------|
| Notizen & Kundeninfos sehen | Projekt-Karte „Originalaussage“, Stammdaten, Notizen |
| Fotos / Dateien | Team-Chat-Uploads (`project-files` Storage) |
| Entscheidung vor Ort | Statuswechsel `besichtigung` → `ausfuehrung_erledigt` **oder** `bericht_ausstehend` |

**Gap:** Kein geführtes „Vor-Ort-Checklist“-Wizard; alles über Projektseite + Status.

### 6. Konfiguration / Rapport

| Aspekt | In Bauflip |
|--------|------------|
| Massen, Details, was zu tun ist | `TechnicianReport`: `measurementsJson`, `summary`, `workDescription`, `outcome` |
| Grundlage Offerte/Bestellung | Daten im Rapport + Projekt — **Gap:** harte Validierung „Messdaten vollständig vor Offerte“ noch ausbaufähig |

**UI:** Rapport-Formular auf `projekte/[id]`; globale Liste `/rapporte`

### 7–8. Offerte & Versand

| Aspekt | In Bauflip |
|--------|------------|
| Offerte anlegen | `addQuoteAction`, Status `offerte_in_arbeit` → `offerte_gesendet` |
| E-Mail | `sendDocumentMailAction` (u. a. Projekt-Mail) |

### 9. Kundenfreigabe

| Aspekt | In Bauflip |
|--------|------------|
| Genehmigt | Status `genehmigt` (Übergang aus `offerte_gesendet`) |

**Gap:** Explizites „Freigabe per Mail dokumentiert“ (Anhang/Notiz) könnte geführt werden.

### 10–12. Material, Bestellentscheid, Bestellung

| Aspekt | In Bauflip |
|--------|------------|
| Lager vs. bestellen | `addStockDecisionAction` |
| Lieferantenformular | `SupplierOrderForm` + Vorlagen `listSupplierTemplates` |
| Status | `bestellung` → `bestellt` |

### 13. Lieferung & Wareneingang

| Aspekt | In Bauflip |
|--------|------------|
| Erfassung | `addDeliveryAction`, Status Richtung `ware_eingetroffen` |

### 14. Zweiter Termin / Abstimmung Kunde

| Aspekt | In Bauflip |
|--------|------------|
| Termin | weitere `Appointment`, `timingNotes` / Notizen |
| Zeitaufwand / Planung | **Gap:** kein dediziertes „geschätzte Montagezeit“-Feld auf Projekt (nur indirekt über Notizen/KPIs) |

### 15–16. Montage / Fertigmeldung

| Aspekt | In Bauflip |
|--------|------------|
| Ausführung | `ausfuehrung_geplant` → `ausfuehrung_erledigt` |
| Rapport / Zeiten | Rapport + **Gap:** Zeiterfassung-Seite existiert (`/zeiterfassung`) aber **nicht in Monteur-Nav** — prüfen ob gekoppelt |

**Sidebar:** Techniker haben keinen direkten Link zu **Zeiterfassung** — das widerspricht „Monteur zuerst“ leicht; **Empfehlung:** in Einsatz-Section aufnehmen oder in Projekt konsolidieren.

### 17–18. Rechnung & Abschluss

| Aspekt | In Bauflip |
|--------|------------|
| Rechnung | `addInvoiceAction`, Status `rechnung` |
| Abgeschlossen | `abgeschlossen` |

---

## Was im Projekt schon „führungsorientiert“ ist

- **Karte „Geführter Prozess“** auf `projekte/[id]`: zeigt aktuellen Status, **nächste** Transition (wenn Pflichtfelder da), Button „Weiter zu …“.
- **Status wechseln:** nur erlaubte Übergänge; fehlende Pflichtfelder werden **benannt** (`getMissingFieldsForTransition`).
- **Intake** betont Originaltext und Zugang/Schlüssel/Zeit — passt zu „wenn hier Mist drin ist…“.

Dateien: `app/(app)/projekte/[id]/page.tsx`, `lib/workflow/project-workflow.ts`

---

## Kritische Realität (ehrlich)

| Thema | Stand |
|-------|--------|
| Erstkontakt-Qualität | Felder + Stimme vorhanden; **kein** erzwungenes Review durch zweite Person |
| Rapport-Qualität | Schema vorhanden; **Validierung** gegen Bestellung/Offerte ausbaufähig |
| Büro ↔ Monteur | Team-Chat + Anhänge gut; **eine** Monteur-„Heute“-Ansicht fehlt |
| Statuslogik | Vorhanden; einige Übergänge nutzen `intakeOriginalText` als generische Pflicht — **verfeinern** |
| Mobile | UI muss pro Screen geprüft werden; Nav für Techniker ist schlank — **Touch-first Einsatz-Ansicht** fehlt als eigenes Modul |

---

## Daten-Referenz (Kern)

- **Projekt:** `lib/domain/types.ts` → `Project`
- **Workflow:** `lib/workflow/project-workflow.ts`
- **Anfrage:** `lib/validations/forms.ts` → `intakeSchema`
- **Termine:** `Appointment`, Kalenderfarbe Monteur: `profiles.calendar_*` + `lib/calendar/team-colors.ts`
- **Rapport:** `TechnicianReport`

---

## Empfohlene nächste Schritte (priorisiert, ohne Over-Engineering)

1. **Monteur-Dashboard „Mein Tag“** (eine Seite): offene Projekte mit nächstem Termin, große Kacheln, nächste Aktion, Link zu Rapport — **minimale** neue Logik, beste Daten nutzen.
2. **Pflichtfelder pro Status verschärfen** (Rapport-Messdaten vor `bericht_fertig`, Termin vor `termin_geplant` wo sinnvoll) statt überall nur `intakeOriginalText`.
3. **Zeiterfassung** für Rolle Techniker in der Sidebar oder nur von der Projektseite — **eine** klare Einstiegstelle.
4. **Vor-Ort-Minimal-Checklist** (3–5 Punkte) als optionales Panel auf Projektseite im Status `besichtigung`.

---

## Merksatz

Das System ist schon **prozess- und statusgetrieben** und hat die **richtigen Datenleitungen** für einen Storenbetrieb. Der nächste große Hebel ist **nicht** mehr Features in die Breite, sondern **Monteur-Alltag**: eine Ansicht, weniger Klicks, klarere Pflichten an den Übergaben, die ihr ohnehin als kritisch beschreibt.
