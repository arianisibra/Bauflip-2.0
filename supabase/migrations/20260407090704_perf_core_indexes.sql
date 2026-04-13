-- Kernabfragen: Kalenderwoche (starts_at Range) und Projektliste nach Organisation.

create index if not exists idx_appointments_starts_at on public.appointments (starts_at);

create index if not exists idx_projects_org_created_at on public.projects (organization_id, created_at desc);
