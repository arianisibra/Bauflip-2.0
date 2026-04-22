# Bauflip — Product & Technical Overview (for developers)

This document explains what **Bauflip** is, what the application does, how business processes map to the codebase, and where to look when changing behavior. It is written for **English-speaking developers** joining the project. The **user interface is largely German** (labels, copy, status names in the UI).

---

## 1. What is Bauflip?

**Bauflip** is a **web application for field-service operations**, aimed at companies that install and service **blinds / shutters** (*Storen* in Swiss German) and similar on-site work. It is the **office / admin “system of record”** first: staff manage **projects (jobs)**, **appointments**, **technicians**, and **supplier order forms**; technicians use a **separate, mobile-first** area for their day and visit reports.

Typical flow:

1. **Office** receives a request (phone, email, WhatsApp, etc.) and creates a **project** with tenant, property, and problem description.
2. **Office** plans **appointments** (inspection or execution) and assigns a **technician**.
3. **Technician** sees today’s jobs, opens a job, fills a **visit report (Rapport)** (fixed vs. further work), optionally fills **supplier order forms**, and the **project status** advances in the workflow.
4. **Office / admin** track status through many stages (quotes, ordering, workshop, billing, closed).

Deployments may use a customer-specific hostname; the **repository name** is *Bauflip-2.0* and the codebase refers to the product as **Bauflip**.

---

## 2. Technology stack

| Layer | Choice |
|--------|--------|
| Framework | **Next.js** (App Router), **React** |
| Language | **TypeScript** |
| Auth & database | **Supabase** (Postgres + Auth + Storage) |
| Server mutations | **Server Actions** (`"use server"`) |
| UI | **Tailwind CSS**, **shadcn-style** components (`components/ui/`) |
| Validation | **Zod** |
| Hosting (example) | **Netlify** (with Next.js runtime); `proxy.ts` replaces legacy `middleware.ts` in Next 16 |

Environment variables are documented in **`.env.example`** (Supabase URL/keys, optional Turnstile, calendar OAuth, MFA enforcement, etc.).

---

## 3. Multi-tenancy and roles

### Organizations

- Data is scoped by **`organization_id`** on projects and related entities.
- Users belong to an organization via **`organization_memberships`** (with `role` and `is_active`).
- SQL helpers such as **`current_organization_id()`** and **`current_user_role()`** (in Postgres) align RLS with the authenticated user. The app’s session code resolves the **same membership ordering** as the DB (e.g. `created_at` ascending) where relevant.

### Roles (`RoleType`)

Three application roles (see `lib/domain/types.ts`):

| Role | German UI context | Typical access |
|------|-------------------|----------------|
| **`admin`** | Administrator | Full office features + **order-form CMS** (`/bestellformulare`) + stricter **MFA** when enforced |
| **`office`** | Büro / back office | Projects, calendar, team, settings; no order-form CMS |
| **`technician`** | Monteur / field tech | **Field routes only** (see below); **no** full desk sidebar for `/projekte`, `/einstellungen`, etc. |

The proxy (`proxy.ts`) **redirects technicians** away from office URLs unless the path is under an allowed prefix (e.g. `/tag`, `/auftrag`, `/kalender`, `/wochenplan`, `/profil`, auth/onboarding).

---

## 4. Route groups and UX surfaces

The App Router splits the UI into logical **layouts**:

### Office / admin: `app/(app)/`

- **Sidebar** navigation (`components/app/sidebar-nav.tsx`, `lib/navigation/sidebar-config.ts`).
- Main areas:
  - **`/projekte`** — Project list, **new intake** (“Neue Anfrage”), project **sheet** editor, delete project.
  - **`/kalender`** — Month view of appointments (`AdminCalendar`).
  - **`/mitarbeiter`** — Team / memberships management.
  - **`/bestellformulare`** — **Admin-only** CMS for **supplier order form templates** (dynamic fields, used from technician rapport).
  - **`/einstellungen`** — Organization and profile settings.
