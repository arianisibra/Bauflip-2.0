# Plan: Zahlungsabgleich (camt) + Bexio-Anbindung (Modell A)

> **Teil A (Z1–Z3): UMGESETZT** (Juli 2026, Commit `b0292b9`) — camt-Parser,
> Matching, Migration, `/zahlungen`-Seite mit Ampel-Vorschau + Import-Historie.
> 96/96 Tests, Typecheck/Lint/Build grün. Offen (unkritisch): echte camt-Datei
> als Realitätstest, visueller Durchklick der neuen Seite.
> **Teil B (Bexio): wartet** auf API-Token + Treuhänder-Okay.

Stand: Juli 2026, Branch `bauflip-os` (kein Merge nach `main` — Entwicklungs-Branch).
Schliesst den Geld-Kreislauf: Rechnung (fertig) → **Zahlung erkannt** → Projekt abgeschlossen,
plus **Beleg automatisch beim Treuhänder** (Bexio).

## 0. Getroffene Entscheide (aus der Analyse-Diskussion)

| Entscheid | Begründung |
|---|---|
| **Bauflip stellt die Rechnungen** (nicht Bexio) | Rechnung ist das Ende der Projekt-Kette; R1–R4 bleibt Kern; reversibel |
| **Zahlungsabgleich via camt-Upload** in Bauflip | Keine Bank-Anbindung nötig/möglich; tagesaktuell reicht; 95 % Automatik |
| **Vorschau + Bestätigen** statt Blind-Import | Bei Geld ist ein menschlicher Klick ein Feature (Fehl-Zuordnung = echter Schaden) |
| **Bexio = Beleg-Ablage** via API-Push (Modell A) | Strukturierte Daten statt PDF-Upload; Treuhänder sieht alles in Bexio |
| Kein Echtzeit-Bank-Feed | Bräuchte EBICS-/Bank-Vertrag — Kosten/Komplexität erst bei echtem Bedarf |

---

## Teil A — camt-Zahlungsabgleich (~2.5–3 Tage)

### Analyse

- **Format:** camt.053 (Tagesauszug) / camt.054 (Gutschrifts-Avis) — ISO-20022-XML, von
  jeder CH-Bank im E-Banking herunterladbar. Gutschriften stehen in `Ntry`-Elementen
  (`CdtDbtInd = CRDT`) mit **QRR-/SCOR-Referenz** in `TxDtls/RmtInf/Strd/CdtrRefInf/Ref`
  und **Valuta-Datum**. Der Parser behandelt beide Formate tolerant (Banken variieren in Nuancen).
- **Neue Dependency:** `fast-xml-parser` (klein, server-only) — Node hat keinen XML-Parser;
  Regex-Parsing wäre fahrlässig.
- **Matching ist unser Heimspiel:** Referenzen sind deterministisch aus der Rechnungsnummer
  abgeleitet und auf der Rechnung eingefroren → exaktes Matching gegen
  `invoices.payment_reference` (Status `sent`), kein Fuzzy-Raten.
- **Ampel-Logik:** Referenz + Betrag exakt = grün (auto-zuordenbar) · Referenz ok, Betrag
  abweichend = gelb «prüfen» (Teilzahlung/Skonto — nie auto-paid) · keine Referenz-Übereinstimmung
  = grau «unzugeordnet» · Rechnung bereits bezahlt = Hinweis (macht Doppel-Import harmlos).
- **`paid_at` = Valuta-Datum aus der Datei** (nicht «jetzt») → `setInvoiceStatus` bekommt
  optionales `paidAt`. Beantwortet «wann kam das Geld» auf den Tag genau.
- **Datenschutz:** Die camt-Datei wird **nicht gespeichert** (In-Memory geparst, max. ~5 MB);
  persistiert wird nur ein Import-Protokoll (wer, wann, Dateiname, n zugeordnet / n offen).

### Phasen

- **Z1 — Parser (1 Tag):** `lib/camt/parse.ts` (pure): camt-XML → `CamtCreditEntry[]`
  (Betrag, Währung, Valuta, Referenz, Zahler-Name). Unit-Tests mit synthetischen
  Spec-Fixtures (053 + 054, mit/ohne Referenz, mehrere Entries, Sammelbuchung).
- **Z2 — Matching (0.5 Tag):** `lib/camt/match.ts` (pure): Entries × offene Rechnungen →
  `matched / amountMismatch / unmatched / alreadyPaid`. Unit-Tests.
- **Z3 — UI + Persistenz (1–1.5 Tage):** Migration `payment_imports` (Protokoll) +
  `paidAt`-Erweiterung. Neue Seite **«Zahlungen»** (Sidebar, Admin/Büro): Upload →
  Vorschau-Tabelle mit Ampel → «Zuordnung bestätigen» → Rechnungen `paid` (mit Valuta) +
  Projektabschluss-Angebot wie gehabt; Import-Historie unten. Dashboard aktualisiert sich
  über die bestehende `invoice.changed`-Invalidierung von selbst.

### Verifikation

