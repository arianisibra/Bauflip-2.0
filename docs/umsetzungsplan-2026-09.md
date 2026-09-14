# Umsetzungsplan Bauflip — Stand 13.09.2026, 22:30

Jede Aussage hier ist am 13.09. im Code, auf dem VPS oder in der Datenbank
geprüft worden. Wo etwas **nicht** gemessen ist, steht das ausdrücklich dabei.

---

## 0. Ausgangslage

| | Stand |
|---|---|
| VPS `main` (app.gross-storenbau.ch, Port 3000) | `b719dde` vom 31.08. — seither kein Deploy |
| VPS `bauflip-os` (app.bauflip.ch, Port 3001) | `2973153` vom 19.08. |
| Lokal `main` | 6 Commits vor `origin/main`, nichts gepusht |
| Lokal `bauflip-os` (Worktree `../bauflip-os-port`) | 8 Commits vor `origin/bauflip-os`, nichts gepusht; `AGENTS.md` uncommittet geändert |
| Datenbank | Supabase Small (2 GB) seit 01.09.; **eine** Datenbank für beide Apps |
| Sanity 13.09. | `main`: tsc ✓, 17/17 Tests · `bauflip-os`: tsc ✓, 194/194 Tests |

**Wochenbilanz 06.–13.09. (Gross Storenbau):** 0 Datenbank-Timeouts, Abfragen Ø 26–136 ms
(max 537 ms), 84 Termine / 94 Rapporte / 30 Fotos / 59 neue Projekte ohne Verlust.
Spürbar schlecht: tote Knöpfe **8·23·21·35·13·10·8·5** pro Tag (veraltete Tabs),
Foto-Signieren **Ø 2,3 s / max 4,8 s**, 1× «Keine Berechtigung» nach Netzwerkfehler.

---

## 1. Reihenfolge und Blöcke

| Block | Punkte | Wann | Deploy nötig? |
|---|---|---|---|
| **A** | 10 Update-Fenster | sofort, auch spätabends | nein (nur VPS) |
| **B** | 6 Tab-Hinweis · 1 Nachladeflut · 9a Auth-Fehlermeldung · die 6 fertigen Commits | nächster Deploy, **Sonntagabend oder Werktag mit Bereitschaft am Folgemorgen** | ja, `main` und `bauflip-os` |
| **C** | 7 Suche+Status · 8 Foto-Links · 4 Fehlermeldungen · 11 Caddy-Log · 12 Wache | Werktag | 7/8/4 ja; 11/12 nein |
| **D** | 2 SSR-Umbau · 9b getClaims · 3 zstd | je eigener Block mit Messung | ja |
| **E** | 5 Commit + Deploy | Abschluss jedes Blocks | — |

**Zusammenhänge, die die Reihenfolge erzwingen:**

- **6 vor jedem weiteren Deploy.** Jeder Deploy entwertet alle offenen Tabs. Erst mit 6 im
  ausgelieferten JavaScript sehen Nutzer beim *übernächsten* Deploy einen Hinweis statt toter Knöpfe.
  Der Deploy von Block B selbst trifft die alten Tabs noch einmal ohne Hinweis → Monteure vorher informieren.
- **10 vor Montag 08:10.** Der nächste automatische Server-Update-Lauf ist Mo 14.09. 06:10 UTC
  (= 08:10 Zürich) und startet bei Bibliotheks-Updates beide Apps neu — wie am Sa 12.09. 06:40 UTC belegt.
- **7 braucht eine Migration, die sofort auf BEIDE Apps wirkt.** Beide Apps am selben Tag deployen.
- **1 und 6 teilen sich `lib/query/provider.tsx`** — zusammen ändern, einmal testen.
- **8 hängt an 4:** Die sichtbare Meldung «Fotos konnten nicht geladen werden» braucht den
  Fehlermeldungs-Mechanismus aus 4 (`getErrorMessage`), sonst kommt in Produktion Englisch an.

---

## 2. Die Punkte im Einzelnen

### Punkt 10 — Automatische Server-Updates in die Nacht legen

**Beleg.** `systemctl cat apt-daily-upgrade.timer`: `OnCalendar=*-*-* 6:00`, `RandomizedDelaySec=60m`
→ Lauf zwischen 06:00 und 07:00 UTC = 08–09 Uhr Zürich, mitten im Arbeitsbeginn. Am Sa 12.09.
06:40:12 UTC lief `unattended-upgrade` (libc6, locales, libc-dev-bin); um 06:40:19 starteten
`bauflip` **und** `bauflip-os` neu (needrestart, Standard = automatisch). Kein Absturz, aber ein Unterbruch.
Automatischer Reboot ist **nicht** aktiv.

**Was tun (VPS, als root):**
```
mkdir -p /etc/systemd/system/apt-daily-upgrade.timer.d
cat > /etc/systemd/system/apt-daily-upgrade.timer.d/override.conf <<'EOF'
[Timer]
OnCalendar=
OnCalendar=*-*-* 00:30:00 UTC
RandomizedDelaySec=15m
EOF
systemctl daemon-reload
systemctl list-timers apt-daily-upgrade.timer --no-pager
```
`systemd-analyze calendar "*-*-* 00:30:00 UTC"` wurde am 13.09. geprüft: gültig, nächster Lauf 00:30 UTC.

**Abnahme.** `list-timers` zeigt NEXT um 00:30–00:45 UTC. Nach dem ersten Nachtlauf: Journal
prüfen, dass die Dienste um ~02:30 Zürich neu gestartet haben und morgens nicht.

**Risiken.** Gering. Betrifft auch `umami.velixar.ch` (gleicher Host) — dort ist nachts ebenfalls
besser. Sicherheitsupdates kommen weiterhin täglich, nur nachts.

**Chance.** Der einzige Punkt, der ohne App-Deploy einen gemeldeten Unterbruch verhindert.

---

