---
name: field-service-workflow
description: Guides building field service software as a practical operational system—not a generic SaaS dashboard, CRM, or ERP clone. Enforces phased delivery with office or admin web as the system of record first, then project lifecycle and status logic, then scheduling, quotes, purchase orders, deliveries, and invoicing readiness, with technician mobile later as a reduced layer consuming a documented subset of the core model. Stresses project-centric data, status-driven behavior, notes and handoffs as first-class, and a per-feature workflow template (trigger, input, actor, decision, status change, next owner). Use when scoping or implementing intake, projects, appointments, office admin workflows, quotes, orders, deliveries, invoicing, site visits, technician reports, or project closure for field service businesses.
---

# Field Service Operations Builder

## When to apply

Use this skill when the work touches **real day-to-day field service operations** between office staff, admins, and field technicians—not generic CRM or ERP clones. Triggers include: job intake, project creation and lifecycle, scheduling, appointments, site visits, notes and measurements, quotes, customer approval, materials, supplier ordering, delivery intake, follow-ups, installation or repair completion, invoicing readiness, closure, status workflows, **office or admin web UI**, or (in later phases) **technician mobile** surfaces.

## Core philosophy

Build a **practical operational system**: clarity, speed, error prevention, and operational reliability over visual experimentation or technical cleverness. The product must feel like a **working tool** for a real business, not a polished demo.

**Lifecycle to keep in mind** (stages may map to statuses, not to disconnected apps):

- Job intake → project creation → scheduling → site visit → notes and measurements → quote preparation → customer approval → material review → supplier ordering → delivery intake → follow-up scheduling → installation or repair completion → invoicing → project closure

## Delivery priority (canonical build order)

Build in this order:

1. **Office or admin web workflows first** — primary interface and **system of record**.
2. **Project lifecycle and status logic** — statuses that affect behavior, ownership, and next actions.
3. **Scheduling, quotes, ordering, deliveries, invoicing readiness** — operational depth on the web product.
4. **Technician mobile app later** — a **reduced operational layer** that consumes a simplified subset of the core system; it must **not** drive initial architecture or schema decisions.

**Architecture rule:** Model data and APIs for office workflows first. The future technician client reads and writes a **documented subset** aligned to the same project record—**no mobile-driven schema** in phase 1. **Do not** let the future mobile app distort the first architecture.

## Decision hierarchy (canonical trade-offs)

When choosing approaches, prefer in this order:

1. **Usability** over cleverness  
2. **Clarity** over flexibility  
3. **Speed** over ceremony  
4. **Simplicity** over abstraction  
5. **Workflow integrity** over visual polish  

Also: simpler workflows, fewer decisions per screen, clearer next actions, stronger validation, less cognitive load, real-world usability. **Do not** optimize for abstract flexibility before proving it is needed.

## Users and surfaces

### Office or admin (phase 1 — primary)

They handle intake, customer communication, scheduling, quote sending, order review, supplier communication, invoicing, and project control. They work in the **main web application**, which **defines** projects, statuses, notes, appointments, quotes, orders, deliveries, invoicing readiness, and handoffs.

### Field technicians (later phase)

They handle assigned work, reading customer and project notes, onsite inspection, measurements, notes and photos, clear outcome selection, and completion or follow-up. **Implement their dedicated app after** the office system of record is solid. The technician app is **not** a shrunken office product and **not** a second hub—**project** stays the hub; technician actions feed the same project record.

## Later: technician layer (field UX constraints)

When building **phase-4 technician surfaces**, apply constraints for real field use. Assume the technician: is under time pressure; uses a phone; may have poor connectivity; may be tired or inconsistent; should not parse dense UI; should not need training for core tasks.

**Mandates:** guide, constrain, and protect from mistakes; large touch targets; very few screens; shallow navigation; step-by-step entry where it helps; clear primary actions; support **partial progress**; prefer **explicit outcomes** over vague states.

### Technician app — include

Today's assigned work (or visits); project summary; address and contact; previous notes; appointment details; simple report entry; measurements; photos; outcome decision; time entry; completion state.

### Technician app — exclude

Complex admin tools; invoicing workflows; large settings areas; advanced reporting dashboards; unnecessary navigation or deep nested menus.

