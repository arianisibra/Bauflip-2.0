-- E-Mail-Intake: pro Org ein unguessable Token, das die eingehende Intake-Adresse
-- (intake+<token>@INTAKE_EMAIL_DOMAIN) identifiziert. Dient gleichzeitig als
-- Routing (welche Org?) und als Auth (Capability-URL) für den Inbound-Webhook —
-- kein separates Secret nötig, wie bei den ICS-Busy-URLs der Monteure.
alter table public.organizations
  add column if not exists intake_email_token text;

update public.organizations
  set intake_email_token = replace(gen_random_uuid()::text, '-', '')
  where intake_email_token is null;

alter table public.organizations
  alter column intake_email_token set default replace(gen_random_uuid()::text, '-', ''),
  alter column intake_email_token set not null;

create unique index if not exists organizations_intake_email_token_key
  on public.organizations (intake_email_token);
