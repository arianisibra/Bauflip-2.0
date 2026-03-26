# Projekt-Sidepage QA Checkliste

Diese Checkliste dient zur vollständigen UX-/Funktionsabnahme der Sidepage in `/projekte`.

## Global
- Sidepage öffnet per Klick auf Projektzeile und URL enthält `openProjectId`.
- Sidepage schliesst sauber und entfernt `openProjectId` aus der URL.
- Workflow-Rail: aktueller Schritt erkennbar, abgeschlossene Schritte erneut aufrufbar.
- Guided-Card: „Weiter“ zeigt klare Blockertexte bei fehlenden Angaben.
- Historischer Schritt: Bearbeitung ist gesperrt, Hinweis ist sichtbar.
- Rollenprüfung: Nutzer ohne Bearbeitungsrolle sehen klare Meldung und können nicht submitten.

## Schritt 1: Auftragseingang (Stammdaten)
- Pflichtfelder (`Originalaussage`, `Zugang`, `Schlüssel`, `Zeitfenster`) sind editierbar und speicherbar.
- Kontaktwechsel setzt Ansprechpartner/Adressen sinnvoll vor.
- Objektwechsel setzt Einsatz-/Rechnungsadresse sinnvoll vor.
- Checkbox „Telefon/Mobil gleich wie Ansprechpartner“ übernimmt Werte korrekt.
- Checkbox „Rechnungsadresse gleich wie Einsatzadresse“ setzt/entkoppelt Adressen korrekt.
- „Google Maps Routenplaner öffnen“ öffnet mit gültiger Adresse.

## Schritt 2: Ersttermin
- Termin mit Beginn/Ende/Monteur speichert erfolgreich.
- Validierung greift bei fehlendem/ungültigem Termin.
- Terminliste zeigt Beginn, Ende, Monteur, Notiz korrekt.
- Termin löschen funktioniert mit Sicherheitsabfrage.

## Schritt 3: Rapport
- Rapport-Datei Upload funktioniert (Bild/PDF/Word).
- Bericht speichern funktioniert inklusive strukturierter Felder.
- Berichtliste zeigt Entscheid und Inhalte lesbar.

## Schritt 4: Offerte
- Offerte-Formular speichert Positionen und Summen korrekt.
- Finalisierung per Post und E-Mail funktioniert.
- Lagerentscheid speichern/löschen funktioniert mit Feedback.
- Blockertexte für „Weiter“ sind verständlich.

## Schritt 5: Bestellung/Wareneingang
- Lieferantenformular ist auswählbar und submitbar.
- Fallback ohne Vorlagen funktioniert weiterhin.
- Wareneingang erfasst Bestellung/Lieferschein korrekt.
- Lieferschein-PDF-Erzeugung funktioniert.

## Schritt 6: Ausführungstermin
- Zweiter Termin speichert mit Beginn/Ende/Monteur.
- Terminliste inkl. Zugang/Notiz korrekt.
- Löschen mit Sicherheitsabfrage funktioniert.

## Schritt 7: Fertigmeldung
- Fertigmeldung speichert und erscheint in Berichten.
- Interne Notizen lassen sich erfassen und werden gelistet.

## Schritt 8: Rechnung/QR
- Rechnungsvorbereitung erzeugt Rechnungsnummer automatisch.
- Finalisierung per Post/E-Mail funktioniert.
- QR-Felder werden automatisch befüllt (Betrag, Schuldnerdaten, Referenz).
- QR-Code wird erzeugt, Vorschau sichtbar, Vorschau löschbar.
- QR-Validierungsfehler geben verständliche Meldung.

## Workflow/Status
- Jede „Weiter“-Transition setzt den erwarteten `nextOwnerRole`.
- Admin/Office/Techniker dürfen nur erlaubte Transitionen ausführen.
- Audit-Eintrag für Statuswechsel enthält echten Actor-Namen.
