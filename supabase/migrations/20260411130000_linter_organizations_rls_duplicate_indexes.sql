-- 0009 duplicate_index: zweite identische FK-Indizes entfernen (behält idx_* aus fk_covering_indexes).
-- (RLS organizations: Admin-Schreiben ohne FOR ALL siehe 20260411130100 — FOR ALL hätte SELECT mit organizations_select verdoppelt.)

drop index if exists public.invitations_invited_by_fkey_idx;
drop index if exists public.organizations_created_by_fkey_idx;
