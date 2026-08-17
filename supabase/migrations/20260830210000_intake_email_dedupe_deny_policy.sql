-- Explizite Deny-Policy fuer intake_email_dedupe (RLS war aktiv, aber ohne
-- Policy — der Advisor meldet das als Hinweis). Analog zu
-- contact_kunden_counters/project_number_counters: die Tabelle bleibt fuer
-- anon/authenticated komplett gesperrt, nur die Service-Role (Webhook) schreibt.

begin;

create policy "intake_email_dedupe_no_rest"
on public.intake_email_dedupe
for all
to anon, authenticated
using (false)
with check (false);

commit;