### Punkt 6 — Hinweis bei veraltetem Tab («Neue Version — bitte neu laden») nach `main`

**Beleg.** `main` hat keine Erkennung: 0 Treffer für `DEPLOYMENT_ID`, kein `/api/version`, kein
Banner. `bauflip-os` hat alles — und **0 tote Aktionen** in derselben Woche, in der `main` 123 hatte.
Sulaimans Sitzung lief seit 12.08. ununterbrochen (19 Tage älter als der Server).
Tote Aktionen auch sonntags ohne Nutzeraktivität (13.09.: 5) → offene Tablets laden im Hintergrund nach.

**Was übernehmen (von `../bauflip-os-port`):**

| Datei | Aktion |
|---|---|
| `lib/version/stale-deployment.ts` | neu, 1:1 |
| `lib/version/stale-deployment.test.ts` | neu, 1:1 (117 Zeilen, in `test:unit` aufnehmen) |
| `app/api/version/route.ts` | neu, 1:1 |
| `components/app/version-banner.tsx` | neu, 1:1 |
| `next.config.ts` | `resolveDeploymentId()` (Git-SHA, Fallback Zeitstempel), `deploymentId`, `env.NEXT_PUBLIC_DEPLOYMENT_ID` ergänzen |
| `lib/query/provider.tsx` | **nur** `queryCache: new QueryCache({ onError: () => void checkDeploymentVersion() })` und dasselbe für `mutationCache` |
| `app/(app)/layout.tsx`, `app/(tech)/layout.tsx` | `<VersionBanner />` einbinden |
| `proxy.ts` | `/api/version` muss ohne Anmeldung erreichbar sein. **bauflip-os löst das über `PUBLIC_API_PATHS`** (`proxy.ts:38`, eigene Liste mit `/api/intake/email`, `/api/version`, `/api/registrierung/freigabe`) — dieses Konstrukt gibt es auf `main` nicht. Auf `main` entweder `api/version` in den Matcher-Ausschluss neben `api/browser-log` aufnehmen (einfachste, geprüfte Variante) oder `PUBLIC_API_PATHS` mit nur `/api/version` nachbauen. Ohne das: 401 für abgemeldete Tabs, Banner erscheint nie. |

**Ausdrücklich NICHT übernehmen:** `PersistQueryClientProvider` / `createSyncStoragePersister`
(Offline-Funktion von bauflip-os), `service-worker-register.tsx`, `OfflineBanner`, `OutboxStatus`.
Der provider.tsx-Diff enthält das alles — nur die zwei `onError`-Haken gehören nach `main`.

**Zusatz (neu, beide Zweige):** Sobald `stale` erkannt ist, Hintergrund-Nachladen anhalten:
- `realtime-bridge.tsx` `dispatchPeerEvent`: `if (getStaleDeploymentSnapshot()) return;`
- `provider.tsx`: `refetchOnWindowFocus: () => !getStaleDeploymentSnapshot()` — die Funktionsform
  ist in TanStack erlaubt (`boolean | 'always' | ((query) => …)`, 13.09. im Typ geprüft).
Sonst erzeugt ein veralteter Tab weiter tote Aktionen, obwohl der Nutzer den Hinweis schon sieht.

**Durchgespielt am 13.09.2026 auf dem Zweig `vorbereitung/punkt-6` (main + Punkt 6) — alles bestanden:**

| Schritt | Ergebnis |
|---|---|
| Übertragung (7 Dateien, ohne Persist/SW), tsc, Lint, `test:unit` | ✓ 23/23 |
| Build A (`testA`), `/api/version` **ohne** Cookie | ✓ `{"deploymentId":"testA"}` — Proxy-Ausnahme greift |
| Angemeldeter Tab auf Build A; Build B (`testB`) + Neustart; **Fokus-Ereignis** im alten Tab | ✓ Balken erscheint nach ~2 s, Text + Knopf korrekt |
| Zweiter Fokus im veralteten Tab | ✓ **0 Anfragen** — kein Hintergrund-Nachladen mehr, keine erneute Prüfung |
| «Jetzt neu laden» | ✓ Balken weg, Tab auf `testB`, weiterhin angemeldet, `/projekte` rendert |

**Neuer Fund beim Durchspielen — die Kennung wird ZWEIMAL bestimmt.** `next.config.ts` läuft beim
Build (Client-Bundle: `NEXT_PUBLIC_DEPLOYMENT_ID` eingebacken) **und** erneut bei `next start`
(Asset-URLs `?dpl=…`). Stimmen beide nicht überein, tragen die Asset-URLs eine andere Kennung als
das Bundle → Nexts eigener Versatzschutz kann harte Neuladeschleifen auslösen. Im Test: Build mit
`NEXT_DEPLOYMENT_ID=testA`, Start ohne → Tab zeigte `dpl=74a89f2` (Git-SHA) bei `/api/version`
= `testA`. **Auf dem VPS gilt deshalb: Build und Neustart vom SELBEN Git-Stand — nie `git pull`
zwischen `npm run build` und `systemctl restart`, und nach einem Pull nie nur neu starten, ohne neu
zu bauen.** Der Deploy-Block in Abschnitt 3 hält diese Reihenfolge ein.

**Test / Abnahme (für den Deploy-Tag).**
1. `npm run test:unit` grün (inkl. stale-deployment.test.ts).
2. Lokal: `npm run build && npm start`, anmelden, Tab offen lassen; `NEXT_DEPLOYMENT_ID=test2 npm run build`
   und neu starten → im alten Tab muss innert 5 Min (oder bei Fokus) der Balken erscheinen;
   «Jetzt neu laden» lädt und der Balken verschwindet.
3. `curl -s https://app.gross-storenbau.ch/api/version` liefert `{"deploymentId":"<sha>"}` nach dem Deploy.

**Risiken.**
- Der **erste** Deploy mit 6 entwertet alle Tabs, die den Hinweis noch nicht haben (Konrad seit 28.04.,
  Gazmend seit 18.08.). → Vor dem Deploy: «Montag früh App einmal ganz schliessen und neu öffnen.»
