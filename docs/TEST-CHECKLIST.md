# Test-Checkliste: alles aus dieser Ausbau-Runde (sicher, ohne Kundenimpact)

Deckt ab: UX-Redesign (Runden 1–6), Zahlungsabgleich (camt), Bexio-Anbindung,
Dokument-Vorlagen (D1 + D2-Fundament) und den Kalender-Statusfix. Von Anfang bis
Schluss durchtesten — **ohne die Produktions-App der Kunden zu verändern.**

---

## 0. SICHERHEIT ZUERST — bitte nicht überspringen

> **Warum das nötig ist:** Der Branch `bauflip-os` benutzt dieselbe
> **Produktions-Supabase-Datenbank** wie `main` (die neuen Migrationen wurden dort
> angewendet). Testdaten würden also in dieselbe DB geschrieben, in der echte
> Kunden arbeiten.

**Regeln, damit kein Kunde etwas merkt:**

1. **Nur lokal testen** (`npm run dev`). `bauflip-os` **NIE** auf den VPS deployen
   und **NIE** nach `main` mergen/pushen. Die Code-Änderungen sind dadurch für
   Kunden gar nicht sichtbar — sie laufen nur auf deinem Rechner.
2. **Eigene Test-Organisation + Test-Account** verwenden — **niemals** die Org
   eines echten Kunden. Alle Daten (Offerten, Rechnungen, Vorlagen, Zahlungen,
   Bexio-Mapping) sind **org-scoped (RLS)** → bleiben in deiner Test-Org und sind
   für andere Orgs unsichtbar.
3. **E-Mail-Versand nur an deine eigene Adresse** (Offerte/Rechnung senden) —
   nie an eine echte Kundenadresse.
4. **Bexio:** keinen echten Produktions-Token einer laufenden Firma verbinden.
   Nur ein **Bexio-Test-/Trial-Konto** — oder den Push weglassen (nur UI prüfen).
   Ein echter Push legt in Bexio echte Belege an!
5. **Kein erneutes destruktives `db push`.** Die Migrationen sind idempotent und
   bereits angewendet.

**Faustregel:** Solange du lokal in einer Test-Org bist und nur an dich selbst
mailst, kann kein Kunde betroffen sein.

---

## 1. Setup

```bash
git checkout bauflip-os
npm install
npm run dev      # lokal, Browser auf die angezeigte URL
```
Mit dem **Test-Account** in der **Test-Org** anmelden. Falls noch keine Test-Org
existiert: mit einem neuen Test-Nutzer über das Onboarding eine eigene Org anlegen.

---

## 2. Automatisierte Checks (100 % sicher, kein DB-Write)

Diese kannst du bedenkenlos ausführen — sie fassen keine Daten an:

```bash
npm run test:unit     # erwartet: 104 Tests, alle grün
npx tsc --noEmit      # erwartet: keine Ausgabe (0 Fehler)
npm run lint          # erwartet: keine Errors (evtl. bekannte Warnings)
npm run build         # erwartet: "Compiled successfully"
```
Abgedeckt: QR-Bill (IBAN/QRR/SCOR/Payload), camt-Parser/Matching, Kalender-
Invalidierung-Logik, Dokument-Bindungen (Offerte + Rechnung), Domain-Regeln.

---

## 3. UX-Redesign (Runden 1–6) — manuell, in der Test-Org

### 3.1 Offerten (Projekt-Sheet → Abschnitt «Offerten»)
- [ ] **«Neue Offerte»** öffnet ein **zentriertes Fenster** mit Schritt-Anzeige
      (Positionen → Details → Prüfen).
- [ ] Position(en) erfassen, «Aus Preisstamm»/«Aus Rapport» testen → **Weiter** →
      Details (Gültig bis, MwSt, Texte) → **Weiter** → Prüfen → **Offerte erstellen**.
- [ ] In der Offert-**Zeile** das **«…»-Menü**: PDF öffnen, Senden, Bearbeiten,
      Status ändern, Löschen.
- [ ] **Senden** öffnet ein **eigenes Fenster** (E-Mail an **dich selbst** + Nachricht).
- [ ] **Dark-Mode** und **Handy-Breite** kurz prüfen (Fenster wird mobil Vollbild).

### 3.2 Rechnungen (Projekt-Sheet → «Rechnungen»)
- [ ] Gleiches 3-Schritt-Fenster wie Offerten (Erstellen/Bearbeiten).
- [ ] **«Aus Offerte»-Dropdown** neben «Neue Rechnung» (bei genehmigter Offerte).
- [ ] «…»-Menü: PDF, Senden, «Nach Bexio übertragen» (nur wenn verbunden),
      Status (inkl. **bezahlt → Projektabschluss-Angebot**), Löschen.
