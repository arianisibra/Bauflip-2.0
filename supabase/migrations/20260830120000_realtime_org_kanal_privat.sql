-- Zweiter Sicherheitsaudit (2026-08-30), Fund H2/H3: der Org-Broadcast-Kanal
-- `org:<organization_id>` war ein OEFFENTLICHER Realtime-Kanal (kein
-- config.private:true) — Realtime autorisiert oeffentliche Kanaele ueberhaupt
-- nicht, realtime.messages hatte RLS aktiv, aber KEINE Policy. Empirisch belegt:
-- mit nur dem oeffentlichen Publishable-Key (keine Anmeldung) liess sich der
-- Kanal einer fremden Organisation abonnieren UND es liessen sich Nachrichten
-- hineinsenden — jeder, der die organization_id kennt (jedes aktuelle oder
-- ehemalige Mitglied), konnte den kompletten Aenderungsstrom mitlesen und mit
-- gefaelschten Ereignissen einen Cache-Invalidierungs-Sturm ausloesen.
--
-- Fix: nur SELECT (Empfangen) fuer Mitglieder der eigenen, aktiven
-- Organisation. Keine INSERT-Policy fuer Client-Rollen — gesendet wird
-- ausschliesslich serverseitig per Service-Role (lib/realtime/publish.ts),
-- die RLS ohnehin umgeht. Ohne INSERT-Policy kann kein Client mehr senden.
-- Die passende Aenderung auf `private: true` erfolgt im Anwendungscode
-- (lib/query/realtime-bridge.tsx, lib/realtime/publish.ts).

begin;

create policy "org_mitglieder_lesen_eigenen_broadcast"
on "realtime"."messages"
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from public.organization_memberships om
    where om.user_id = (select auth.uid())
      and om.is_active
      and 'org:' || om.organization_id::text = (select realtime.topic())
  )
);

commit;