- `next.config.ts` ruft `git rev-parse` beim Build — auf dem VPS ist ein Git-Checkout vorhanden (geprüft),
  sonst greift der Zeitstempel-Fallback.
- Der Banner blendet bei jedem Fokuswechsel eine Prüfung ein (`fetch /api/version`) — vernachlässigbar.

**Chance.** Macht **jeden künftigen Deploy** gefahrlos. Der Monteur-Bereich profitiert am meisten
(Tablets mit wochenlang offenen Tabs).

---

### Punkt 1 — Nachladeflut bei Live-Meldungen begrenzen

**Beleg.** 02.09.: 13 Termine in 78 Min, jeder Broadcast → `dispatchRealtimeEvent(…, { refetchType: "all" })`
→ `invalidateAllCalendarRangeCaches` verwirft 5 Cache-Familien und lädt **alle** gecachten Bereiche
sofort neu, auch unbeobachtete. `calendar_range_tasks_for_org`: **19'829 Aufrufe in 12 Tagen**
(gegen 4'859 `project_core_bootstrap`). Symptom «zäh, kein Fehler, nichts im Log».

**Was ich am 02.09. verworfen habe und warum (nicht wieder aufgreifen):**
`appointmentWindow` in die Live-Meldung aufnehmen → fenster-enge Invalidierung. Falsch, weil jeder
neue Termin den Projektstatus promotet (02.09. bei allen 13 Terminen belegt) und der Status auf **allen**
Kalenderkacheln des Projekts steht, auch in anderen Wochen. `invalidations.test.ts:30` sichert genau das ab.

**Was ich am 13.09. widerlegt habe:** pauschal `refetchType: "active"` für *alles*. 18 Abfragen haben
`refetchOnMount: false`; ein ungültiger, unbeobachteter **Projekt-Core** würde beim Wiederöffnen des
Sheets **nicht** nachgeladen → alter Status sichtbar. **Durch Test belegt** (Anhang A, Test 4).

**Die belegte Lösung (Anhang A, 4/4 Tests grün am 13.09.):**
- `refetchType: "active"` **nur** für die Kalender-Familien (`weekTasks`, `monthTasks`, `techMonthTasks`,
  `calendarRange`, `availabilityRange`). Beim Blättern wechselt der Query-Key → TanStack lädt einen
  ungültigen Bereich **trotz** `refetchOnMount: false` nach (Test 3). Beim Neuaufruf von `/kalender` liefert
  der Server ohnehin frische Daten (`buildKalenderDehydratedState`).
- `refetchType: "all"` **bleibt** für Projekt-Core-Keys (`core`, `coreHead`, `coreDetails`, `auftragCore`)
  und Listen — dort ist die Menge klein (pro Projekt 3–4 Keys), keine Flut, und Remount lädt sonst nicht nach (Test 4).
- Umsetzung: `invalidateProjectAdjacencies` bekommt getrennte Optionen, z. B.
  `{ refetchType: "all", calendarRefetchType: "active" }`; `realtime-bridge.tsx:64` setzt beides.
  Mutations-Hooks (eigene Änderungen) bleiben unverändert.

**Test / Abnahme.** Anhang A als `lib/query/invalidations-refetch.test.ts` aufnehmen, in `test:unit`.
Live: zwei Browser, Nutzer A legt 5 Termine hintereinander an, Nutzer B hat 15 Tage im Kalender
durchgeblättert → im Netzwerk-Tab von B pro Broadcast **1–3** Kalenderaufrufe statt 15+; B navigiert auf
einen früher besuchten Tag → dieser lädt nach und zeigt den neuen Termin/Status.

**Risiken.** Ein Tab, der `/kalender` **remountet** (Seitenwechsel hin und zurück), zeigt den vom Server
dehydrierten Bereich frisch; andere gecachte Bereiche laden erst beim Blättern. Das ist gewollt.
Verfügbarkeitsansicht (`availabilityRange`) hat dieselbe Semantik — Test 3 gilt auch dort.

**Chance.** Weniger DB-Last (Kalender-RPC ist 19'829× die häufigste), spürbar weniger Zähigkeit beim
Terminanlegen im Büro — der Fall vom 02.09.

---

### Punkt 9a — Ausfall der Anmeldeprüfung nicht als «Keine Berechtigung» melden

**Beleg.** 09.09. 11:45:05 UTC: `[bauflip] auth.getUser: {"url":".../auth/v1/user"}` direkt gefolgt von
`⨯ Error: Keine Berechtigung.`. Kette: `requireOfficeSession` → `getLayoutSession` (Schnellweg ohne
Proxy-Header nicht möglich) → `getCurrentSession` → `resolveAuthUser` → `getUser()` scheitert am
Netzwerk → `null` → `throw new Error("Keine Berechtigung.")` (`lib/auth/organization.ts:14`).
Der Nutzer war berechtigt; die Verbindung zu Supabase Auth war kurz weg.

**Was tun.**
- `lib/auth/session.ts` `resolveAuthUser`: Netzwerkfehler (kein `status`, `fetch failed`, Timeout)
  von «kein Nutzer» unterscheiden; einmal nach 300 ms wiederholen; dann
  `throw new Error("Verbindung zur Anmeldung unterbrochen. Bitte erneut versuchen.")` statt `null`.
- `proxy.ts:150`: dasselbe für den Proxy-`getUser()` — bei Netzwerkfehler **nicht** als abgemeldet behandeln
  (heute: Redirect auf `/anmeldung` bzw. 401 für `/api`), sondern Anfrage ohne Proxy-Header durchlassen;
  die Server-Action prüft dann selbst (mit Wiederholung).
- Beide Zweige.

**Offen.** Warum der Schnellweg (`getLayoutSession` mit Proxy-Headern) am 09.09. nicht griff, ist aus dem
Log nicht ablesbar (kein Request-Kontext) — vermutlich scheiterte schon der Proxy-`getUser()`.

**Test.** Unit: `getUser` wirft `TypeError: fetch failed` → erwartete Meldung, 2 Aufrufe. Live nicht
erzwingbar (Supabase müsste ausfallen) — Meldungstext im UI prüfen, indem die Action-Ausnahme simuliert wird.

**Risiken.** Gering; eine zusätzliche Wiederholung à ~110 ms nur im Fehlerfall.

---

### Punkt 7 — Suche berücksichtigt den gewählten Status (Auftrag 10.09.)

**Beleg / Konflikt.** Heute wird der Status bei aktiver Suche an drei Stellen ignoriert — **absichtlich**,
Commit `08ad340` (17.07.): Kunde fand mit gewähltem Status «nichts». Jetzt soll innerhalb des Status gesucht
werden. Vereinbart: UND-verknüpfen **und** sichtbar machen, wie viele Treffer ausserhalb liegen.

**Die drei Stellen (beide Zweige identisch, 13.09. geprüft):**
1. RPC `public.projekte_office_bootstrap` — Bedingung `v_search is not null or …` (statusweit)
2. `lib/db/repository.ts` `listProjectsForOfficePage` (Folgeseiten) — Status-Filter bei Suche übersprungen
3. `components/app/projekte-list-client.tsx` (`main`:355, `bauflip-os`:395) — `searching ? loadedProjects : …filter(...)`

**Was tun.**
- Migration `supabase/migrations/202609XX120000_projekte_search_respects_status.sql`,
  `create or replace function` auf Basis von `20260811120000_fix_projekte_search_statuswide.sql`:
  - `v_search is not null or` aus der Status-Bedingung entfernen;
  - neues Feld `otherStatusMatches` = Anzahl Suchtreffer **ausserhalb** des Filters (nur wenn `v_search`
    gesetzt und `v_filter` nicht `all`/`archived`; sonst 0);
  - «abgemacht» (Korrektur 13.09., vorher falsch notiert): Der `deferred`-Sonderpfad greift heute
    **nur ohne Suche** (`if v_filter = 'abgemacht' and v_search is null`). Mit Suche läuft es schon
    heute über den normalen Pfad — dort greift künftig einfach `status = 'abgemacht'`. **Nichts
    Zusätzliches nötig**; den `deferred`-Zweig unverändert lassen.
  - Idempotent halten ([[bauflip-supabase-deploy]]).
- `repository.ts` `listProjectsForOfficePage` (Zeile 614 ff., Folgeseiten): Zeile 66
  `if (searchQuery || listFilter === "archived") { /* statusweit */ }` — `searchQuery` aus der
  Bedingung nehmen, damit der Status-Prädikat-Block darunter auch bei Suche greift.
- Client: Bypass entfernen (`main`:355, `bauflip-os`:395); Hinweis rendern:
  «3 Treffer in ABMACHEN — **7 weitere in anderen Status.** [Alle anzeigen]» → setzt Filter `all`, behält Suche.
- **Oberflächentext ändern** — heute steht unter dem Suchfeld wörtlich «Suche durchsucht alle Projekte
  in Ihrer Organisation.» (`projekte-list-client.tsx` `main`:538, `bauflip-os`:598). Das ist nach der
  Änderung falsch und würde den Juli-Ärger provozieren. Neu z. B.: «Suche im gewählten Status — für
  alle Projekte Filter „Alle" wählen.»
- Typen: `otherStatusMatches` in Bootstrap-Typ + `queryKeys` unverändert.

**Test.** `lib/projekte/list-filter.test.ts` erweitern; RPC gegen die QA-Organisation per
`supabase db query` prüfen (Suche + Status, Zahl der Extra-Treffer); UI in beiden Apps durchklicken.

**Risiken.**
- **Migration wirkt sofort auf beide Apps.** Alter Client + neue RPC: **Seite 1** kommt aus der RPC
  (neu: nach Status gefiltert), **Seite 2+** aus dem alten `listProjectsForOfficePage` (noch statusweit,
  Zeile 66) → beim Weiterscrollen mischen sich Status in eine Liste, und der Hinweis fehlt. Kein
  Absturz, aber sichtbar inkonsistent. Deshalb: Migration **erst unmittelbar vor** dem Deploy beider
  Apps einspielen, nicht Tage vorher.
- Alte Beschwerde vom Juli kommt zurück, wenn der Hinweis fehlt oder übersehen wird → Hinweis auffällig, mit Zahl.
- Das QA-Testkonto hat 1 Projekt — für den Test ggf. ein zweites QA-Projekt anlegen (nie Kundendaten).

**Chance.** Erfüllt den ausdrücklichen Kundenwunsch, ohne den Juli-Fall zu reaktivieren.

---

### Punkt 8 — Foto-Links nicht nach jedem Speichern neu erzeugen

**Beleg.** Alle 7 langsamen Operationen der Woche = `signAttachmentUrls` (Ø 2'347 ms, max 4'829 ms,
auch bei nur 2 Fotos → Latenz beim Supabase-Storage, nicht Menge). `coreOrThrow` in
`app/(app)/projekte/actions.ts` signiert nach **jeder** der 9 Speicher-Aktionen alle Fotos neu.
Weitere Aufrufer: `getProjectSheetBootstrapAction`, `getProjectSheetDetailsAction`, `app/(app)/actions.ts:195`
(Upload, 1 Foto), `app/(tech)/auftrag-data-actions.ts:69` und `:84` (Monteur). Links gelten 3'600 s.
`repository.ts:2559` schluckt Fehler still (`if (error || !data) return attachments;`) → Projekt öffnet
**ohne Bilder, ohne Meldung** (02.09. 10:02, 504 vom Storage).

**Was tun.**
1. `coreOrThrow` (nach Mutationen) **nicht** mehr signieren.
2. `primeCore` (`lib/query/hooks.ts:563`): beim Übernehmen des Cores vorhandene `signedUrl` je Anhang-ID
   aus dem Cache beibehalten, wenn der neue Anhang keine hat.
3. `ProjectAttachment` um `signedUntil?: string` ergänzen; beim Öffnen (Bootstrap/Details/Monteur-Open)
   weiterhin signieren und `signedUntil = now + 3600 s` setzen.
4. Ablauf: bei Fokus oder Sheet-Öffnen, wenn `signedUntil` < 5 Min → nachsignieren (eigene kleine Action).
5. `signAttachmentUrls`: Fehler **protokollieren** (`console.warn` mit Ursache) und `signError: true`
   zurückgeben; UI: «Fotos konnten nicht geladen werden — [Erneut versuchen]».
6. Beide Zweige; Monteur-Pfad (`monteur-auftrag-client.tsx:457–717` nutzt `signedUrl`) mittesten.

**Test.** Unit für den Merge in `primeCore`. Live: Projekt mit Fotos öffnen, Notiz speichern → im
Server-Log **kein** `signAttachmentUrls` für den Speichervorgang; Bilder bleiben sichtbar; nach 1 h
simuliertem Ablauf (Zeit im Test verschieben) laden sie nach.

**Risiken.** Sheet länger als 1 h offen ohne Fokuswechsel → abgelaufene Links, bis Schritt 4 greift.
Neue Fotos von anderen Nutzern (Live-Meldung `attachment.changed`) kommen ohne Link → Schritt 4 muss
auch dann signieren. Die Storage-Latenz selbst bleibt — wir treffen sie nur seltener.

**Chance.** Bis zu 4,8 s weniger pro Speichervorgang in Projekten mit Fotos; Ausfälle werden sichtbar.

---

### Punkt 4 — Fehlermeldungen fertigstellen (`cfcd8d4`, UNFERTIG)

**Beleg.** Next ersetzt `error.message` aus Server-Code in Produktion durch einen englischen
Platzhalter/React-Code; `lib/errors/friendly-message.ts` filtert das. 12 Komponenten umgestellt,
**offen (13.09. gezählt):**

| Datei | Zeile |
|---|---|
| `components/app/projekt-sheet-editor.tsx` | 1012 |
| `components/auth/onboarding-form.tsx` | 48 |
| `components/auth/mfa-setup-form.tsx` | 66, 118 |
| `app/(app)/actions.ts` | 205, 240, 283 (Rückgabe `error: …` an Client) |
| `app/(app)/projekte/actions.ts` | 473 (Validierung, serverseitig — Text bleibt erhalten, prüfen) |
| `app/(tech)/actions.ts` | 61, 85 |
| `lib/query/hooks.ts` | 199 — nur Typ-Verengung, **keine** Meldung, kann bleiben |

**Was tun.** Alle Client-Stellen auf `getErrorMessage(err, "…")`; Server-Actions, die `{ error: string }`
zurückgeben, liefern den deutschen Text bereits explizit — dort sicherstellen, dass keine Next-Redaktion
dazwischenliegt (Fehler wird gefangen, nicht geworfen → ok). Danach `cfcd8d4` per `--amend`/Folge-Commit
als fertig markieren und **nach `bauflip-os` übertragen** (einziger nicht übertragener Commit).

**Test.** Der auslösende Fall: Bestellformular, Feld «Ausladung» mit Text statt Zahl → Meldung
«„Ausladung" muss eine Zahl sein.» in der **Produktions-Build** (`npm run build && npm start`), nicht nur in dev.

**Risiken.** Gering; reine Anzeige. Ohne Produktions-Build-Test bleibt der Effekt unbewiesen.

---

### Punkt 11 — Zugriffe in Caddy protokollieren

**Beleg.** Caddyfile hat 0 `log`-Direktiven; Antwortzeiten aus Kundensicht sind nicht messbar.
Caddy v2.11.4; `/var/log/caddy` existiert, gehört `caddy:caddy`. Testkonfiguration am 13.09. validiert —
einziger Fehler war «permission denied» beim Öffnen der Logdatei, weil `validate` als `ubuntu` lief.

**Was tun (VPS):**
```
app.gross-storenbau.ch {
    reverse_proxy localhost:3000
    log {
        output file /var/log/caddy/gross-storenbau.log {
            roll_size 20mb
            roll_keep 5
            roll_keep_for 168h
        }
    }
}
```
`sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` (als root!) →
`sudo systemctl reload caddy` (**nicht** restart; ein Caddy bedient drei Hosts).

**Abnahme.** `tail -f /var/log/caddy/gross-storenbau.log` zeigt JSON mit `duration` je Anfrage.
`vorfall-bericht.sh` um eine Auswertung «langsamste Anfragen laut Caddy» erweitern.

**Risiken.** Enthält IP-Adressen → 7 Tage Aufbewahrung, nicht länger. Bei Tippfehler im Caddyfile
bleibt der alte Zustand aktiv (`reload` lehnt ungültige Konfiguration ab).

---

### Punkt 12 — Tägliche Gesundheitswache

**Beleg.** Swap der DB-Maschine: 0 → 45 → 96 → **104 MB** (01./02./10./13.09.); Probleme fielen bisher
nur durch Kundenmeldung auf. Auf dem VPS: **kein** `psql`, **kein** `supabase` CLI; vorhanden: node, curl,
jq, crontab (0 bestehende Einträge); `SUPABASE_SERVICE_ROLE_KEY` liegt in `.env.production`.

**Was tun.** Skript `/usr/local/bin/bauflip-wache.sh` (Cron `20 5 * * *`; der VPS läuft in
`Etc/UTC` und Cron ohne eigene Zeitzone — 13.09. geprüft — also 05:20 UTC = 07:20 Zürich):
- Journal beider Dienste (Vortag): tote Aktionen, langsame Operationen (+ max ms), Timeouts, `⨯`.
- Metrik-Endpunkt (`/customer/v1/privileged/metrics`, Basic-Auth `service_role:<key>`):
  `node_memory_Swap*`, `node_vmstat_pswp*`, `pg_stat_database_blks_read_total` — DB-Statistik ist
  dort verfügbar (13.09. geprüft), psql nicht nötig.
- Schwellen: Swap > 300 MB, Timeouts > 0, tote Aktionen > 20, langsam > 10 → **Alarm**.
- Ausgabe nach `/var/log/bauflip-wache/YYYY-MM-DD.txt`.
- **Offen: Alarmkanal.** Kein Mailversand konfiguriert. Optionen: Datei + wöchentlich anschauen; oder
  Webhook (Slack/Telegram) — Entscheidung nötig.

**Risiken.** Der Schlüssel liegt bereits auf dem VPS; das Skript muss `0700` sein und den Schlüssel nie loggen.

---

### Punkt 3 — Kompression (herabgestuft)

**Beleg (13.09., korrigiert).** Caddy hat `encode gzip` **nur** bei `umami.velixar.ch`. Das
`content-encoding: gzip` auf app.gross-storenbau.ch kommt von **Next.js selbst** (Doku: «By default,
Next.js uses gzip … when using `next start`»). Diese Caddy-Installation kann `gzip` und `zstd`, **kein Brotli**.

**Folge.** Kein Einzeiler. Für zstd bräuchte es `compress: false` in `next.config.ts` **plus**
`encode zstd gzip` in Caddy für beide Bauflip-Hosts → App-Deploy. Nutzen ungemessen.

**Wenn überhaupt:** vorher/nachher messen (`curl -H 'Accept-Encoding: zstd' -o /dev/null -w '%{size_download}'`
auf die grössten Chunks). Erst dann entscheiden. **Nicht in Block B.**

---

### Punkt 2 — SSR-Umbau (`/kalender`, `/projekte`, `/tag`)

**Beleg.** Alle drei Seiten sind `force-dynamic`, lesen `searchParams` serverseitig und dehydrieren
Daten (`QueryHydrationBoundary`). Trotzdem liefert das HTML nur den Suspense-Platzhalter, weil die
Client-Komponenten `useSearchParams()` aufrufen → Client-Rendering bis zur Suspense-Grenze, die die ganze
Seite umschliesst (Next-Doku `use-search-params.md:82`). 2,43 MB JS (0,70 MB gzip) müssen ausgepackt
und ausgeführt werden, bevor etwas erscheint: 1,5–2,7 s. **`useSearchParams()`-Stellen (bauflip-os):**
`projekte-list-client:298`, `kalender-page-client:10`, `projekte-page-client:33`, `admin-calendar:485`,
`kalender-sheet-context:46`, `tech-calendar:91` (Wochenplan), `calendar-sync-settings:28` (Einstellungen),
`auth-hash-client:16`. **`/tag` nutzt kein `useSearchParams`** — dort zuerst per `curl` prüfen, ob das HTML
bereits Inhalt hat; ggf. ist `/tag` schon fertig.

**Was tun (je Seite, zuerst bauflip-os, messen, dann main):**
1. Server-Page reicht den bereits gelesenen URL-Zustand als Props (`urlState`) an die Client-Komponente.
2. Client: `useSearchParams()` aus dem Render-Pfad entfernen; URL-Änderungen weiterhin über `router.push`;
   Rücksynchronisation über `useEffect` auf die Props (Next reicht neue `searchParams` bei Navigation).
3. Wo ein echtes Lesen der Client-URL nötig ist (`auth-hash-client`, Hash-Fragment): in eine kleine
   Leaf-Komponente mit eigener `<Suspense>` isolieren, damit nur sie client-rendert.
4. Nach jedem Schritt messen: `curl -s <url> | grep -c "Kalender wird geladen"` muss 0 werden,
   TTFB, und Lighthouse LCP auf einem gedrosselten Profil (Surface-Pro-Format, 14 Mbit/s).

**Risiken.** Der Kalender ist empfindlich ([[kalender-server-action-warteschlange]]); jede Änderung
mit den Schnellklick-Tests aus dem Live-Test vom 01.09. gegenprüfen (10 Sprünge, Monatsletzter).
Hydration: Server- und Client-Zustand müssen aus **derselben** Quelle kommen (Props), sonst React #418.
Aufwand: mindestens ein voller Tag pro Zweig.

**Chance.** Die grösste spürbare Verbesserung für den Kunden: sichtbarer Inhalt beim ersten Byte.

---

### Punkt 9b — Anmeldung lokal prüfen (`getClaims()`)

`getUser()` läuft pro Anfrage über das Netz (~110 ms, 14'162×/Tag am 01.09.). `getClaims()` prüft das JWT
lokal, braucht aber **asymmetrische Signaturschlüssel** im Supabase-Projekt — betrifft **beide** Apps und
jede Anmeldung. Eigener Block: Schlüssel im Dashboard umstellen (Supabase rotiert kontrolliert), beide Apps
anpassen, auf QA-Konto testen, dann ausrollen. Nicht mit anderem mischen.

---

## 3. Deploy-Ablauf (Block B als Vorlage)

**Vorher**
- [ ] Punkt 10 ist aktiv (kein Update-Neustart am Folgemorgen).
- [ ] Beide Zweige: `tsc`, `test:unit`, `npm run build` grün; Diff gezeigt und **ausdrücklich freigegeben**.
- [ ] `./scripts/zweig-abgleich.sh` in beide Richtungen: keine unbeabsichtigte Lücke.
- [ ] Monteure informiert: «Morgen früh App einmal ganz schliessen und neu öffnen.»
- [ ] Zeitfenster: Sonntagabend **oder** Werktag mit Bereitschaft bis 09:00 am Folgetag.

**Deploy (je App, Reihenfolge `bauflip-os` zuerst, dann `main`)**
```
ssh ubuntu@179.237.81.89
cd /var/www/bauflip-os        # bzw. /var/www/bauflip
git checkout -- package-lock.json   # bauflip-os: seit 19.08. durch `npm install` verändert (63+/49−), sonst blockiert git pull
git pull origin bauflip-os    # bzw. origin main
set -a && source .env.production && set +a   # PFLICHT vor dem Build: NEXT_PUBLIC_* werden eingebacken
npm install                   # so bisher gemacht (Shell-Verlauf); npm ci wäre sauberer, ändert aber ggf. das Lockfile-Verhalten
npm run build                 # erzeugt NEXT_PUBLIC_DEPLOYMENT_ID aus dem Git-SHA (Punkt 6)
sudo systemctl restart bauflip-os   # bzw. bauflip
curl -s https://app.bauflip.ch/api/version
```
**Belegt am 13.09. aus dem Shell-Verlauf des VPS** — so wurde bisher deployt:
`cd /var/www/bauflip && git pull && set -a && source .env.production && set +a && npm run build && sudo systemctl restart bauflip`
(eine ältere Variante ohne `source`, mit `npm install`). Kein Deploy-Skript vorhanden.
Die systemd-Units laufen als `ubuntu`, `WorkingDirectory=/var/www/<app>`, `EnvironmentFile=.env.production`,
`ExecStart=npm run start -- -p 3000|3001`. **Die `EnvironmentFile` gilt nur zur Laufzeit** — deshalb
das `source` vor `npm run build`; ohne das fehlen Supabase-URL, Anon-Key und Turnstile im Bundle
und die App startet mit leeren Werten (kein Build-Fehler!).

**Nachher**
- [ ] `vorfall-bericht.sh` und `DIENST=bauflip-os` — keine `⨯`, keine Timeouts.
- [ ] Anmelden, Projekt öffnen, Termin im QA-Projekt anlegen, Kalender blättern.
- [ ] Am Folgemorgen 08:00: tote Aktionen sollten nach dem Neuladen der Monteure auf 0 fallen;
  danach bei jedem weiteren Deploy erscheint der Hinweis.

**Rollback**
```
git checkout b719dde      # bzw. 2973153 für bauflip-os
npm ci && npm run build && sudo systemctl restart bauflip
```
Migration von Punkt 7 ist **nicht** per Code-Rollback rückgängig — dafür die Vorgängerfunktion aus
`20260811120000_fix_projekte_search_statuswide.sql` als Down-Migration bereithalten.

---

## 4. Risiko-Matrix

| Punkt | Wahrscheinlichkeit | Auswirkung | Minderung |
|---|---|---|---|
| 6 erster Deploy entwertet alte Tabs | hoch (sicher) | 1× tote Knöpfe bis Neuladen | Vorabinfo, Sonntagabend |
| 6 Kennung Build ≠ Kennung Laufzeit (`git pull` zwischen Build und Restart, oder Restart ohne Rebuild) | gering, aber leicht zu verursachen | Asset-URLs passen nicht zum Bundle → Neuladeschleifen | Deploy-Block wörtlich: pull → build → restart, nie umgekehrt; nach jedem Pull neu bauen |
| 1 veraltete Daten in unbeobachteten Cores | ausgeschlossen durch Design | — | Core-Keys bleiben `all`; Test Anhang A |
| 7 Juli-Beschwerde kommt zurück | mittel | Nutzer findet «nichts» | Hinweis mit Zahl + «Alle anzeigen» |
| 7 Migration vor Deploy der zweiten App | mittel | Seite 1 gefiltert, Seite 2+ statusweit → gemischte Liste | Migration erst unmittelbar vor dem Deploy beider Apps |
| 8 abgelaufene Links in lang offenen Sheets | mittel | Bilder fehlen nach 1 h | `signedUntil` + Nachsignieren bei Fokus |
| 10 Nachtlauf startet Dienste um 02:30 | sicher, gewollt | Sekunden nachts | — |
| 11 ungültige Caddy-Konfig | gering | reload wird abgelehnt, alter Zustand bleibt | `validate` als root |
| 2 Hydration-Fehler beim Umbau | mittel | Kalender lädt endlos | Props als einzige Quelle; Schnellklick-Tests |
| Build ohne `source .env.production` | mittel (leicht zu vergessen) | App startet mit leeren `NEXT_PUBLIC_*`-Werten, **kein Build-Fehler** | Deploy-Block in Abschnitt 3 wörtlich abarbeiten; nach dem Start `/anmeldung` aufrufen und Login prüfen |
| `git pull` scheitert am veränderten Lockfile (bauflip-os) | hoch (sicher beim ersten Mal) | Deploy bricht ab, alter Stand läuft weiter | `git checkout -- package-lock.json` vor dem Pull |
| Storage-Latenz (Supabase) | ausserhalb unserer Kontrolle | 2–5 s | nur seltener treffen (8) |

---

## 5. Bewusst NICHT tun

- `appointmentWindow` in Live-Meldungen (verengt die Invalidierung, reaktiviert Status-Bug).
- `refetchType: "active"` pauschal (Remount mit `refetchOnMount: false` lädt nicht nach).
- `encode … br …` in Caddy (Modul fehlt); zstd nur mit Messung und App-Deploy.
- Mergen zwischen den Zweigen (167 : 24 Commits Divergenz) — einzeln nachziehen, Quell-Hash nennen.
- `PersistQueryClientProvider`/Service-Worker nach `main` — Offline-Funktion ist bauflip-os-spezifisch.

## 6. Offene Entscheidungen für Arianis

1. Deploy-Fenster für Block B (Sonntagabend vs. Werktag) und wer Montagfrüh erreichbar ist.
2. Alarmkanal für Punkt 12 (Datei / Webhook).
3. Punkt 3: zstd mit Messung angehen oder streichen.
4. Punkt 7: Formulierung des Hinweises im UI («… weitere in anderen Status — Alle anzeigen»).
5. ~~Bestätigung des tatsächlichen Deploy-Ablaufs auf dem VPS~~ — **geklärt 13.09.** aus dem
   Shell-Verlauf (Abschnitt 3). Verbleibende Entscheidung: bei `npm install` bleiben oder auf `npm ci`
   wechseln (dann vorher das Lockfile auf dem VPS zurücksetzen).

---

## Anhang A — Test für Punkt 1 (13.09., 4/4 grün, `npx tsx --test` aus dem Projektstamm)

Als `lib/query/invalidations-refetch.test.ts` aufnehmen und in `test:unit` eintragen.

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { invalidateProjectAdjacencies } from "@/lib/query/invalidations";

const tick = () => new Promise((r) => setTimeout(r, 0));
const range = (i: number) =>
  queryKeys.calendarRange.byStartEnd(
    `2026-09-${String(i).padStart(2, "0")}T00:00:00.000Z`,
    `2026-09-${String(i).padStart(2, "0")}T23:59:59.999Z`,
  );

async function seedRanges(qc: QueryClient, n: number, z: Record<string, number>) {
  for (let i = 1; i <= n; i++) {
    await qc.prefetchQuery({
      queryKey: range(i),
      queryFn: async () => { z[String(i)] = (z[String(i)] ?? 0) + 1; return [{ i }]; },
    });
  }
}

test("'active': 19 unbeobachtete Bereiche bleiben ungültig, nur der beobachtete lädt sofort", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 90_000, refetchOnMount: false } } });
  const z: Record<string, number> = {};
  await seedRanges(qc, 20, z);
  const obs = new QueryObserver(qc, { queryKey: range(5), queryFn: async () => { z["5"]++; return [{ i: 5 }]; }, staleTime: 90_000, refetchOnMount: false });
  const unsub = obs.subscribe(() => {});
  await tick();
  const vorher = { ...z };
  invalidateProjectAdjacencies(qc, "p", { refetchType: "active" });
  await tick();
  const alle = qc.getQueryCache().findAll({ queryKey: queryKeys.calendarRange.all() });
  const nochUngueltig = alle.filter((q) => q.state.isInvalidated).map((q) => String(q.queryKey[1]).slice(8, 10));
  assert.equal(nochUngueltig.length, 19);
  assert.ok(!nochUngueltig.includes("05"));
  assert.deepEqual(Object.keys(z).filter((k) => z[k] !== vorher[k]), ["5"]);
  unsub();
});

