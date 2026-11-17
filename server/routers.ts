import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  activities,
  activityRegistrations,
  announcements,
  appSettings,
  attendanceRecords,
  attendanceSessions,
  courseAssignments,
  departments,
  enrolments,
  faculty,
  getAttendancePolicy,
  getCurrentFaculty,
  getCurrentStudent,
  ensureUserProfile,
  ensureDemoData,
  notifications,
  students,
  subjects,
  users,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import type { User } from "../drizzle/schema";

const roleGuard = (allowed: Array<"student" | "faculty" | "admin">) => protectedProcedure.use(async ({ ctx, next }) => {
  if (!allowed.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "This action is not available for your role." });
  return next({ ctx });
});
const facultyProcedure = roleGuard(["faculty", "admin"]);

async function assertFacultyOwnsSubject(db: Awaited<ReturnType<typeof ensureDemoData>>, user: User, subjectId: number) {
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
  if (user.role === "admin") return (await db.select().from(faculty).limit(1))[0]?.id;
  const profile = await getCurrentFaculty(user.id);
  if (!profile) throw new TRPCError({ code: "FORBIDDEN", message: "A faculty profile is required for this action." });
  const assignment = await db.select({ id: courseAssignments.id }).from(courseAssignments).where(and(eq(courseAssignments.facultyId, profile.id), eq(courseAssignments.subjectId, subjectId))).limit(1);
  if (!assignment[0]) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this subject." });
  return profile.id;
}

async function assertFacultyOwnsSession(db: Awaited<ReturnType<typeof ensureDemoData>>, user: User, sessionId: number) {
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
  const session = (await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, sessionId)).limit(1))[0];
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Attendance session not found." });
  if (user.role === "admin") return session;
  await assertFacultyOwnsSubject(db, user, session.subjectId);
  return session;
}

function percentage(present: number, total: number) {
  return total ? Math.round((present / total) * 1000) / 10 : 0;
}
function analysis(attended: number, total: number, threshold: number) {
  const current = percentage(attended, total);
  const target = threshold / 100;
  const required = current >= threshold ? 0 : Math.max(0, Math.ceil((target * total - attended) / (1 - target)));
  let safeMisses = 0;
  while (total + safeMisses > 0 && percentage(attended, total + safeMisses + 1) >= threshold) safeMisses += 1;
  return { current, required, safeMisses };
}

