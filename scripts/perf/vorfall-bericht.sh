#!/usr/bin/env bash
# Vorfall-Bericht für Bauflip (main / Gross Storenbau).
#
# Fasst zusammen, was auf dem Produktivsystem los war: langsame Operationen,
# Abbrüche, Zeitfenster mit Häufung — und, sobald der Browser-Mitschnitt
# ausgerollt ist, auch das, was beim Kunden in F12 zu sehen gewesen wäre.
#
# Entstanden am 31.08.2026, nachdem die Rückschau auf einen Ausfall Stunden
# gekostet hat, weil die Zahlen einzeln zusammengesucht werden mussten.
#
#   ./scripts/perf/vorfall-bericht.sh              # heute
#   ./scripts/perf/vorfall-bericht.sh gestern
#   ./scripts/perf/vorfall-bericht.sh 2026-08-31
#
#   BAUFLIP_LOG_DATEI=/pfad/zur/datei.log ./scripts/perf/vorfall-bericht.sh
#     wertet eine lokale Datei aus statt den Server abzufragen.
#
# WICHTIG: Server-Log läuft in UTC, die Schweiz im Sommer auf UTC+2.
# Der Bericht zeigt beide Zeiten nebeneinander — genau diese Verwechslung hat
# am 31.08. mehrere Fehlschlüsse verursacht.
#
# Hinweis zur Umsetzung: Die Python-Blöcke stehen bewusst in zitierten
# Heredocs (<<"PY"). Direkt hinter `python3 -c '...'` würde das erste
# einfache Anführungszeichen im Python-Code den Shell-String beenden.

set -uo pipefail

VPS="ubuntu@179.237.81.89"
SEIT="${1:-today}"
case "$SEIT" in
  gestern)  SEIT="yesterday" ;;
  heute)    SEIT="today" ;;
  20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]) SEIT="$SEIT 00:00:00" ;;
esac

echo "═══════════════════════════════════════════════════════════"
echo " BAUFLIP VORFALL-BERICHT   Zeitraum: $SEIT"
echo "═══════════════════════════════════════════════════════════"
echo

if [ -n "${BAUFLIP_LOG_DATEI:-}" ]; then
  LOG=$(cat "$BAUFLIP_LOG_DATEI" 2>/dev/null)
else
  LOG=$(ssh -o ConnectTimeout=10 "$VPS" "sudo journalctl -u bauflip --since '$SEIT' --no-pager" 2>/dev/null)
fi

if [ -z "$LOG" ]; then
  echo "Keine Log-Einträge gefunden (oder kein Zugriff auf den Server)."
  exit 1
fi

# ── Überblick ──────────────────────────────────────────────
LANGSAM=$(printf '%s\n' "$LOG" | grep -c "slow_operation")
FEHLER=$(printf '%s\n' "$LOG" | grep -c "⨯")
TIMEOUTS=$(printf '%s\n' "$LOG" | grep -c "Datenbank ist gerade überlastet")
VERALTET=$(printf '%s\n' "$LOG" | grep -c "Failed to find Server Action")

echo "ÜBERBLICK"
printf '  %-38s %s\n' "Langsame Operationen (>800 ms):" "$LANGSAM"
printf '  %-38s %s\n' "Abbrüche insgesamt:" "$FEHLER"
printf '  %-38s %s\n' "davon Datenbank-Zeitüberschreitungen:" "$TIMEOUTS"
printf '  %-38s %s\n' "Veraltete Tabs (nach Deploy):" "$VERALTET"
echo

