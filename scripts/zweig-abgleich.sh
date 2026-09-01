#!/usr/bin/env bash
# Zeigt, was zwischen main und bauflip-os auseinanderläuft.
#
# Entstanden am 01.09.2026: Vier Kalender-Fixes und ein Timeout-Fix vom August
# lagen wochenlang nur auf main. Die QA-Testfirma auf app.bauflip.ch hatte
# dieselben Fehler wie der Kunde — nur hat sich dort niemand beschwert.
# Aufgefallen ist es durch Zufall, nicht durch ein Werkzeug.
#
#   ./scripts/zweig-abgleich.sh
#
# Beide Zweige laufen produktiv (main = Gross Storenbau, bauflip-os = app.bauflip.ch)
# auf demselben VPS und derselben Supabase-Datenbank. Ein Fix auf einem Zweig ist
# fast immer auch auf dem anderen fällig.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

VON="${1:-main}"
NACH="${2:-bauflip-os}"

# Auch den Remote-Stand berücksichtigen, falls der Zweig nicht lokal ausgecheckt ist.
aufloesen() {
  if git rev-parse --verify --quiet "$1" >/dev/null; then echo "$1"
  elif git rev-parse --verify --quiet "origin/$1" >/dev/null; then echo "origin/$1"
  else echo ""; fi
}
A=$(aufloesen "$VON"); B=$(aufloesen "$NACH")
if [ -z "$A" ] || [ -z "$B" ]; then
  echo "Zweig nicht gefunden: ${VON} bzw. ${NACH}"
  exit 1
fi

echo "═══════════════════════════════════════════════════════════"
echo " ZWEIG-ABGLEICH   $A  →  $B"
echo "═══════════════════════════════════════════════════════════"
echo

BASIS=$(git merge-base "$A" "$B")
echo "Gemeinsamer Stand: $(git log -1 --format='%h %ad  %s' --date=short "$BASIS")"
echo

VOR=$(git rev-list --count "$B".."$A")
ZURUECK=$(git rev-list --count "$A".."$B")
printf '  %-28s %s\n' "Nur auf $VON:" "$VOR Commits"
printf '  %-28s %s\n' "Nur auf $NACH:" "$ZURUECK Commits"
echo

if [ "$VOR" -eq 0 ]; then
  echo "Nichts nachzuziehen — $NACH hat alles von $VON."
  exit 0
fi

echo "NICHT AUF $NACH — jüngste zuerst:"
echo
git log --no-merges --format='%h|%ad|%s' --date=short "$B".."$A" | while IFS='|' read -r h d s; do
  # Konvention: Wer einen Commit nachzieht, nennt den Quell-Hash in der
  # Commit-Nachricht. Dann ist er hier eindeutig als erledigt erkennbar, auch
  # wenn der Code beim Übertragen angepasst wurde (Kommentare, andere Struktur).
  nachgezogen=$(git log --format='%h %s' "$B" --grep="$h" | head -1)
  if [ -n "$nachgezogen" ]; then
    printf '  %s  %s  %s\n' "$h" "$d" "$s"
    printf '  %-8s %-10s → nachgezogen in %s\n\n' "" "" "$nachgezogen"
    continue
  fi

  # Sonst grober Hinweis: Sind die berührten Dateien auf dem Zielzweig überhaupt
  # anders? Ersetzt keine fachliche Prüfung, engt aber ein, wo man hinschaut.
  dateien=$(git show --stat --format="" "$h" | grep '|' | awk '{print $1}')
  gleich=0; verschieden=0; fehlend=0
  for f in $dateien; do
    if ! git cat-file -e "$B:$f" 2>/dev/null; then
      fehlend=$((fehlend + 1))
    elif git diff --quiet "$h:$f" "$B:$f" 2>/dev/null; then
      gleich=$((gleich + 1))
    else
      verschieden=$((verschieden + 1))
    fi
  done
  if [ "$verschieden" -eq 0 ] && [ "$fehlend" -eq 0 ]; then
    hinweis="Dateien identisch — vermutlich schon drin"
  elif [ "$fehlend" -gt 0 ]; then
    hinweis="$fehlend Datei(en) fehlen dort ganz"
  else
    hinweis="$verschieden von $((gleich + verschieden)) Datei(en) abweichend — PRÜFEN"
  fi
  printf '  %s  %s  %s\n' "$h" "$d" "$s"
  printf '  %-8s %-10s → %s\n\n' "" "" "$hinweis"
done

echo "───────────────────────────────────────────────────────────"
echo "Der Hinweis ist eine Vorsortierung, kein Urteil: «Dateien identisch»"
echo "heisst nur, dass der Zielzweig denselben Inhalt hat — eine unabhängig"
echo "gebaute Lösung sieht anders aus und gilt trotzdem. Am 01.09. waren von"
echo "20 Juli-Commits 19 auf anderem Weg abgedeckt und einer echt fehlend."
