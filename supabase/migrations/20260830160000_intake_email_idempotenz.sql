-- Zweiter Sicherheitsaudit (2026-08-30): E-Mail-Intake ohne Idempotenz —
-- Postmark garantiert "at-least-once"-Zustellung und wiederholt eine Anfrage
-- bei Zeitüberschreitung oder Netzwerkfehler automatisch. Bisher legte jede
-- Zustellung derselben Mail einen eigenen Projektentwurf an. Fix: die
-- Postmark-Message-ID wird atomar geclaimt, bevor ein Projekt entsteht —
-- eine Wiederholung findet das bereits erzeugte Projekt und liefert dessen
-- ID zurück, statt ein zweites anzulegen.

begin;

create table if not exists public.intake_email_dedupe (
  message_id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.intake_email_dedupe is
  'Idempotenz-Sperre fuer den E-Mail-Intake-Webhook: eine Postmark Message-ID darf nur einmal ein Projekt anlegen.';

alter table public.intake_email_dedupe enable row level security;

-- Nur der Webhook (Service-Role) schreibt und liest hier — kein Nutzer-Zugriff.
revoke all on public.intake_email_dedupe from anon, authenticated;

commit;
