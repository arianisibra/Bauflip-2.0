# Projekte interaction checklist (HAR capture)

Reproduziert die Production-Session aus der HAR-Analyse (~3 Min). DevTools → Network → **Disable cache** → HAR exportieren mit Content.

## Schritte

1. **Login** → `/projekte`
2. **Neues Projekt** (Intake) oder bestehendes öffnen
3. Im Sheet **Termine buchen**: Monteur wählen, Beginn/Ende mehrfach anpassen (Konfliktcheck + Tagesvorschau), **2 Termine** speichern, einen optional löschen
4. **PDF** im Sheet öffnen (falls vorhanden)
5. **Kalender** (Sidebar), dann **Tag**, zurück **Projekte** (soft-nav, keine Hard-Reloads)
6. **Auftrag** öffnen (Monteur-Route): **2 Fotos** hochladen, **Rapport** absenden

## Erwartung nach Deploy

```bash
node scripts/perf/summarize-har.mjs path/to/export.har
```

| Gate | Ziel |
|------|------|
| POST `/projekte` gesamt (Termin-Session) | ≤ 8 |
| `availability` POSTs | ≤ 3 |
| POST `/auftrag` (extras + 2 uploads + rapport) | ≤ 4, **0** `core` refetch |

## Hinweise

- Capture kann **ohne** Document-GET `/projekte` starten (Sheet schon offen) — Script zeigt dann POST-Timeline.
- Browser-Extensions (z. B. Grammarly) erzeugen Noise — im HAR filtern oder Extension deaktivieren.
- `openProjectId` sollte nach Sheet-Öffnen **nicht** mehr in POST-URLs erscheinen.
