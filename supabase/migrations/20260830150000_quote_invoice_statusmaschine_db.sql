-- Zweiter Sicherheitsaudit (2026-08-30), Fund H6: die Offerten-/Rechnungs-
-- Statusmaschine existierte nur in TypeScript (lib/domain/types.ts:
-- allowedQuoteStatusTransitions, allowedInvoiceStatusTransitions). Die
-- office-Rolle hat direktes UPDATE auf quotes.status/invoices.status ueber
-- PostgREST (quotes_all_office_admin_org, invoices_all_office_admin_org) —
-- ein Buero-Nutzer konnte per direktem PATCH einen unzulaessigen Uebergang
-- setzen (z. B. eine Rechnung ohne Zahlungseingang direkt auf "paid", oder
-- eine bereits versendete Offerte zurueck auf "draft" ohne den Freigabe-Weg).
--
-- Fix: BEFORE-UPDATE-Trigger, der denselben Uebergangs-Automaten wie die
-- Node-Schicht durchsetzt (lib/domain/types.ts: canSetQuoteStatus/
-- canSetInvoiceStatus) — als zweite, DB-seitige Verteidigungslinie, die auch
-- bei direktem PostgREST-Zugriff greift. Identischer Status bleibt erlaubt
-- (Wiederversand, erneute Zahlungsbestaetigung mit frischem paid_at sind
-- bewusste App-Faelle — setInvoiceStatus/setQuoteStatus schreiben `status`
-- bei jedem Aufruf mit, auch wenn sich der Wert nicht aendert), nur ECHTE
-- Uebergaenge werden gegen die erlaubte Liste geprueft.

begin;

create or replace function public.pruefe_quote_statusuebergang()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status = 'pending_approval')
    or (old.status = 'pending_approval' and new.status in ('sent', 'draft'))
    or (old.status = 'sent' and new.status in ('approved', 'rejected'))
    or (old.status = 'rejected' and new.status = 'draft')
  ) then
    raise exception 'Statuswechsel «%» -> «%» ist nicht zulaessig.', old.status, new.status
      using errcode = '22023';
  end if;

  return new;
end;
$$;

comment on function public.pruefe_quote_statusuebergang() is
  'DB-seitige Durchsetzung des Offerten-Statusautomaten — spiegelt allowedQuoteStatusTransitions aus lib/domain/types.ts. Schliesst direkten PostgREST-Zugriff der office-Rolle.';

drop trigger if exists quotes_pruefe_statusuebergang on public.quotes;
create trigger quotes_pruefe_statusuebergang
  before update of status on public.quotes
  for each row
  execute function public.pruefe_quote_statusuebergang();

create or replace function public.pruefe_invoice_statusuebergang()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status = 'sent')
    or (old.status = 'sent' and new.status in ('paid', 'cancelled'))
  ) then
    raise exception 'Statuswechsel «%» -> «%» ist nicht zulaessig.', old.status, new.status
      using errcode = '22023';
  end if;

  return new;
end;
$$;

comment on function public.pruefe_invoice_statusuebergang() is
  'DB-seitige Durchsetzung des Rechnungs-Statusautomaten — spiegelt allowedInvoiceStatusTransitions aus lib/domain/types.ts. Schliesst direkten PostgREST-Zugriff der office-Rolle.';

drop trigger if exists invoices_pruefe_statusuebergang on public.invoices;
create trigger invoices_pruefe_statusuebergang
  before update of status on public.invoices
  for each row
  execute function public.pruefe_invoice_statusuebergang();

alter function public.pruefe_quote_statusuebergang() set search_path = '';
alter function public.pruefe_invoice_statusuebergang() set search_path = '';

commit;