test("'all' (heute): 20 inaktive Bereiche laden ALLE sofort — die Flut", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 90_000, refetchOnMount: false } } });
  const z: Record<string, number> = {};
  await seedRanges(qc, 20, z);
  const vorher = { ...z };
  invalidateProjectAdjacencies(qc, "p", { refetchType: "all" });
  await tick();
  assert.equal(Object.keys(z).filter((k) => z[k] !== vorher[k]).length, 20);
});

test("Blättern (Schlüsselwechsel) lädt einen ungültigen Bereich trotz refetchOnMount:false", async () => {
  const qc = new QueryClient();
  const z: Record<string, number> = {};
  await seedRanges(qc, 2, z);
  qc.invalidateQueries({ queryKey: range(2), refetchType: "none" });
  const opts = (i: number) => ({ queryKey: range(i), queryFn: async () => { z[String(i)]++; return [{ i }]; }, staleTime: 90_000, refetchOnMount: false as const });
  const obs = new QueryObserver(qc, opts(1));
  const unsub = obs.subscribe(() => {});
  await tick();
  const vorher = z["2"];
  obs.setOptions(opts(2));
  await tick();
  assert.equal(z["2"], vorher + 1);
  unsub();
});

test("Remount eines ungültigen Cores mit refetchOnMount:false lädt NICHT → Core-Keys brauchen 'all'", async () => {
  const qc = new QueryClient();
  const key = queryKeys.projects.core("p1");
  let n = 0;
  await qc.prefetchQuery({ queryKey: key, queryFn: async () => { n++; return { project: { status: "alt" } }; } });
  qc.invalidateQueries({ queryKey: key, refetchType: "none" });
  const obs = new QueryObserver(qc, { queryKey: key, queryFn: async () => { n++; return { project: { status: "neu" } }; }, staleTime: 60_000, refetchOnMount: false });
  const unsub = obs.subscribe(() => {});
  await tick();
  assert.equal(n, 1);
  assert.equal((obs.getCurrentResult().data as { project: { status: string } }).project.status, "alt");
  unsub();
});
```

## Anhang C — Produktions-Build lokal testen (Turnstile)

`lib/security/turnstile.ts` schlägt **ohne** Secret in Produktion absichtlich fehl
(`if (!secret) return process.env.NODE_ENV !== "production"`). Leere Schlüssel (wie bei `dev:lokal`)
funktionieren daher nur im Dev-Server; bei `next start` kommt «Sicherheitsprüfung fehlgeschlagen».
Der echte Site-Key erlaubt `localhost` nicht (Widget nicht anklickbar).

Lösung ohne Codeänderung — Cloudflares offizielle Testschlüssel (bestehen immer, jede Domain):
```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA  npm run build
CLOUDFLARE_TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA  npm run start -- -p 3000
```
Inline gesetzte Werte gewinnen gegen `.env.local` (13.09. geprüft: echter Key 0×, Test-Key 2× im Bundle).
Das Widget zeigt dann «Erfolg!» mit rotem Testhinweis. **Nie mit diesen Schlüsseln deployen.**

## Anhang B — Nützliche Befehle

```bash
./scripts/perf/vorfall-bericht.sh                 # main, heute
DIENST=bauflip-os ./scripts/perf/vorfall-bericht.sh
./scripts/zweig-abgleich.sh                        # main → bauflip-os
./scripts/zweig-abgleich.sh bauflip-os main        # Gegenrichtung
npm run dev:lokal                                  # Turnstile aus; bauflip-os auf Port 3001
```
