# Smart Curriculum — Outcome TODO

## 1. Authenticated role-based application shell
- [ ] The application opens to the real Manus OAuth login state when unauthenticated and to the authenticated dashboard when a valid session exists.
- [ ] Student, Faculty, and Administrator roles have distinct navigation and protected pages; backend procedures enforce role authorization rather than relying only on frontend visibility.
- [ ] The desktop sidebar collapses, mobile navigation works, and the light UI uses white/light-grey surfaces, navy/indigo accents, readable typography, accessible contrast, tables, badges, progress bars, and restrained motion.

## 2. Normalized persistent academic data model
- [ ] The relational schema includes Users, Students, Faculty, Departments, Subjects, CourseAssignments, StudentEnrolments, AttendanceSessions, AttendanceRecords, Activities, ActivityRegistrations, Announcements, Notifications, and configurable attendance settings.
- [ ] Primary keys, foreign keys, validation rules, and unique constraints prevent duplicate student-session attendance records and duplicate activity registrations.
- [ ] Passwords are never stored by the application; authentication credentials remain with the authentication provider.
- [ ] Seed data is realistic and fictional: 1 administrator, 3 faculty members, 20 students, 5 subjects, multiple attendance sessions and varied percentages, at least 8 activities, registrations, announcements, and notifications. Seeding is idempotent and does not overwrite later user edits.

## 3. Student dashboard and attendance analysis
- [ ] The dashboard reads stored data for student name, overall attendance, classes conducted, classes attended, upcoming activities, and subjects below the configured default 75% threshold.
- [ ] Subject attendance table includes subject name/code, conducted, attended, percentage, and Safe/Warning/Low badges with green/amber/red semantics.
- [ ] Attendance trend and subject-wise charts, upcoming activities, announcements, recent attendance records, and quick actions are present.
- [ ] Attendance percentage is calculated as present-equivalent classes divided by total applicable classes times 100, and recalculates when records change.
- [ ] Late attendance handling is configurable and explained in the interface.
- [ ] Smart Attendance Analysis shows current percentage, below-threshold status, consecutive classes required to reach target, safe additional misses, near-threshold warnings, and explains `x = max(0, ceil((R*T-P)/(1-R)))`, including already-at-target handling.
- [ ] Students can view and filter attendance history, identify missed classes, and view trends without accessing another student's records.

## 4. Faculty attendance workflow
- [ ] Faculty can select a subject/class, create a date/time attendance session, view enrolled students, mark Present/Absent/Late, save and edit records, and view previous sessions.
- [ ] Records can be filtered by subject, student, and date and exported as CSV.
- [ ] Server-side validation prevents duplicate entries and invalid attendance values; success, error, loading, and empty states are visible.

## 5. Activity and event management
- [ ] Activities support workshops, seminars, hackathons, technical competitions, guest lectures, club, cultural, and sports categories.
- [ ] Each activity stores title, description, category, date/time, venue, department, faculty coordinator, registration deadline, capacity, registration count, and status.
- [ ] Students can browse, search by title, filter by category/date, inspect details, register/cancel when allowed, and view registered activities.
- [ ] Faculty can create, edit, and manage activities; duplicate registrations are rejected and capacity/deadline rules are enforced server-side.
- [ ] Upcoming activities expose registration status, seats, deadlines, and a calendar-style or date-grouped view.

## 6. Notifications and announcements
- [ ] In-app notifications exist for low attendance, new activities, successful registration, schedule changes, and announcements, with read/unread state.
- [ ] Faculty and administrators can publish announcements to selected audiences.
- [ ] The app does not claim email/SMS delivery without an integration.

## 7. Faculty and administrator dashboards
- [ ] Faculty dashboard shows assigned subjects, total enrolled students, classes conducted, average attendance, students below threshold, upcoming classes, recent sessions, activities, and shortcuts for core actions, with subject/date filters.
- [ ] Administrator dashboard shows total students/faculty/subjects/sessions, overall attendance rate, students below threshold, and upcoming activities.
- [ ] Administrator management pages cover students, faculty, departments, subjects, course assignments, enrolments, attendance reports, activities, and announcements with search, filtering, pagination, CRUD actions, and destructive-action confirmation.

## 8. Reports and delivery quality
- [ ] Reports include student-wise, subject-wise, date-wise, below-threshold, activity registration, and attendance-trend views with useful charts and CSV export.
- [ ] Reports respect the logged-in user's permissions.
- [ ] Main student, faculty, and administrator workflows are wired to working routes and forms; no functional-looking controls silently do nothing.
- [ ] `/manus-routes.json` lists the complete page route set and remains valid.
- [ ] Type diagnostics, type checking, build, and focused route/data checks pass; broken routes and console errors are resolved.
- [ ] The application is responsive, has useful loading/error/empty states, and is ready for a live college mini-project demonstration.
