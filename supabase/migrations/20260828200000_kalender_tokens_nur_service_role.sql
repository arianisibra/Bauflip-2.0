-- Google-/Microsoft-Tokens vor den Client-Rollen verbergen.
--
-- `technician_calendar_connections.refresh_token` ist ein langlebiger Token mit
-- Kalender-Schreibrechten. Er galt bisher als für den Besitzer lesbar — per
-- PostgREST mit dem öffentlichen Anon-Key und dem eigenen Sitzungs-JWT.
--
-- Das Gefährliche daran: Ein solcher Token gilt AUSSERHALB von Bauflip weiter.
-- Abmelden, Passwortwechsel oder das Deaktivieren des Bauflip-Kontos entziehen
-- ihn nicht. Wer einmal an eine Sitzung kommt (entwendetes Cookie, kurz
-- unbeaufsichtigtes Monteur-Handy), liest und verändert danach dauerhaft den
-- privaten Kalender dieser Person — bis sie den Zugriff bei Google bzw.
-- Microsoft selbst widerruft.
--
-- Die App braucht die Tokens im Client-Kontext nie: Gelesen werden sie
-- ausschliesslich über den Service-Role-Client (getCalendarConnectionsForTechnician,
-- updateStoredTokens, markConnectionError). Der Nutzer-Client holt nur
-- provider/connected_at/sync_error für die Statusanzeige. Das Schreiben wurde
-- im selben Zug auf die Service-Role umgestellt (lib/calendar-sync/connections.ts).
--
-- POSTGRES-FALLE: Ein reines `revoke select (refresh_token)` bleibt wirkungslos,
-- solange ein TABELLEN-Grant besteht — das Spaltenrecht wird daraus abgeleitet.
-- Deshalb erst den Tabellen-Grant entziehen, dann spaltenweise neu vergeben.

begin;

revoke select, insert, update on public.technician_calendar_connections from authenticated, anon;

-- Alles ausser den beiden Token-Spalten bleibt lesbar — das genügt der
-- Statusanzeige in den Einstellungen («verbunden seit», «Sync-Fehler»).
grant select (id, technician_id, provider, expires_at, sync_error, connected_at)
  on public.technician_calendar_connections to authenticated;

-- DELETE bleibt bestehen: «Verbindung trennen» läuft über den Nutzer-Client,
-- die RLS-Policy `own calendar connection` begrenzt das auf die eigene Zeile.
-- Ein Spaltenrecht braucht DELETE nicht.

commit;
