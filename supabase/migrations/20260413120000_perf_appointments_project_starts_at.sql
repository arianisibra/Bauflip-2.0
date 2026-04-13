-- Speeds getProjectCore appointment list: eq(project_id) + order(starts_at)
create index if not exists idx_appointments_project_starts_at
  on public.appointments (project_id, starts_at asc);
