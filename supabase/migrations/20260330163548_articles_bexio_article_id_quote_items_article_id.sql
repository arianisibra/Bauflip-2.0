-- bexio Artikel-ID (Stammdaten) + optionale Verknüpfung Offertenposition → Artikelkatalog

alter table public.articles
  add column if not exists bexio_article_id text;

comment on column public.articles.bexio_article_id is 'bexio Artikel-/Produkt-ID für Zapier (article_ids)';

alter table public.quote_items
  add column if not exists article_id uuid references public.articles(id) on delete set null;

comment on column public.quote_items.article_id is 'Wenn Position aus Katalog: FK → articles; für Webhook lineItems.bexioArticleIdNumeric';

create index if not exists quote_items_article_id_idx on public.quote_items (article_id) where article_id is not null;
