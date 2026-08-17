-- Zweiter Sicherheitsaudit (2026-08-30), Fund H5: pushInvoiceToBexio prueft
-- `invoice.bexioInvoiceId` nur auf dem im Speicher gelesenen Objekt (TOCTOU).
-- Zwei gleichzeitige Aufrufe (automatischer Push beim Versand + manueller
-- Retry-Button, oder Doppelklick) lesen beide bexioInvoiceId=null und legen
-- beide einen Bexio-Debitorenbeleg an. Fix: atomarer Claim per bedingtem
-- UPDATE, bevor die Bexio-API ueberhaupt kontaktiert wird — der zweite
-- gleichzeitige Aufruf verliert das Rennen um die Zeile und bricht sofort ab.

begin;

alter table public.invoices
  add column if not exists bexio_push_started_at timestamptz;

comment on column public.invoices.bexio_push_started_at is
  'Claim-Zeitstempel fuer pushInvoiceToBexio — verhindert doppelte Bexio-Belege bei gleichzeitigen Aufrufen. Nach 5 Minuten gilt ein Claim als verwaist und darf erneut versucht werden.';

commit;