# ── Verteilung über den Tag ────────────────────────────────
echo "LANGSAME OPERATIONEN PRO STUNDE  (UTC → Schweizer Zeit)"
printf '%s\n' "$LOG" | grep "slow_operation" | awk '{print substr($3,1,2)}' | sort | uniq -c |
while read -r anzahl stunde; do
  ch=$(( (10#$stunde + 2) % 24 ))
  balken=$(printf '%*s' $(( anzahl > 60 ? 60 : anzahl )) '' | tr ' ' '#')
  printf '  %s UTC / %02d Uhr CH  %4s  %s\n' "$stunde" "$ch" "$anzahl" "$balken"
done
echo

# ── Nach Art ───────────────────────────────────────────────
echo "NACH ART DER OPERATION"
printf '%s\n' "$LOG" | grep -o '"label":"[^"]*"' | sed 's/"label":"//;s/"//' | sort | uniq -c | sort -rn |
  awk '{printf "  %5s  %s\n", $1, $2}'
echo

# ── Langsamste Einzelfälle ─────────────────────────────────
LESER_LANGSAM=$(cat <<"PY"
import sys, json
zeilen = []
for z in sys.stdin:
    try:
        zeilen.append(json.loads(z.strip()))
    except Exception:
        pass
zeilen.sort(key=lambda d: -d.get("durationMs", 0))
for d in zeilen[:10]:
    label = d.get("label", "?")
    zusatz = ""
    # Projekt-Kennung bzw. Zeitraum mitzeigen, falls vorhanden (Commit a4200bf).
    if d.get("projectId"):
        zusatz = "  Projekt " + str(d["projectId"])[:8]
    elif d.get("rangeStartIso"):
        zusatz = "  Zeitraum ab " + str(d["rangeStartIso"])[:10]
    print("  %7d ms  %s%s" % (d.get("durationMs", 0), label, zusatz))
PY
)
echo "DIE 10 LANGSAMSTEN EINZELFÄLLE"
printf '%s\n' "$LOG" | grep -o '{"type":"slow_operation".*}' | python3 -c "$LESER_LANGSAM" 2>/dev/null ||
  echo "  (keine auswertbaren Einträge)"
echo

# ── Abbrüche mit Zeitstempel ───────────────────────────────
if [ "$FEHLER" -gt 0 ]; then
  echo "ABBRÜCHE  (UTC → Schweizer Zeit)"
  printf '%s\n' "$LOG" | grep "⨯\|_timeout" | sed 's/ov-f68365 npm\[[0-9]*\]://' |
  while IFS= read -r zeile; do
    zeit=$(echo "$zeile" | awk '{print $3}')
    rest=$(echo "$zeile" | cut -d' ' -f4-)
    if [ -n "$zeit" ]; then
      h=${zeit%%:*}
      ch=$(( (10#$h + 2) % 24 ))
      printf '  %s UTC / %02d%s CH  %s\n' "$zeit" "$ch" "${zeit#??}" "$rest"
    fi
  done
  echo
fi

# ── Browser (F12) ──────────────────────────────────────────
BROWSER=$(printf '%s\n' "$LOG" | grep -o '{"type":"browser_log".*}')
if [ -n "$BROWSER" ]; then
  LESER_BROWSER=$(cat <<"PY"
import sys, json
from collections import Counter

eintraege = []
for z in sys.stdin:
    try:
        eintraege.append(json.loads(z.strip()))
    except Exception:
        pass

beschriftung = {
    "error": "Fehler (Console)",
    "rejection": "Abgelehnte Promises",
    "console": "console.error",
    "slow_request": "Langsame Aufrufe (Network)",
}
for art, n in Counter(e.get("art", "?") for e in eintraege).most_common():
    print("  %5d  %s" % (n, beschriftung.get(art, art)))
print()

langsam = sorted(
    (e for e in eintraege if e.get("art") == "slow_request"),
    key=lambda e: -(e.get("dauerMs") or 0),
)[:5]
if langsam:
    print("  Langsamste Aufrufe im Browser:")
    for e in langsam:
        status = "  HTTP %s" % e["status"] if e.get("status") else ""
        print("    %6d ms  %s%s" % (e.get("dauerMs") or 0, e.get("text", "?"), status))
    print()

fehler = Counter(
    (e.get("text") or "?")[:100]
    for e in eintraege
    if e.get("art") in ("error", "rejection", "console")
)
if fehler:
    print("  Häufigste Fehlermeldungen:")
    for text, n in fehler.most_common(5):
        print("    %4dx  %s" % (n, text))
        # Fundstelle mitgeben — sonst sucht man den Ausloeser im ganzen Bundle.
        for e in eintraege:
            if (e.get("text") or "?")[:100] == text and e.get("quelle"):
                print("           %s" % e["quelle"])
                break
PY
)
  echo "BROWSER  — was beim Kunden in F12 zu sehen gewesen wäre"
  printf '%s\n' "$BROWSER" | python3 -c "$LESER_BROWSER" 2>/dev/null ||
    echo "  (nicht auswertbar)"
  echo
fi

# ── Zustand der Datenbank jetzt ────────────────────────────
echo "DATENBANK — MOMENTAUFNAHME"
cd "$(dirname "$0")/../.." 2>/dev/null || true
npx supabase db query "
  select
    (select count(*) from pg_stat_activity where state='active') as aktive_abfragen,
    (select count(*) from pg_stat_activity) as verbindungen,
    (select round(100.0*sum(heap_blks_hit)/nullif(sum(heap_blks_hit)+sum(heap_blks_read),0),2) from pg_statio_user_tables) as cache_prozent,
    (select count(*) from pg_locks where not granted) as wartende_sperren;
" --linked 2>/dev/null | grep -oE '"[a-z_]+": "?[0-9.]+"?' | sed 's/"//g;s/:/: /' | awk '{printf "  %-20s %s\n", $1, $2}'
echo
echo "Hinweis: Ein Ausfall ist nur LIVE vollständig zu untersuchen."
echo "Bei laufender Störung sofort melden — rückwirkend fehlen die"
echo "entscheidenden Angaben (laufende Abfragen, Sperren, Wartezustände)."
