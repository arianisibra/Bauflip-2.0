-- getProjectCore / Monteur-Auftrag: häufige Filter auf project_id (FK-Spalten).
-- appointments: idx_appointments_project + idx_appointments_project_starts_at existieren bereits.

create index if not exists idx_technician_reports_project_id
  on public.technician_reports (project_id);

create index if not exists idx_project_attachments_project_id
  on public.project_attachments (project_id);

-- technician_report_order_forms(technician_report_id): idx_report_order_forms_report (order_forms_cms)
