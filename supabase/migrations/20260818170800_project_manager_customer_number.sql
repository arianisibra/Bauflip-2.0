-- Offerte/Rechnung: Projektleiter (interne zuständige Person) und Kunden-Nr.
-- des Auftraggebers als Freitext-Snapshot auf dem Projekt — analog zu den
-- bestehenden tenant_*/management_*-Snapshot-Feldern, erscheinen im PDF-Kopf.

alter table public.projects
  add column if not exists project_manager_name text,
  add column if not exists customer_number text;
