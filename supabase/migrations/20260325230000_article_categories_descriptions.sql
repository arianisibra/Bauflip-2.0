-- Produktkategorien (Dropdown), Einkauf/Verkauf, Einheit, Kurz- und Langbeschreibung; Platzhalter in Beschreibungen (App-Ebene)

create table if not exists public.article_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  template_scope text not null default 'generic'
    check (template_scope in ('storen', 'sonnenstoren', 'dl', 'generic')),
  created_at timestamptz not null default now(),
  constraint article_categories_name_unique unique (name)
);

create index if not exists idx_article_categories_sort on public.article_categories(sort_order);

alter table public.articles
  add column if not exists article_category_id uuid references public.article_categories(id) on delete restrict,
  add column if not exists purchase_price numeric(12,2),
  add column if not exists sale_price numeric(12,2),
  add column if not exists unit text not null default 'Stk',
  add column if not exists description_long text,
  add column if not exists description_short text;

insert into public.article_categories (name, sort_order, template_scope)
values ('Sonstiges', 999, 'generic')
on conflict (name) do nothing;

insert into public.article_categories (name, sort_order, template_scope)
select distinct category, 0, 'generic'
from public.articles
on conflict (name) do nothing;

update public.articles a
set article_category_id = c.id
from public.article_categories c
where c.name = a.category
  and a.article_category_id is null;

update public.articles
set article_category_id = (select id from public.article_categories where name = 'Sonstiges' limit 1)
where article_category_id is null;

alter table public.articles alter column article_category_id set not null;

alter table public.articles drop column if exists category;

alter table public.article_categories enable row level security;

drop policy if exists "admin_office_article_categories" on public.article_categories;

create policy "admin_office_article_categories"
on public.article_categories for all
using (public.current_user_role() in ('admin', 'office'))
with check (public.current_user_role() in ('admin', 'office'));
