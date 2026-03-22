create table if not exists public.ui_module_labels (
  key text primary key,
  label text not null
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null unique,
  category text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  in_stock integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.kanban_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  color text not null check (color in ('slate', 'blue', 'green', 'orange', 'violet')),
  sort_order integer not null default 0,
  status project_status not null,
  created_at timestamptz not null default now()
);

create table if not exists public.kanban_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  column_id uuid not null references public.kanban_columns(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  status project_status not null,
  due_date timestamptz,
  assigned_technician_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.project_chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_chat_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.project_chat_messages(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_path text not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  technician_id uuid not null references public.profiles(id) on delete cascade,
  technician_email text not null,
  provider text not null check (provider in ('google', 'microsoft', 'ics')),
  provider_event_id text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  profile_name text not null,
  offene_projekte integer not null default 0,
  abgeschlossene_heute integer not null default 0,
  offene_rapporte integer not null default 0,
  stunden_diese_woche numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.smtp_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null check (provider_name in ('google', 'outlook', 'custom')),
  host text not null,
  port integer not null,
  secure boolean not null default false,
  username text not null,
  encrypted_password text not null,
  from_email text not null,
  signature_html text,
  created_at timestamptz not null default now()
);

create table if not exists public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  recipient text not null,
  subject text not null,
  status text not null check (status in ('gesendet', 'fehler')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_order_form_templates (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  supplier_name text not null,
  name text not null,
  required_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_order_form_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  template_id uuid not null references public.supplier_order_form_templates(id) on delete cascade,
  values_json jsonb not null default '{}'::jsonb,
  status text not null check (status in ('entwurf', 'eingereicht')),
  created_at timestamptz not null default now()
);

create table if not exists public.stock_decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  decision text not null check (decision in ('ab_lager', 'bestellen')),
  notes text not null,
  decided_by_role app_role not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  project_id uuid references public.projects(id) on delete set null,
  actor_role app_role not null,
  actor_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ui_module_labels enable row level security;
alter table public.articles enable row level security;
alter table public.kanban_columns enable row level security;
alter table public.kanban_cards enable row level security;
alter table public.project_chat_messages enable row level security;
alter table public.project_chat_attachments enable row level security;
alter table public.calendar_events enable row level security;
alter table public.employee_metrics_snapshots enable row level security;
alter table public.smtp_accounts enable row level security;
alter table public.mail_messages enable row level security;
alter table public.supplier_order_form_templates enable row level security;
alter table public.supplier_order_form_submissions enable row level security;
alter table public.stock_decisions enable row level security;
alter table public.audit_events enable row level security;

create policy "admin_office_ui_labels"
on public.ui_module_labels
for all
using (public.current_user_role() in ('admin', 'office'))
with check (public.current_user_role() in ('admin', 'office'));

create policy "admin_office_articles"
on public.articles
for all
using (public.current_user_role() in ('admin', 'office'))
with check (public.current_user_role() in ('admin', 'office'));

create policy "kanban_read_role_based"
on public.kanban_columns
for select
using (
  public.current_user_role() in ('admin', 'office')
  or exists (
    select 1 from public.projects p
    where p.id = kanban_columns.project_id
      and p.next_owner_user_id = auth.uid()
  )
);

create policy "kanban_write_admin_office"
on public.kanban_columns
for all
using (public.current_user_role() in ('admin', 'office'))
with check (public.current_user_role() in ('admin', 'office'));

create policy "kanban_cards_read_role_based"
on public.kanban_cards
for select
using (
  public.current_user_role() in ('admin', 'office')
  or exists (
    select 1 from public.projects p
    where p.id = kanban_cards.project_id
      and p.next_owner_user_id = auth.uid()
  )
);

create policy "kanban_cards_write_admin_office"
on public.kanban_cards
for all
using (public.current_user_role() in ('admin', 'office'))
with check (public.current_user_role() in ('admin', 'office'));

create policy "chat_read_role_based"
on public.project_chat_messages
for select
using (
  public.current_user_role() in ('admin', 'office')
  or sender_id = auth.uid()
  or exists (
    select 1
    from public.appointments a
    where a.project_id = project_chat_messages.project_id
      and a.assigned_technician_id = auth.uid()
  )
);

create policy "chat_write_all_roles"
on public.project_chat_messages
for all
using (public.current_user_role() in ('admin', 'office', 'technician'))
with check (public.current_user_role() in ('admin', 'office', 'technician'));

create policy "attachments_chat_write"
on public.project_chat_attachments
for all
using (public.current_user_role() in ('admin', 'office', 'technician'))
with check (public.current_user_role() in ('admin', 'office', 'technician'));

create policy "admin_office_calendar"
on public.calendar_events
for all
using (public.current_user_role() in ('admin', 'office'))
with check (public.current_user_role() in ('admin', 'office'));

create policy "admin_only_metrics"
on public.employee_metrics_snapshots
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "admin_only_smtp"
on public.smtp_accounts
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "admin_office_mail_logs"
on public.mail_messages
for all
using (public.current_user_role() in ('admin', 'office'))
with check (public.current_user_role() in ('admin', 'office'));

create policy "admin_office_supplier_templates"
on public.supplier_order_form_templates
for all
using (public.current_user_role() in ('admin', 'office'))
with check (public.current_user_role() in ('admin', 'office'));

create policy "admin_office_supplier_submissions"
on public.supplier_order_form_submissions
for all
using (public.current_user_role() in ('admin', 'office'))
with check (public.current_user_role() in ('admin', 'office'));

create policy "admin_office_stock_decisions"
on public.stock_decisions
for all
using (public.current_user_role() in ('admin', 'office'))
with check (public.current_user_role() in ('admin', 'office'));

create policy "admin_only_audit"
on public.audit_events
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');
