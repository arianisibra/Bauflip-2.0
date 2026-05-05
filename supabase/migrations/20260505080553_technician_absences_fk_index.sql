-- Performance-Linter: Covering Index für FK `technician_absences.created_by`.
create index if not exists idx_technician_absences_created_by
  on public.technician_absences (created_by);
