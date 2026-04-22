# Client workflow & route guide

Functional overview and **URL paths** only—how end users move through the app. (UI copy is mostly **German**; paths are English.)

---

## Roles (who sees what)

| Role | Desk sidebar (`/projekte`, …) | Field shell (`/tag`, …) |
|------|-------------------------------|---------------------------|
| **Admin** | Full + **order forms CMS** | Yes |
| **Office** | Projects, calendar, team, settings | Yes (Mein Tag / Profil) |
| **Technician** | **No** (redirected to `/`) | **Yes** — only allowed prefixes (see below) |

Technicians are restricted by the edge **`proxy`**: allowed paths include **`/tag`**, **`/auftrag`**, **`/kalender`**, **`/wochenplan`**, **`/profil`**, **`/tech`**, auth/onboarding/MFA, and **`/`**.

---

## Route map (all main paths)

| Path | Functionality |
|------|----------------|
| **`/`** | Entry: redirects logged-in users (e.g. to **`/projekte`**) per app rules. |
| **`/anmeldung`** | Sign in. |
| **`/onboarding`** | Post–sign-up onboarding when applicable. |
| **`/mfa/setup`** | MFA setup when enforced for admins. |
| **`/projekte`** | **Projects hub**: list, search/filter, open project sheet, delete project, **“Neue Anfrage”** (new intake). |
| **`/projekte?openProjectId=<uuid>`** | Same hub with a **project sheet** opened for that id. |
| **`/projekte?sheet=<uuid>`** | Same hub; **calendar** links here to open the sheet for that project. |
| **`/projekte/<uuid>`** | **Redirects** to **`/projekte?openProjectId=<uuid>`** (bookmark-friendly). |
| **`/kalender`** | **Month calendar** of all appointments (office/admin view). |
| **`/mitarbeiter`** | **Team**: organization members / invitations. |
| **`/bestellformulare`** | **Admin only**: configure **supplier order form templates** (used on technician rapport). |
| **`/einstellungen`** | **Settings**: organization, profile, integrations, etc. |
| **`/tag`** | **“Mein Tag”** (today’s jobs in a week context): list tasks → open job. |
| **`/wochenplan`** | **Technician week calendar**; tasks link to job. |
| **`/auftrag/<projectId>`** | **Single job (field)**: address, contacts, attachments, **visit report (Rapport)** form. After save → back to **`/tag`**. |
| **`/profil`** | User **profile** (field bottom nav + sidebar for office). |
| **`/tech`** | **Redirects** to **`/tag`** (field home shortcut). |

---

## Workflow A — Office / admin (desk)

1. **`/anmeldung`** → sign in.  
2. **`/projekte`** — default landing after login for desk roles.  
3. **New request** — from **`/projekte`**, open **Neue Anfrage**, submit → **`/projekte?openProjectId=…`** with sheet open.  
4. **Edit project** — sheet on **`/projekte`**: master data, status, description, appointments, attachments, reports.  
5. **Plan work** — **`/kalender`** (month) or appointments inside the project sheet.  
6. **Team** — **`/mitarbeiter`**.  
7. **Order forms (admin)** — **`/bestellformulare`** to define templates.  
8. **Settings** — **`/einstellungen`**.  
9. **Optional same as field** — **`/tag`** (Mein Tag) from sidebar for own day list.

**Deep link from calendar:** **`/kalender`** → click task → **`/projekte?sheet=<projectId>`** (opens project sheet).

---

## Workflow B — Technician (field)

1. **`/anmeldung`** → sign in.  
2. **`/`** may redirect; field home is **`/tag`** (also **`/tech`** → **`/tag`**).  
3. **`/tag`** — see **today’s** assignments; tap a row → **`/auftrag/<projectId>`**.  
4. **`/wochenplan`** — week view; open **`/auftrag/<projectId>`** from a task.  
5. **`/auftrag/<projectId>`** — read job details, fill **Rapport** (outcome, next step, optional supplier forms), submit → **`/tag`**.  
6. **`/profil`** — profile from bottom navigation.

**Bottom nav (field):** **Mein Tag** = **`/tag`**, **Kalender** = **`/wochenplan`**, **Profil** = **`/profil`**.

---

## Workflow C — Calendar → project (office)

1. **`/kalender`** — browse month.  
2. Click appointment → **`/projekte?sheet=<projectId>`** — project sheet for planning follow-up.

---

## Query parameters (quick reference)

| Query | Meaning |
|--------|---------|
| **`openProjectId`** | Open the **project detail sheet** on the projects page. |
| **`sheet`** | Same intent when coming from the **admin calendar** (sheet for that project). |

---

## Functionalities checklist (by area)

- **Auth:** login **`/anmeldung`**, onboarding, MFA when required.  
- **Projects:** list, filter, CRUD sheet, status workflow, reference number, intake form.  
- **Calendar (desk):** month of appointments, link into project.  
- **Field day/week:** tasks with links to job detail.  
- **Job detail:** contacts, maps, files, rapport + optional order forms.  
- **Team:** members & invites.  
- **Order forms CMS:** template CRUD (admin).  
- **Settings:** org & user preferences, branding-related where implemented.

For technical implementation details, see **`docs/DEVELOPER_OVERVIEW.md`**.