## Product rules

### Operational clarity (every screen)

Answer: **What is this?** **What matters here?** **What do I do next?** Prefer **one primary action per screen** where practical.

### Handoff quality

Reduce mistakes across: customer → office → technician → office → supplier → delivery → project → admin (e.g. invoicing). Make **handoffs explicit** in data and status.

### Project as the hub

The main container is the **project**. It should hold (or link in-context without fragmenting workflow): customer, intake details, notes, appointments, technician reports, quotes, orders, deliveries, invoicing state, status history. **Do not** scatter the operational story across disconnected records without a clear project anchor.

**Terminology:** If the UI says "job," treat it as **assigned work or a visit tied to a project**, not a second hub competing with the project record.

### Status-driven behavior

Statuses are **not** decorative labels. They must drive: available actions; what each role sees; the obvious next step; **who is responsible next**. If a status does not change behavior or ownership, reconsider it.

## UX and validation

- Simple, direct UI; plain language; important information visible; avoid decorative complexity and **deep** navigation.  
- **Structured input** where the real world allows it; **free text** where variability demands it.  
- Missing critical data must be **hard to ignore**; required fields **visually obvious**.  
- Block completion of important steps when required data is missing.  
- Errors **as the user works**, not only on submit—prevent mistakes before they happen.

## Notes

Notes are **business-critical** and **first-class**.

**Types to support** (or equivalent): customer note, internal note, planning note, technician note, ordering note, invoicing note.

**Requirements:** easy to create; visible in context; chronological; readable on mobile; attached to the **project**.

## Technician visit outcomes

After a visit, offer a **small explicit set** of outcomes, for example:

- Work completed  
- Quote required  
- Material required  
- Workshop repair required  
- Follow-up visit required  

Avoid vague catch-all states.

## Architecture and data

- Modular, clean structure; **avoid overengineering** and speculative abstractions; match technical complexity to business complexity; use straightforward real-world data models.  
- **Before implementing a feature**, think through: operational problem; who uses it; required data; status transitions; next responsible party (see checklists below).

**Entities to align with** (extend only when justified): customers, projects, appointments, notes, attachments, technician reports, quotes, purchase orders, deliveries, invoices, users, status history.

## Workflow design template

For each feature or step, define:

1. **Trigger** — What starts this step?  
2. **Input** — What information is needed?  
3. **Actor** — Who performs it?  
4. **Decision** — What outcome is chosen?  
5. **Status change** — What changes in the system?  
6. **Handoff** — Who owns the next step?  

If any item is unclear, the feature is not designed well enough.

## Feature design checklist

When implementing a new feature:

1. User  
2. Exact operational problem  
3. Minimum usable version  
4. Required data  
5. Validation rules  
6. Status impact  
7. What the next action should be  

Prefer the **minimum version that works in real life**.

## Interface direction and anti-patterns

**Aim for:** calm, clear, structured, reliable, practical—readability, speed, hierarchy, field use (when building technician surfaces), operational trust under stress.

**Do not:**

- Build like a generic CRM or ERP  
- Overcomplicate the **initial** office or admin web workflow  
- Let the future mobile app distort the first architecture  
- Overcomplicate the technician experience **when** building that layer  
- Add features without workflow value  
- Use statuses that do not affect behavior  
- Hide critical information in tabs or deep menus  
- Trade design complexity for process clarity  
- Abstract for hypothetical future cases without evidence  
- Optimize performance before a proven bottleneck  
- Push admin complexity into the field app  
- Ship generic “AI product” UI, empty dashboard decoration, or novelty-for-its-own-sake visuals  

## Output expectations

When building features, screens, or flows: think **operationally first**; keep language and UI simple; enforce validation where it matters; make handoffs explicit; preserve context; optimize for **real use**, not demo polish.

## What good looks like (quick check)

A good implementation makes obvious: what stage a project is in; what has already happened; what is missing; who is responsible now; what should happen next. A good **office** screen reduces back-and-forth and missed details. A good **project** screen functions like a **complete operational file**. When technician surfaces exist, a good technician screen is understandable in **seconds**.

## Additional detail

For expanded rationale and narrative, see [reference.md](reference.md).