- **`/tag`**, **`/profil`** — Also linked from the office sidebar as **“Mein Tag”** / profile so office staff can use the **same field views** as technicians when needed.

### Field / technician: `app/(tech)/`

- **`layout.tsx`** — Mobile-first shell, **bottom navigation** (`TechBottomNav`: Mein Tag, Kalender, Profil).
- **`/tag`** — **“Mein Tag”**: today’s (week-scoped) tasks from `listWeekTasks()`.
- **`/auftrag/[projectId]`** — Single job view + **rapport form** (`MonteurAuftragClient`).
- **`/wochenplan`** — Week calendar for the technician.
- **`/profil`** — Profile.

### Auth: `app/(auth)/`

- **`/anmeldung`** — Sign-in (and related server actions).
- **`/onboarding`**, **`/mfa/setup`** — Onboarding / MFA when required.

### Root

- **`app/(app)/page.tsx`** redirects to **`/projekte`** for logged-in desk users.

---

## 5. Core domain concepts

### Project (`Project` in `lib/domain/types.ts`)

A **job** with:

- **Type**: `reparatur` | `ersatz` | `neuinstallation`
- **Status**: long **workflow** enum (`projectStatuses`) — e.g. open, appointment planned, field visit, quote sent, ordered, ready for installation, workshop, clarify, invoice, subcontractor, closed. Labels for badges are in **`projectStatusLabels`** (German strings for UI).
- **Intake**: source (`whatsapp` | `telefon` | `email`), original request text, optional access/hints.
- **Parties**: tenant + property-style **service address**; optional **management (Verwaltung)** contact; optional **cost ceiling** text.
- **Assignment**: `nextOwnerRole`, `nextOwnerUserId` for routing ownership in the UI.
- **Reference code**: auto-generated (year + sequence) via DB trigger and **`project_number_counters`** (internal table; not for direct client access).

### Appointments

- Linked to a project; **kind**: `besichtigung` (inspection) or `ausfuehrung` (execution).
- Time range, optional assigned technician, planning notes.

### Technician reports (Rapport)

- Stored in **`technician_reports`** (outcome, summary, measurements JSON, work description, time, etc.).
- **Outcomes** drive **project status** updates in `addTechnicianReport()` (`lib/db/repository.ts`):
  - **`schaden_behoben`** (“fixed”) → status set to **`abrechnen`** (billing).
  - **`schaden_aufgenommen`** (“recorded / not finished”) → status set from **`nextStatus`** chosen in the form (validated against `RAPPORT_NEXT_STEPS_*` in `lib/domain/types.ts`).
- Optional **order form** lines saved to **`technician_report_order_forms`** when templates exist.

### Order form templates (admin CMS)

- **`order_form_templates`**: per-organization supplier forms with a **JSON field definition** (`lib/order-forms/`).
- Technicians only see **active** templates for their project’s organization when submitting a rapport.

### Attachments

- Project files in **Supabase Storage** (bucket such as `project-files`), metadata in DB; upload/delete flows in server actions in `app/(app)/actions.ts`.

---

## 6. End-to-end processes (how it works)

### 6.1 Creating a new request (intake)

1. User opens **Projects** and **“Neue Anfrage”**.
2. Client submits **`createIntakeAction`** (`app/(app)/actions.ts`) with `FormData`.
3. Server validates with **`intakeSchema`** (`lib/validations/forms.ts`), ensures session is **office** or **admin** and has **`organizationId`**.
4. **`createProject()`** (`lib/db/repository.ts`) inserts into **`projects`** (RLS applies). Reference code assigned by trigger.
5. Cache: **`revalidatePath("/projekte")`** is scheduled with **`after()`** from Next to avoid racing the RSC response.
6. Client navigates to **`/projekte?openProjectId=…`** to open the new sheet.

### 6.2 Office edits a project

