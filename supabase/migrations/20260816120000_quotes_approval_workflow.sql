-- Freigabe-Workflow für Offerten: Büro reicht ein, Admin/Geschäftsführer gibt frei
-- (oder weist mit Kommentar zurück). Neuer Zwischenstatus 'pending_approval' —
-- unabhängig vom bestehenden Kunden-Entscheid 'approved'/'rejected' (sent → Kunde
-- entscheidet). Additiv/abwärtskompatibel: main kennt 'pending_approval' nicht und
-- erzeugt ihn nie; bestehende Zeilen/Spaltenzugriffe bleiben unverändert.

alter table public.quotes
  drop constraint if exists quotes_status_check;
alter table public.quotes
  add constraint quotes_status_check
    check (status in ('draft', 'pending_approval', 'sent', 'approved', 'rejected'));

alter table public.quotes
  add column if not exists submitted_for_approval_at timestamptz,
  add column if not exists approval_decided_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_by_display_name text,
  add column if not exists approval_note text;

comment on column public.quotes.submitted_for_approval_at is
  'Zeitpunkt, an dem Büro die Offerte zur internen Freigabe eingereicht hat (draft → pending_approval).';
comment on column public.quotes.approval_decided_at is
  'Zeitpunkt der Admin-Entscheidung über die interne Freigabe (Freigabe beim Senden, oder Zurückweisung an Büro).';
comment on column public.quotes.approved_by is
  'Admin, der die interne Freigabe erteilt oder die Offerte zurückgewiesen hat.';
comment on column public.quotes.approved_by_display_name is
  'Snapshot des Admin-Namens zum Entscheidungszeitpunkt (Muster wie created_by_display_name).';
comment on column public.quotes.approval_note is
  'Optionaler Kommentar des Admins bei Zurückweisung — fürs Büro sichtbar, damit klar ist was zu ändern ist.';