Unit-Tests der pure functions; End-to-End mit Fixture-Dateien. **User-Aufgabe (unkritisch,
später):** eine echte camt-Datei eurer Bank als Realitätstest — Banken-Nuancen fängt der
tolerante Parser, aber ein echter Beleg ist Gold wert.

---

## Teil B — Bexio-Push, Modell A (~3–4 Tage)

### Analyse

- **Auth:** Persönlicher API-Token aus dem Bexio-Konto (kein OAuth-Zirkus für eine Firma).
  **Speicherung:** neue Tabelle `organization_secrets` mit **Deny-all-RLS**
  (Counter-Muster) — Zugriff nur serverseitig über den Service-Role-Client. Der Token
  erreicht nie den Browser; das Einstellungs-Feld ist write-only («gesetzt am …»).
- **Mapping (einmalig, Admin):** Bexio-Steuersatz (`tax_id`) + Ertragskonto (`account_id`)
  — Dropdowns live aus der Bexio-API geladen, auf `organizations` gespeichert (nicht sensibel).
  Plus Verbindungstest-Button.
- **Kontakt-Matching:** `projects.bexio_contact_id` (das alte Muster, neu am Projekt):
  Suche in Bexio per Name/Mail → Treffer verwenden, sonst Kontakt automatisch anlegen.
- **Push-Zeitpunkt:** automatisch **nach erfolgreichem Versand** (Fehler blockiert den
  Versand nie — Sync-Status wird an der Rechnung sichtbar) + manueller
  «Nach Bexio übertragen»-Button für Retry/Nachzügler.
- **Idempotenz:** `invoices.bexio_invoice_id` + `bexio_synced_at` — nichts landet doppelt;
  übertragene Rechnungen zeigen einen «In Bexio»-Hinweis statt des Buttons.
- **Wichtig, ehrlich:** Bexio vergibt intern eine **eigene** Rechnungsnummer; unsere
  `RE-2026-…` wird als Titel/Referenz mitgegeben. Der Treuhänder verbucht in Bexio,
  der **Zahlungsabgleich bleibt in Bauflip** (Teil A) — Bexios Bank-Sync matcht unsere
  Referenzen nicht (bekannte, akzeptierte Grenze von Modell A).
- **Vor der Implementation:** exakte kb_invoice-/contact-Feldnamen gegen die **aktuelle**
  Bexio-API-Doku verifizieren (WebFetch) — nicht aus dem Gedächtnis bauen.

### Phasen

- **B1 — Fundament (1 Tag):** Eine Migration (Secrets-Tabelle deny-all,
  `organizations.bexio_tax_id/account_id`, `projects.bexio_contact_id`,
  `invoices.bexio_invoice_id/bexio_synced_at/bexio_sync_error`); `lib/bexio/client.ts`
  (fetch-Wrapper, Fehlerbilder 401/429); Einstellungs-Sektion «Bexio» mit Token + Verbindungstest.
- **B2 — Mapping + Kontakte (1 Tag):** Steuersatz-/Konto-Dropdowns aus Bexio;
  Kontakt-Suche/-Anlage mit Mapping am Projekt.
- **B3 — Rechnungs-Push (1–1.5 Tage):** Push nach Versand + manueller Button, Positionen
  als Custom-Positionen mit Mapping, Idempotenz, Sync-Status-Badge in der Rechnungs-Sektion;
  API-Verifikation gegen offizielle Doku als erster Schritt.

### Voraussetzungen (User, blockiert Teil A nicht)

1. **Bexio-Konto + API-Token** generieren (erst für B nötig).
2. **Treuhänder-Okay** für Modell A («fertige Rechnungen liegen als Beleg in Bexio»).

---

## Reihenfolge & Aufwand

| Schritt | Aufwand | Abhängigkeit |
|---|---|---|
| **Teil A: camt** (Z1→Z2→Z3) | 2.5–3 Tage | keine — sofort startbar |
| **Teil B: Bexio** (B1→B2→B3) | 3–4 Tage | Bexio-Token + Treuhänder-Okay |

**Empfehlung: Teil A zuerst** (kein externes Warten, grösster Eigennutzen), Teil B sobald
Token/Okay da sind. Beide Teile sind unabhängig — B kann auch entfallen oder warten, ohne
dass A etwas fehlt.

## Risiken & Gegenmassnahmen

| Risiko | Gegenmassnahme |
|---|---|
| camt-Formatvarianten je Bank | Toleranter Parser, beide Formate, Fixture-Tests + echte Datei als Realitätstest |
| Falsch-Zuordnung von Zahlungen | Nie auto-paid ohne exakte Referenz+Betrag; immer Vorschau+Bestätigen; gelb bei Abweichung |
| Bexio-API-Feldnamen veraltet im Gedächtnis | Verifikation gegen aktuelle Doku als erster B3-Schritt |
| Token-Leck | Deny-all-Tabelle, nur Service-Role, write-only-UI, nie im Client-Bundle |
| Doppel-Übertragung nach Bexio | `bexio_invoice_id`-Idempotenz; Doppel-Import camt harmlos (paid ist final) |