async function getOverview(user: User) {
  const db = await ensureDemoData();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database is not available." });
  await ensureUserProfile(user);
  const policy = await getAttendancePolicy();
  const [subjectRows, sessionRows, recordRows, studentRows, facultyRows, enrolmentRows, activityRows, registrationRows, announcementRows, notificationRows, departmentRows] = await Promise.all([
    db.select().from(subjects),
    db.select().from(attendanceSessions),
    db.select().from(attendanceRecords),
    db.select().from(students),
    db.select().from(faculty),
    db.select().from(enrolments),
    db.select().from(activities).orderBy(asc(activities.startsAt)),
    db.select().from(activityRegistrations),
    db.select().from(announcements).orderBy(desc(announcements.publishedAt)).limit(6),
    db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(6),
    db.select().from(departments),
  ]);

  const currentStudent = await getCurrentStudent(user.id);
  const currentFaculty = await getCurrentFaculty(user.id);
  const isStudent = user.role === "student";
  const scopedStudent = isStudent ? currentStudent : undefined;
  const studentEnrolments = scopedStudent ? enrolmentRows.filter(row => row.studentId === scopedStudent.id) : [];
  const studentStats = scopedStudent ? subjectRows.filter(subject => studentEnrolments.some(row => row.subjectId === subject.id)).map(subject => {
    const subjectSessions = sessionRows.filter(session => session.subjectId === subject.id);
    const scoped = recordRows.filter(record => record.studentId === scopedStudent.id && subjectSessions.some(session => session.id === record.sessionId));
    const attended = scoped.filter(record => record.status === "present" || (record.status === "late" && policy.lateCountsAsPresent)).length;
    const insight = analysis(attended, scoped.length, policy.threshold);
    return { id: subject.id, name: subject.name, code: subject.code, conducted: scoped.length, attended, missed: scoped.filter(record => record.status === "absent").length, percentage: insight.current, required: insight.required, safeMisses: insight.safeMisses, status: insight.current >= policy.threshold ? "Safe" : insight.current >= policy.threshold - 8 ? "Warning" : "Low" };
  }) : [];
  const institutionSubjectStats = subjectRows.map(subject => {
    const subjectSessions = sessionRows.filter(session => session.subjectId === subject.id);
    const sessionIds = subjectSessions.map(session => session.id);
    const scoped = recordRows.filter(record => sessionIds.includes(record.sessionId));
    const attended = scoped.filter(record => record.status === "present" || (record.status === "late" && policy.lateCountsAsPresent)).length;
    const insight = analysis(attended, scoped.length, policy.threshold);
    return { id: subject.id, name: subject.name, code: subject.code, conducted: subjectSessions.length, attended, percentage: insight.current, required: insight.required, safeMisses: insight.safeMisses, status: insight.current >= policy.threshold ? "Safe" : insight.current >= policy.threshold - 8 ? "Warning" : "Low" };
  });
  const subjectStats = isStudent ? studentStats : institutionSubjectStats;
  const overallAttended = isStudent ? studentStats.reduce((sum, item) => sum + item.attended, 0) : recordRows.filter(record => record.status === "present" || (record.status === "late" && policy.lateCountsAsPresent)).length;
  const overallTotal = isStudent ? studentStats.reduce((sum, item) => sum + item.conducted, 0) : recordRows.length;
  const visibleAudience = user.role === "faculty" ? ["all", "faculty"] : user.role === "student" ? ["all", "students"] : ["all", "students", "faculty"];
  const withCounts = activityRows.map(activity => ({ ...activity, registrations: registrationRows.filter(reg => reg.activityId === activity.id).length, registered: Boolean(scopedStudent && registrationRows.some(reg => reg.activityId === activity.id && reg.studentId === scopedStudent.id)), department: departmentRows.find(dept => dept.id === activity.departmentId)?.name ?? "Campus Affairs" }));

  const facultySubjectIds = currentFaculty ? (await db.select({ subjectId: courseAssignments.subjectId }).from(courseAssignments).where(eq(courseAssignments.facultyId, currentFaculty.id))).map(row => row.subjectId) : [];
  const visibleSubjects = user.role === "faculty" && facultySubjectIds.length ? subjectRows.filter(subject => facultySubjectIds.includes(subject.id)) : subjectRows;
  const totalInstitutionalAttended = recordRows.filter(record => record.status === "present" || (record.status === "late" && policy.lateCountsAsPresent)).length;
  const facultyAvg = visibleSubjects.length ? Math.round(visibleSubjects.reduce((sum, subject) => {
    const sessions = sessionRows.filter(session => session.subjectId === subject.id).map(session => session.id);
    const rows = recordRows.filter(record => sessions.includes(record.sessionId));
    return sum + percentage(rows.filter(row => row.status === "present" || (row.status === "late" && policy.lateCountsAsPresent)).length, rows.length);
  }, 0) / visibleSubjects.length) : 0;
  const visibleEnrolledCount = user.role === "faculty" && facultySubjectIds.length
    ? new Set(enrolmentRows.filter(row => facultySubjectIds.includes(row.subjectId)).map(row => row.studentId)).size
    : studentRows.length;

  return {
    user: { id: user.id, name: user.name ?? "Campus user", email: user.email, role: user.role },
    policy,
    student: scopedStudent ? { id: scopedStudent.id, rollNumber: scopedStudent.rollNumber, course: scopedStudent.course, year: scopedStudent.year } : null,
    faculty: currentFaculty ? { id: currentFaculty.id, employeeCode: currentFaculty.employeeCode } : null,
    stats: {
      overallAttendance: percentage(overallAttended, overallTotal), totalClasses: overallTotal, attendedClasses: overallAttended,
      upcomingActivities: withCounts.filter(activity => new Date(activity.startsAt).getTime() > Date.now()).length,
      belowThreshold: subjectStats.filter(subject => subject.percentage < policy.threshold).length,
      students: visibleEnrolledCount, faculty: facultyRows.length, subjects: subjectRows.length, sessions: sessionRows.length,
      institutionAttendance: percentage(totalInstitutionalAttended, recordRows.length), facultyAverage: facultyAvg,
    },
    subjects: subjectStats,
    facultySubjects: visibleSubjects.map(subject => ({ ...subject, enrolled: enrolmentRows.filter(row => row.subjectId === subject.id).length, sessions: sessionRows.filter(session => session.subjectId === subject.id).length })),
    activities: withCounts.slice(0, 8),
    announcements: announcementRows.filter(announcement => visibleAudience.includes(announcement.audience)),
    notifications: notificationRows,
    trend: Array.from({ length: 6 }, (_, index) => {
      const end = sessionRows.length - index;
      const rows = sessionRows.slice(Math.max(0, end - 4), end).flatMap(session => recordRows.filter(record => record.sessionId === session.id));
      return { label: `W${6 - index}`, attendance: percentage(rows.filter(row => row.status === "present" || (row.status === "late" && policy.lateCountsAsPresent)).length, rows.length) };
    }).reverse(),
  };
}
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    overview: protectedProcedure.query(({ ctx }) => getOverview(ctx.user)),
  }),
  settings: router({
    get: protectedProcedure.query(() => getAttendancePolicy()),
    update: adminProcedure.input(z.object({ threshold: z.number().int().min(1).max(100), lateCountsAsPresent: z.boolean() })).mutation(async ({ input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      await db.update(appSettings).set({ attendanceThreshold: input.threshold, lateCountsAsPresent: input.lateCountsAsPresent ? 1 : 0 });
      return { ok: true };
    }),
  }),
  attendance: router({
    list: protectedProcedure.input(z.object({ subjectId: z.number().optional(), studentId: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const current = await getCurrentStudent(ctx.user.id);
      if (ctx.user.role === "student" && !current) return [];
      let sessionRows = await db.select().from(attendanceSessions).orderBy(desc(attendanceSessions.sessionDate));
      if (ctx.user.role === "faculty") {
        const profile = await getCurrentFaculty(ctx.user.id);
        if (!profile) throw new TRPCError({ code: "FORBIDDEN", message: "A faculty profile is required for this action." });
        const assignments = await db.select({ subjectId: courseAssignments.subjectId }).from(courseAssignments).where(eq(courseAssignments.facultyId, profile.id));
        const allowedSubjects = assignments.map(row => row.subjectId);
        if (input?.subjectId && !allowedSubjects.includes(input.subjectId)) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this subject." });
        sessionRows = sessionRows.filter(session => allowedSubjects.includes(session.subjectId));
      }
      const targetStudentId = ctx.user.role === "student" ? current?.id : ctx.user.role === "admin" ? input?.studentId : undefined;
      const recordRows = targetStudentId ? await db.select().from(attendanceRecords).where(eq(attendanceRecords.studentId, targetStudentId)) : await db.select().from(attendanceRecords);
      const subjectRows = await db.select().from(subjects);
      const visibleSessionIds = ctx.user.role === "student" && current
        ? new Set((await db.select({ subjectId: enrolments.subjectId }).from(enrolments).where(eq(enrolments.studentId, current.id))).map(row => row.subjectId))
        : undefined;
      return sessionRows.filter(session => (!input?.subjectId || session.subjectId === input.subjectId) && (!visibleSessionIds || visibleSessionIds.has(session.subjectId))).map(session => ({ ...session, subject: subjectRows.find(subject => subject.id === session.subjectId)?.name ?? "Subject", record: recordRows.find(record => record.sessionId === session.id) ?? null }));
    }),
    roster: facultyProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const session = await assertFacultyOwnsSession(db, ctx.user, input.sessionId);
      const roster = await db.select({ studentId: students.id, name: users.name, rollNumber: students.rollNumber }).from(enrolments).innerJoin(students, eq(students.id, enrolments.studentId)).innerJoin(users, eq(users.id, students.userId)).where(eq(enrolments.subjectId, session.subjectId)).orderBy(asc(students.rollNumber));
      const records = await db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, input.sessionId));
      return roster.map(student => ({ ...student, status: records.find(record => record.studentId === student.studentId)?.status ?? null }));
    }),
    createSession: facultyProcedure.input(z.object({ subjectId: z.number().int().positive(), sessionDate: z.string().min(8), sessionTime: z.string().min(4), section: z.string().min(1).max(20).default("A") })).mutation(async ({ ctx, input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const facultyId = await assertFacultyOwnsSubject(db, ctx.user, input.subjectId);
      if (!facultyId) throw new TRPCError({ code: "BAD_REQUEST", message: "Faculty profile is required." });
      const existing = await db.select({ id: attendanceSessions.id }).from(attendanceSessions).where(and(eq(attendanceSessions.subjectId, input.subjectId), eq(attendanceSessions.sessionDate, new Date(input.sessionDate)), eq(attendanceSessions.section, input.section))).limit(1);
      if (existing[0]) return { id: existing[0].id, existing: true };
      const inserted = await db.insert(attendanceSessions).values({ subjectId: input.subjectId, facultyId, sessionDate: new Date(input.sessionDate), sessionTime: input.sessionTime, section: input.section }).$returningId();
      return { id: inserted[0]?.id, existing: false };
    }),
    saveRecords: facultyProcedure.input(z.object({ sessionId: z.number().int().positive(), records: z.array(z.object({ studentId: z.number().int().positive(), status: z.enum(["present", "absent", "late"]) })) })).mutation(async ({ ctx, input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const session = await assertFacultyOwnsSession(db, ctx.user, input.sessionId);
      const enrolled = await db.select({ studentId: enrolments.studentId }).from(enrolments).where(eq(enrolments.subjectId, session.subjectId));
      const enrolledIds = new Set(enrolled.map(row => row.studentId));
      if (new Set(input.records.map(item => item.studentId)).size !== input.records.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Each student may appear only once." });
      if (input.records.some(item => !enrolledIds.has(item.studentId))) throw new TRPCError({ code: "BAD_REQUEST", message: "Every attendance record must belong to an enrolled student." });
      await db.transaction(async tx => {
        for (const item of input.records) {
          const existing = await tx.select({ id: attendanceRecords.id }).from(attendanceRecords).where(and(eq(attendanceRecords.sessionId, input.sessionId), eq(attendanceRecords.studentId, item.studentId))).limit(1);
          if (existing[0]) await tx.update(attendanceRecords).set({ status: item.status }).where(eq(attendanceRecords.id, existing[0].id));
          else await tx.insert(attendanceRecords).values({ sessionId: input.sessionId, studentId: item.studentId, status: item.status });
        }
      });
      return { ok: true };
    }),
  }),
  activities: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), category: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const rows = await db.select().from(activities).orderBy(asc(activities.startsAt));
      const regs = await db.select().from(activityRegistrations);
      const current = await getCurrentStudent(ctx.user.id);
      return rows.filter(row => !input?.search || row.title.toLowerCase().includes(input.search.toLowerCase())).filter(row => !input?.category || row.category === input.category).map(row => ({ ...row, registrations: regs.filter(reg => reg.activityId === row.id).length, registered: Boolean(current && regs.some(reg => reg.activityId === row.id && reg.studentId === current.id)), availableSeats: Math.max(0, row.capacity - regs.filter(reg => reg.activityId === row.id).length) }));
    }),
    register: protectedProcedure.input(z.object({ activityId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "student") throw new TRPCError({ code: "FORBIDDEN", message: "Only students can register for activities." });
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const current = await getCurrentStudent(ctx.user.id);
      const activity = (await db.select().from(activities).where(eq(activities.id, input.activityId)).limit(1))[0];
      if (!current || !activity) throw new TRPCError({ code: "NOT_FOUND" });
      if (activity.status !== "open" || new Date(activity.registrationDeadline).getTime() <= Date.now()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Registration for this activity is closed." });
      const existing = await db.select().from(activityRegistrations).where(and(eq(activityRegistrations.activityId, activity.id), eq(activityRegistrations.studentId, current.id))).limit(1);
      if (existing.length) throw new TRPCError({ code: "CONFLICT", message: "You are already registered for this activity." });
      const registrations = await db.select().from(activityRegistrations).where(eq(activityRegistrations.activityId, activity.id));
      if (registrations.length >= activity.capacity) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This activity is at capacity." });
      await db.insert(activityRegistrations).values({ activityId: activity.id, studentId: current.id });
      await db.insert(notifications).values({ userId: ctx.user.id, title: "Registration confirmed", body: `You are registered for ${activity.title}.`, kind: "activity", isRead: 0 });
      return { ok: true };
    }),
    cancel: protectedProcedure.input(z.object({ activityId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const current = await getCurrentStudent(ctx.user.id);
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });
      const activity = (await db.select().from(activities).where(eq(activities.id, input.activityId)).limit(1))[0];
      if (!activity) throw new TRPCError({ code: "NOT_FOUND" });
      if (activity.status === "completed" || new Date(activity.registrationDeadline).getTime() <= Date.now()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This registration can no longer be cancelled." });
      await db.delete(activityRegistrations).where(and(eq(activityRegistrations.activityId, input.activityId), eq(activityRegistrations.studentId, current.id)));
      return { ok: true };
    }),
    create: facultyProcedure.input(z.object({ title: z.string().min(3), description: z.string().min(10), category: z.enum(["Workshop", "Seminar", "Hackathon", "Competition", "Guest lecture", "Club", "Cultural", "Sports"]), startsAt: z.string(), venue: z.string().min(2), registrationDeadline: z.string(), capacity: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const f = (await getCurrentFaculty(ctx.user.id)) ?? (ctx.user.role === "admin" ? (await db.select().from(faculty).limit(1))[0] : undefined);
      const d = (await db.select().from(departments).limit(1))[0];
      if (!f || !d) throw new TRPCError({ code: "BAD_REQUEST" });
      const startsAt = new Date(input.startsAt);
      const registrationDeadline = new Date(input.registrationDeadline);
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(registrationDeadline.getTime()) || registrationDeadline >= startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Registration deadline must be before the activity start time." });
      const result = await db.insert(activities).values({ ...input, startsAt, registrationDeadline, departmentId: d.id, coordinatorFacultyId: f.id, status: "open" }).$returningId();
      return { id: result[0]?.id };
    }),
  }),
  notifications: router({
    markRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      await db.update(notifications).set({ isRead: 1 }).where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
      return { ok: true };
    }),
  }),
  admin: router({
    students: adminProcedure.input(z.object({ search: z.string().optional() }).optional()).query(async ({ input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const rows = await db.select().from(students).orderBy(asc(students.rollNumber));
      const allUsers = await db.select().from(users);
      return rows.map(row => ({ ...row, name: allUsers.find(user => user.id === row.userId)?.name ?? "Student" })).filter(row => {
        const search = input?.search?.trim().toLowerCase();
        return !search || row.rollNumber.toLowerCase().includes(search) || row.name.toLowerCase().includes(search);
      });
    }),
    faculty: adminProcedure.query(async () => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const rows = await db.select().from(faculty);
      const allUsers = await db.select().from(users);
      return rows.map(row => ({ ...row, name: allUsers.find(user => user.id === row.userId)?.name ?? "Faculty" }));
    }),
    departments: adminProcedure.query(async () => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      return db.select().from(departments).orderBy(asc(departments.name));
    }),
    studentEnrollments: adminProcedure.input(z.object({ studentId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const rows = await db.select().from(enrolments).where(eq(enrolments.studentId, input.studentId));
      const subjectRows = await db.select().from(subjects);
      const assignmentRows = await db.select().from(courseAssignments);
      const facultyRows = await db.select().from(faculty);
      const facultyUsers = await db.select().from(users);
      return rows.map(row => {
        const subject = subjectRows.find(item => item.id === row.subjectId);
        const assignment = assignmentRows.find(item => item.subjectId === row.subjectId);
        const profile = facultyRows.find(item => item.id === assignment?.facultyId);
        return { ...row, subject, faculty: profile ? facultyUsers.find(user => user.id === profile.userId)?.name ?? "Faculty" : "Unassigned", section: assignment?.section ?? "A" };
      });
    }),
    addEnrollment: adminProcedure.input(z.object({ studentId: z.number().int().positive(), subjectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const [student, subject] = await Promise.all([
        db.select({ id: students.id }).from(students).where(eq(students.id, input.studentId)).limit(1),
        db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, input.subjectId)).limit(1),
      ]);
      if (!student[0] || !subject[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Student or subject not found." });
      const existing = await db.select({ id: enrolments.id }).from(enrolments).where(and(eq(enrolments.studentId, input.studentId), eq(enrolments.subjectId, input.subjectId))).limit(1);
      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "The student is already enrolled in this subject." });
      await db.insert(enrolments).values(input);
      return { ok: true };
    }),
    removeEnrollment: adminProcedure.input(z.object({ studentId: z.number().int().positive(), subjectId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      await db.delete(enrolments).where(and(eq(enrolments.studentId, input.studentId), eq(enrolments.subjectId, input.subjectId)));
      return { ok: true };
    }),
    assignments: adminProcedure.query(async () => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const [subjectRows, assignmentRows, facultyRows, facultyUsers] = await Promise.all([
        db.select().from(subjects).orderBy(asc(subjects.name)),
        db.select().from(courseAssignments),
        db.select().from(faculty),
        db.select().from(users),
      ]);
      return subjectRows.map(subject => ({
        ...subject,
        assignments: assignmentRows.filter(row => row.subjectId === subject.id).map(row => ({
          ...row,
          faculty: facultyUsers.find(user => user.id === facultyRows.find(item => item.id === row.facultyId)?.userId)?.name ?? "Faculty",
        })),
      }));
    }),
    setAssignment: adminProcedure.input(z.object({ subjectId: z.number().int().positive(), facultyId: z.number().int().positive(), section: z.string().min(1).max(20).default("A") })).mutation(async ({ input }) => {
      const db = await ensureDemoData();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      const [subject, facultyProfile] = await Promise.all([
        db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, input.subjectId)).limit(1),
        db.select({ id: faculty.id }).from(faculty).where(eq(faculty.id, input.facultyId)).limit(1),
      ]);
      if (!subject[0] || !facultyProfile[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Subject or faculty not found." });
      const existing = await db.select({ id: courseAssignments.id }).from(courseAssignments).where(and(eq(courseAssignments.subjectId, input.subjectId), eq(courseAssignments.section, input.section))).limit(1);
      if (existing[0]) await db.update(courseAssignments).set({ facultyId: input.facultyId }).where(eq(courseAssignments.id, existing[0].id));
      else await db.insert(courseAssignments).values(input);
      return { ok: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
