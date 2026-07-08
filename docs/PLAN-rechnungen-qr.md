# Plan: Rechnungen mit Schweizer QR-Rechnung

> **Status: UMGESETZT** (Juli 2026) — R1–R4 komplett auf `bauflip-os`
> (Commits `123f6f4`, `e6fb2dd`, `7694d34`, `a841dda`). Offen: Scan-Test des
> Zahlteils mit einer Banking-App durch den Betreiber; echte IBAN in
> Einstellungen → Zahlungsdaten erfassen.

Stand: Juli 2026, Branch `bauflip-os`. Schliesst den Geld-Workflow: Offerte (fertig) → **Rechnung** → Projekt-Abschluss. Folgt Abschnitt A der [ROADMAP](./ROADMAP.md), Punkt «Rechnungen».

---

## 1. Analyse — was die Untersuchung ergeben hat

### 1.1 Vorhandene Bausteine (verifiziert)

| Baustein | Status | Bedeutung für den Plan |
|---|---|---|
| `organizations.billing_*`-Spalten (`billing_iban`, `billing_creditor_name/street/postal_code/city`) | **Existieren noch auf der Remote-DB** (per SQL verifiziert) — kamen nach dem Downsizing, wurden nie gedroppt, kein Code referenziert sie | 1:1 wiederverwenden statt neu anlegen |
| Offerten-Modul (Schema, Nummernkreis, Repo, Actions, Hooks, Sheet-Sektion, PDF, Mail, Status-Validierung, Realtime) | Fertig, produktionsreif auf `bauflip-os` | Rechnungen sind strukturell eine Kopie mit anderem Lifecycle — grösster Aufwandsteil entfällt |
| `qrcode`-Package | Installiert (bisher nur MFA) | Erzeugt den Swiss QR Code als PNG-Buffer, ECC-Level M |
| pdf-lib Standard-Helvetica | In `quote-pdf.ts` etabliert | Die QR-Spec **verlangt** Arial/Frutiger/Helvetica/Liberation Sans 6–10 pt — Standard-Helvetica erfüllt das ohne Font-Embedding |
| Mail-Infra + Rate-Limit | Fertig | Versand-Flow kopieren |

### 1.2 Spec-Anforderungen (Swiss Payment Standards, SIX)

- **Zahlteil** 148×105 mm unten auf A4, **Empfangsschein** 62×105 mm links davon; Trennlinie mit Schere-Hinweis. Swiss QR Code **46×46 mm** mit **Schweizerkreuz 7×7 mm** als Overlay (zeichnen wir als Vektor in pdf-lib, kein Bild nötig).
- **Strukturierte Adressen sind Pflicht** (Typ K ist seit Nov 2025 abgeschafft): Strasse und **Hausnummer getrennt**. Konsequenz: eine Ergänzungsspalte `billing_creditor_building_number` + Heuristik-Split der Debitor-Adresse aus `projects.service_street` («Musterstrasse 12» → Strasse + Nr.; beide Felder sind optional, PLZ/Ort sind Pflicht — der Split ist damit risikofrei).
- **Referenztyp hängt an der IBAN**: IID (Stellen 5–9 der CH/LI-IBAN) im Bereich 30000–31999 = **QR-IBAN** → Referenz **QRR** zwingend (27 Stellen, Mod-10 rekursiv). Normale IBAN → **SCOR** (RF…, ISO 11649, Mod-97). Wir erkennen das automatisch — der Nutzer trägt nur seine IBAN ein.
- Payload: fixe Zeilenstruktur (SPC/0200/1 … EPD), Betrag mit Punkt und 2 Nachkommastellen, Währung CHF.
- **MwSt**: Rechnungen von MwSt-pflichtigen Firmen müssen die UID zeigen → optionale Spalte `billing_vat_number`, wird aufs PDF gedruckt wenn gesetzt.

### 1.3 Lifecycle & Statuskopplung

- Rechnung: `draft → sent → paid | cancelled`; `paid` ist final; Übergänge serverseitig validiert (Muster `canSetQuoteStatus`).
- Projekt: bleibt auf «abrechnen» bis bezahlt. `canSetProjectStatus` erlaubt «abgeschlossen» nur aus «abrechnen»/«garantiefall» — passt exakt: nach `paid` bieten wir den Abschluss als Ein-Klick-Aktion an (keine Automatik, Büro entscheidet).

### 1.4 Bewusste v1-Grenzen