- **`projekt-sheet-editor`** and related actions in **`app/(app)/projekte/actions.ts`** (stammdaten, status, appointments, delete project/report).

### 6.3 Calendar

- **`listMonthTasks`** feeds **`AdminCalendar`**; calendar actions live under **`app/(app)/kalender/actions.ts`**.

### 6.4 Technician completes a visit

1. From **`/tag`** or **`/wochenplan`**, open **`/auftrag/[projectId]`**.
2. Form calls **`submitTechnicianReportAction`** (`app/(tech)/actions.ts`): validates **`technicianReportSchema`**, validates order-form values against templates, then **`addTechnicianReport()`**.
3. Repository writes report (+ order form rows) and **updates project `status`**.
4. **`revalidatePath`** for `/tag` and the job URL.

### 6.5 Auth session

- **`getCurrentSession()`** (`lib/auth/session.ts`): Supabase user + membership role + **`organization_id`** + profile row from **`profiles`** (with upsert fallback when missing).
- **`createSupabaseServerClient()`** (`lib/supabase/server.ts`): cookie-based SSR client; cookie writes are defensive (`try/catch`) where the framework may forbid mutation.
- **`proxy.ts`**: security headers, Supabase `getUser()`, redirects unauthenticated users to **`/anmeldung`**, enforces **technician path allowlist**.

---

## 7. Important code locations

| Topic | Location |
|--------|-----------|
| Domain enums & types | `lib/domain/types.ts` |
| DB access & mappers | `lib/db/repository.ts` (large file: lists, CRUD, reports) |
| Zod form schemas | `lib/validations/forms.ts` |
| Intake + attachments server actions | `app/(app)/actions.ts` |
| Project sheet / office project actions | `app/(app)/projekte/actions.ts` |
| Technician rapport action | `app/(tech)/actions.ts` |
| Session | `lib/auth/session.ts` |
| Supabase server client | `lib/supabase/server.ts` |
| Request proxy (auth + headers) | `proxy.ts` (Next 16 convention) |
| Sidebar visibility | `lib/navigation/sidebar-config.ts` |
| DB schema & RLS | `supabase/migrations/*.sql` |

---

## 8. Database and RLS

- **Migrations** under `supabase/migrations/` are the source of truth for schema, policies, and triggers.
- **RLS** is enabled on user-facing tables; policies use **`current_user_role()`** and often **`current_organization_id()`**.
- **Internal** tables (e.g. **`project_number_counters`**) must not block triggers: the reference-code trigger function must run with sufficient privileges (**`SECURITY DEFINER`** + safe `search_path`) and/or RLS disabled on that internal table — see migration **`20260420120000_fix_assign_project_reference_security_definer.sql`** if project creation fails with RLS errors.

Apply migrations with the Supabase CLI (`npm run db:push` after link/login) as described in `.env.example`.

---

## 9. Internationalization note

- **No i18n framework** in the sense of locale files for English: product strings are **mostly hard-coded German** in components and `projectStatusLabels`.
- Code identifiers (status enums, route paths) are **English or Latin**; **German** is used for user-visible strings.

---

## 10. What to read first when onboarding

1. **`lib/domain/types.ts`** — vocabulary of statuses, roles, and entities.  
2. **`lib/db/repository.ts`** — skim exports used by pages you touch.  
3. **`proxy.ts`** + **`lib/auth/session.ts`** — who can access what.  
4. **`app/(app)/projekte/page.tsx`** + **`components/app/projekte-list-client.tsx`** — desk project hub.  
5. **`app/(tech)/auftrag/[projectId]/page.tsx`** + **`components/app/monteur-auftrag-client.tsx`** — field job + rapport.

---

## 11. Disclaimer

This file reflects the **repository as understood from the codebase** at documentation time. Customer-specific branding, hostnames, or small production-only tweaks may exist outside this repo. When in doubt, trace from the **route** → **page** → **server action** → **`lib/db/repository.ts`** → **migration** for the involved table.
