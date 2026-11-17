# Smart Curriculum — Implementation & Design Plan

## Scope and delivery approach

Smart Curriculum is a role-aware college operations dashboard for Students, Faculty, and Administrators. The first implementation focuses on a live, demonstrable vertical slice: Manus OAuth login/session handling, a normalized Drizzle/MySQL schema, seeded fictional records, role-aware navigation, student attendance and activity workflows, faculty attendance session management, and administrator management/reporting views. All feature pages are routed through the same shell and are designed to degrade gracefully with loading, error, and empty states.

The app uses the initialized React + TypeScript + Tailwind + Express + tRPC + Drizzle starter. Manus OAuth remains the only authentication mechanism; the application user record stores the app role and domain profile. Backend procedures enforce role permissions, while the UI only exposes actions the authenticated role can use. Attendance is calculated from stored records, with `late` configurable as present-equivalent by policy. Activity registrations use unique student/activity constraints and server-side capacity checks. Demo data is inserted idempotently through a seed helper, never by replacing later user edits.

The app will ship with realistic seeded academic data and a compact, polished dashboard rather than a marketing landing page. Any operation not backed by a real server procedure is labeled as unavailable instead of reporting false success.

## Project structure

- `client/src/App.tsx`: route map, auth gate, and shared application shell.
- `client/src/pages/`: dashboard, attendance, activities, reports, management, and not-found pages.
- `client/src/components/`: shell navigation, reusable cards, tables, badges, dialogs, and charts.
- `client/src/lib/`: tRPC client, attendance-analysis utilities, and UI helpers.
- `server/routers.ts`: protected role-aware tRPC procedures for dashboard data, attendance, activities, announcements, notifications, and admin management.
- `server/db.ts`: Drizzle connection, idempotent seed support, and typed query helpers.
- `drizzle/schema.ts`: normalized MySQL schema for users, profiles, departments, subjects, assignments, enrolments, attendance, activities, registrations, announcements, notifications, and settings.
- `drizzle/`: checked-in additive migrations.
- `public/manus-routes.json`: complete page route manifest for preview and publication.

## Product design

### Considered directions

- Editorial campus control room — probability 0.07.
- Quiet SaaS registrar — probability 0.06.
- Indigo operations desk — probability 0.05.

### Selected direction: Indigo operations desk

**Design movement:** restrained enterprise SaaS with a campus-operations sensibility: dense enough for real work, calm enough for daily student use.

**Core principles:** hierarchy before decoration; data should scan in seconds; actions stay close to context; mobile layouts preserve the same operational priority as desktop.

**Color philosophy:** navy and ink establish trust and academic seriousness; indigo marks active navigation and primary actions; mint, amber, and coral are reserved for attendance meaning so status never depends on color alone.

**Layout paradigm:** a persistent rail plus a wide working canvas, with a contextual header and stacked analytical bands instead of a centered marketing grid.

**Signature elements:** a small indigo square mark with a white check motif; attendance rings and thin progress rails; calendar/date chips that make upcoming work feel scheduled and tangible.

**Interaction philosophy:** predictable transitions, clear focus states, and confirmation only for destructive actions. Forms use inline validation, disabled submit states, and toast feedback for completed server mutations.

**Animation:** minimal 150–200ms fades and width transitions for sidebar/mobile navigation; no auto-playing motion or decorative parallax.

**Typography system:** Inter for UI and data, with a strong 12/14/16/24 scale; uppercase micro-labels are sparse and used only for section metadata.

**Brand essence:** a dependable academic operations desk for colleges that want attendance and activities in one place; clear, grounded, practical.

**Brand voice:** concise and encouraging. Example lines: “Keep your attendance on track.” “One place for every class, activity, and update.”

**Wordmark & logo:** a compact square mark formed by two offset indigo columns and a check-shaped negative space, paired with a lowercase “smart curriculum” wordmark.

**Signature brand color:** `#4F46E5` indigo-600, used as the ownable accent against navy and soft slate surfaces.

## Core data and behavior

- `users` retains Manus OAuth identity plus `role` (`student`, `faculty`, `admin`).
- Profile tables store student roll number/course/year or faculty employee code/department.
- Departments, subjects, faculty assignments, and enrolments model academic ownership.
- Attendance sessions are unique by subject/date/time; attendance records are unique by session/student and accept present/absent/late.
- Attendance percentage is `(present-equivalent classes / total applicable classes) * 100`; late-equivalent policy is stored in settings and surfaced in the UI.
- Smart attendance analysis uses `max(0, ceil((R*T-P)/(1-R)))`, handles already-at-target cases, and also computes safe misses before falling below the threshold.
- Activities and registrations use capacity, deadline, status, and unique-registration validation.
- Announcements and notifications retain audience/read state.

## Build workflow

1. Complete schema, migration, seed, and server procedures.
2. Build the authenticated shell and role-aware route map.
3. Implement student, faculty, and administrator overview pages with charts and stored metrics.
4. Implement attendance and activities mutations with validation, CSV export, and persistence.
5. Add reports, management tables, notifications, and settings.
6. Run diagnostics, type checking, build, and focused data/route checks; fix confirmed issues.
7. Start Preview, verify `/manus-routes.json`, capture only targeted visual checks when needed, commit to the canonical remote, and report the checkpoint.
