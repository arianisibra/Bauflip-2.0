<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Zwei produktive Zweige — Korrekturen gehören auf beide

`main` (Gross Storenbau, app.gross-storenbau.ch) und `bauflip-os` (app.bauflip.ch)
laufen **beide produktiv**, auf demselben VPS und derselben Supabase-Datenbank.
Ein Fehler, der auf einem Zweig auffällt, steckt fast immer auch im anderen.

**Nach jeder Korrektur auf einem Zweig prüfen, ob sie auf dem anderen fehlt:**

    ./scripts/zweig-abgleich.sh              # main → bauflip-os
    ./scripts/zweig-abgleich.sh bauflip-os main

**Beim Nachziehen den Quell-Hash in der Commit-Nachricht nennen** (z. B.
«Von main: … (e077a5a)»). Nur daran erkennt der Abgleich, dass ein Commit
erledigt ist — die Dateien sind nach dem Übertragen selten zeichengleich.

Nicht mergen: Die Zweige sind seit dem 06.07.2026 auseinander (dreistellige
Commit-Zahl auf bauflip-os). Einzeln nachziehen und jede Änderung für sich prüfen.

**Was zuerst:** `bauflip-os` ist der Hauptzweig und in mehreren Punkten weiter.
Grössere Umbauten dort zuerst bauen und messen, dann auf `main` übertragen —
nicht umgekehrt. Ausnahme: akute Kundenfehler auf `main`, die keinen Aufschub
dulden; die werden anschliessend nachgezogen.

Warum das hier steht: Am 01.09.2026 stellte sich heraus, dass vier
Kalender-Fixes und ein Timeout-Fix vom August wochenlang nur auf `main` lagen.
Die Testfirma auf app.bauflip.ch hatte dieselben Fehler wie der zahlende Kunde —
nur hat sich dort niemand beschwert. Aufgefallen ist es durch Zufall.
