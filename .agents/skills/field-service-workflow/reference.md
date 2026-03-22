# Field Service Operations Builder — extended reference

This file supplements [SKILL.md](SKILL.md). Read it when designing complex flows, resolving product trade-offs, or when the user asks for deeper operational rationale.

## Product intent

The software should reflect **real day-to-day work** between office staff, admins, and field technicians. It must feel like a **working tool** for a real business, not a polished demo.

The system is **not** a generic SaaS dashboard, CRM, or ERP clone. Prioritize operational clarity and reliability over visual experimentation or technical cleverness.

## Phased delivery (expanded)

Implementation order is fixed in principle:

1. **Office or admin web** — workflows, completeness, and reliability first; this surface is the **system of record**.
2. **Project lifecycle and status logic** — behavior and ownership tied to status, not decorative labels.
3. **Scheduling, quotes, ordering, deliveries, invoicing readiness** — deepen the web product before depending on mobile.
4. **Technician mobile** — reduced operational layer on top of the same project-centric model; schema and APIs are not driven by mobile needs in early phases.

**Do not** let anticipated mobile features dictate early data models or navigation architecture. Expose a **documented subset** for technicians when that phase ships.

## Primary operational rule (expanded)

Always prefer:

- Simpler workflows  
- Fewer decisions per screen  
- Clearer next actions  
- Stronger validation  
- Less cognitive load  
- Real-world usability  

Never optimize for abstract flexibility before proving it is needed.

## Technician persona (mobile phase only)

When implementing **technician-facing** software (typically after the office system is established), assume the field technician:

- Is under time pressure  
- Is working on a phone  
- May have poor internet  
- May be tired, impatient, or inconsistent  
- Should not be expected to read dense interfaces  
- Should not need training to complete core tasks  

The product must **guide, constrain, and protect** that user from mistakes so that even a weak or careless user can still complete the job correctly. These constraints **do not** override office-first build order or system-of-record design for phase 1.

## Office vs technician (system of record)

**Office or admin** own the authoritative record: intake, customer communication, scheduling, quote sending, order review, supplier communication, invoicing, project control. They use the **main web application**—more complete, desktop-oriented where appropriate.

**Field technicians** (later) need: assigned work, customer and project context, onsite inspection, measurements, notes and photos, clear outcome selection, completion or follow-up signaling. They use a **radically simplified** mobile experience that **consumes** the same project data—not a parallel product model.

The technician app is **not** a mini office system and **not** a second hub. The **project** remains the operational container.

## Handoff quality as a product goal

A major goal is reducing mistakes between:

- Customer to office  
- Office to technician  
- Technician to office  
- Office to supplier  
- Delivery back to project  
- Office or technician to admin for invoicing  

Design so each handoff has **clear data**, **clear ownership**, and **status-driven** next steps.

## Project-centric operational file

The **project** is the main container. It should function like a **complete operational file**: customer, intake, notes, appointments, technician reports, quotes, orders, deliveries, invoicing state, and status history—without fragmenting the workflow across disconnected records.

## Status-driven operations

Statuses control:

- What actions are available  
- What users see  
- What the next step is  
- Who is responsible next  

If a label does not participate in that machinery, it is not doing operational work.

## Notes as first-class data

Notes are business-critical. They must be easy to create, visible in context, chronological, readable on mobile, and attached to the project. Support distinct note types where they improve clarity (customer, internal, planning, technician, ordering, invoicing).

## Decision-making when multiple approaches exist

- Recommend the simplest approach that works  
- Explain trade-offs briefly  
- Avoid speculative flexibility  
- Avoid future-proofing without evidence  
- Optimize for shipping and iteration  

## “What good looks like” (full)

A good implementation should make it obvious:

- What stage a project is in  
- What has already happened  
- What is missing  
- Who is responsible now  
- What should happen next  

A good office screen should reduce back-and-forth communication and missed details. A good project screen should function like a complete operational file. When technician surfaces exist, a good technician screen should be understandable in seconds.

## Interface philosophy (expanded)

Do not build generic AI-looking interfaces. Do not optimize for visual novelty. Do not overuse cards, dialogs, empty decoration, or fake dashboard aesthetics.

Instead, design for:

- Readability  
- Speed  
- Hierarchy  
- Field usage (where relevant)  
- Stressful real-world use  
- Operational trust  

The interface should feel calm, clear, structured, reliable, and practical.

## Anti-patterns (full list)

Do not:

- Build like a generic CRM  
- Build like a generic ERP  
- Overcomplicate the initial web workflow  
- Let the future mobile app distort the first architecture  
- Overcomplicate the technician experience when building that layer  
- Add features without workflow value  
- Create status labels that do not affect behavior  
- Hide critical information in tabs or deep menus  
- Use design complexity where process clarity is needed  
- Add abstractions for hypothetical future cases  
- Optimize performance before proving a bottleneck  
- Introduce admin complexity into the field app  

## Output expectations (building)

When building features, screens, or flows:

- Think operationally first  
- Keep language and UI simple  
- Make validation strict where needed  
- Make handoffs explicit  
- Preserve context  
- Build for real use, not demo quality  

If forced to choose, always choose usability over cleverness, clarity over flexibility, speed over ceremony, simplicity over abstraction, and workflow integrity over visual polish.