- [ ] QR-PDF öffnet sich; Bexio-Badge erscheint nur nach erfolgreichem Push.

### 3.3 Zahlungen (Seite «Zahlungen»)
- [ ] Geführter **3-Schritt-Flow**: **Datei** → **Vorschau** (Ampel) → **Bestätigt**.
- [ ] Ampel-Badges (matched/abweichend/bereits erfasst/unklar) korrekt.
- [ ] «Zuordnung bestätigen» → Erfolgs-Screen → «Neue Datei importieren».
- [ ] *Testdatei:* eine **synthetische** camt.053/054-XML oder ein echter
      Bank-Export **deiner Test-Org** — keine Kundendatei.

### 3.4 Einstellungen (als Admin)
- [ ] **Zahlungsdaten**, **Bexio**, **Preisstamm**, **Dokumentvorlagen** erscheinen
      je als **ruhige Zeile** mit **«Bearbeiten»/«Verwalten» → Fenster** (nicht mehr
      als Dauerformular).
- [ ] Zahlungsdaten bearbeiten + speichern → Zeile zeigt IBAN/Ort.

### 3.5 Dashboard (Auswertungen)
- [ ] Drei beschriftete **Zonen**: «Projekte» · «Offerten und Rechnungen» ·
      «Team und Einsätze». KPI-Reihe oben.

### 3.6 Export-Buttons
- [ ] `/projekte`: **Abrechnungs-Export (CSV)** sieht wie ein Standard-Button aus,
      lädt CSV (Projekte im Status «abrechnen» deiner Test-Org).
- [ ] Zeiterfassung → Team: **CSV exportieren** (Lohnexport) — Standard-Button, lädt CSV.

---

## 4. Dokument-Vorlagen (D1) — der neue Word-Vorlagen-Flow

1. [ ] **Einstellungen → Dokumentvorlagen → Verwalten**: die konvertierte Vorlage
       `Dübi-Vorlage_docxtemplater.docx` (liegt auf deinem Desktop) **hochladen**.
2. [ ] In einer Offerte der Test-Org: **«…» → «Als Word (Vorlage)»** erscheint.
3. [ ] Klick → lädt eine **.docx** herunter → in Word öffnen.
4. [ ] **Erwartung:** Layout der Vorlage 1:1, gefüllt mit den echten Offert-/
       Projektdaten (Nummer, Kunde, Objekt, Positions-Tabelle, Summen, Texte).
5. [ ] Vorlage löschen / zweite hochladen / «Als Standard» setzen testen.

*(Neue Kundenvorlagen konvertierst du mit `python3 scripts/convert-carbone-docx.py
EIN.docx AUS.docx` und lädst das Ergebnis hoch.)*

---

## 5. Bexio-Anbindung (nur mit Test-Bexio-Konto!)

> **Achtung:** Ein echter Push legt in Bexio Belege an. Nur mit Trial-/Test-Konto.

- [ ] Einstellungen → Bexio → **Verbinden**: falscher Token → klare Fehlermeldung
      (kein Absturz). Gültiger **Test**-Token → «Verbunden seit …».
- [ ] Mapping-Dropdowns (Steuersatz/Ertragskonto) laden live.
- [ ] Test-Rechnung senden → automatischer Push → Badge «In Bexio»; in Bexio prüfen.
- [ ] **Offene Annahmen** (siehe `docs/PLAN-zahlungen-bexio.md`): `mwst_type`,
      Einheit pro Position, Sachbearbeiter — im Bexio-Beleg gegenprüfen.

---

## 6. Kalender-Statusfix (dieser läuft auf `main`, nicht auf `bauflip-os`)

Der Fix gegen den Kundenbug ist auf `main` (Commit `b352981`, bereits live getestet).
Gegentest (auf `main` bzw. der Live-App):
- [ ] Projekt mit Termin → Status **montagebereit** → **zweiten Termin in anderer
      Woche** buchen → zurück zum Kalender → Status springt **sofort** auf
      «abgemacht» (ohne Seiten-Refresh), kein Spinner-Flackern.

---

## 7. Was NICHT fertig ist (nicht testen — erwartet fehlend)

- **Dokument-Vorlagen PDF-Ausgabe** und **Vorlagen-Rechnung mit QR** (D2): braucht
  ein Office-Backend (LibreOffice/Gotenberg) auf dem VPS — noch nicht eingerichtet.
  Aktuell nur `.docx`-Ausgabe für Offerten.
- **Auftrag/Rapport-Vorlagen**: Infrastruktur vorhanden (`kind`), UI nur für Offerten.

---

## 8. Abschluss-Kontrolle

- [ ] Keine Fehler in der Browser-Konsole und im Dev-Server-Log.
- [ ] Testdaten liegen ausschliesslich in der Test-Org.
- [ ] `git status` sauber; **nichts nach `main`** gepusht.