Keine Teilzahlungen, keine Mahnungen, Währung fix CHF, kein Bexio (kommt ggf. später als Export). Rechnung geht auch **ohne** Offerte (freie Positionen + Preisstamm-Picker) — nicht jeder Auftrag hat eine Offerte (z. B. Reparaturen nach Rapport).

---

## 2. Umsetzung in 4 Phasen

### R1 — Stammdaten & Fundament (~0.5 Tag)
- Migration: `billing_creditor_building_number` + `billing_vat_number` auf `organizations` (Rest existiert).
- Zod: IBAN-Validierung (CH/LI, 21 Zeichen, Mod-97-Prüfung als pure function).
- «Zahlungsdaten»-Formular in Einstellungen (admin-only, Muster Preisstamm-Manager).
- Domain: `Invoice`, `InvoiceLineItem`, `invoiceStatuses`, Labels/Badges, `canSetInvoiceStatus` + Tests.

### R2 — Rechnungs-CRUD (~1–1.5 Tage)
- Migration: `invoices` + `invoice_line_items` + Nummernkreis `RE-JJJJ-NNNN` je Org — **inkl. der Advisor-Fixes von Anfang an** (RLS-Deny auf Counter, revoke auf Trigger-Funktion; Lektion aus dem Audit).
- `lib/db/invoices.ts` (Muster `quotes.ts`), Actions, Hooks, Realtime-Event `invoice.changed`.
- Sheet-Sektion «Rechnungen»: Erstellen **aus angenommener Offerte** (Positionen kopieren, Offerte referenzieren) oder frei; Editor wie Offert-Editor; Fälligkeitsdatum (Default +30 Tage).

### R3 — QR-Rechnung als PDF (~1–1.5 Tage, der fachliche Kern)
- `lib/qr-bill/reference.ts`: QRR (Mod-10 rekursiv) + SCOR (Mod-97) + QR-IBAN-Erkennung — **pure, vollständig unit-getestet**.
- `lib/qr-bill/payload.ts`: Payload-Assembly (Zeilenstruktur, Feldlängen, strukturierte Adressen) — pure, unit-getestet.
- `lib/pdf/invoice-pdf.ts`: Rechnungsdokument (Kopf/Positionstabelle wie Offerte) + exakt vermasster Zahlteil/Empfangsschein auf der letzten Seite (mm→pt-Konstanten), QR via `qrcode` + Schweizerkreuz-Vektor.
- Route `/api/invoices/[invoiceId]/pdf` (Muster Offerten-Route).
- Verifikation: gerendertes PDF visuell prüfen + **du scannst den QR mit deiner Banking-App** (der einzige Test, der wirklich zählt).

### R4 — Versand & Rundschluss (~0.5–1 Tag)
- Mail-Versand mit PDF-Anhang (bestehende Infra, Rate-Limit inklusive), `sent_at`/`sent_to_email`.
- «Als bezahlt markieren» + Hinweis/Button «Projekt abschliessen».
- Dashboard: Karte «Offene Rechnungen» (Anzahl + Summe + überfällig).
- Abrechnungs-Export: Spalte Rechnungsstatus/-nummer ergänzen.

**Gesamtschätzung: 4–5 Arbeitstage, 2 Migrationen, alles auf `bauflip-os`** (kein Kontakt mit `main`/Produktion; Migrationen sind additiv und stören die produktive App nicht, da sie neue Tabellen/Spalten betreffen).

---

## 3. Risiken & Gegenmassnahmen

| Risiko | Gegenmassnahme |
|---|---|
| QRR-/SCOR-Prüfziffern falsch → Bank lehnt ab | Pure functions mit Testvektoren aus der Spec; dein Scan-Test mit echter Banking-App vor Abschluss |
| Zahlteil-Masse ungenau → Scanner-Probleme | mm→pt-Konstanten zentral, visuelle Kontrolle gegen Musterrechnung |
| Adress-Split-Heuristik greift daneben | Beide Felder optional in der Spec; im Zweifel bleibt die Hausnummer leer |
| Alte `billing_*`-Spalten enthalten Altdaten | Beim Laden validieren; Einstellungs-Formular zeigt den Ist-Stand zum Prüfen |

## 4. Offene Punkte für dich (blockieren den Start nicht)

- **IBAN eintragen**: Sobald das Einstellungs-Formular da ist, trägst du eure (QR-)IBAN ein — vorher kann keine Rechnung versendet werden (Erstellen als Entwurf geht).
- **Scan-Test**: Am Ende von R3 brauche ich 2 Minuten von dir mit der Banking-App.
