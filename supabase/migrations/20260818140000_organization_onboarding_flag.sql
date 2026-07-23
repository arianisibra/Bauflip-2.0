-- Onboarding-Wizard (Workflow-Engine): Flag, ob eine Organisation das erste
-- Einrichten abgeschlossen hat. Additiv + idempotent.
--
-- Bestehende Orgs (Storenbau, Maler-Test) werden sofort auf now() gesetzt:
-- der Wizard richtet sich nur an KÜNFTIG angelegte Organisationen — kein
-- bestehender Nutzer sieht je ein Onboarding.

alter table public.organizations
  add column if not exists onboarding_completed_at timestamptz;

update public.organizations
  set onboarding_completed_at = now()
  where onboarding_completed_at is null;
