import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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
  notifications,
  students,
  subjects,
  type InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export const isDemoMode = () => process.env.DEMO_MODE === "true";

export const demoUser = {
  id: 1,
  openId: "demo-admin-001",
  name: "Ananya Menon",
  email: "ananya.admin@smartcurriculum.demo",
  loginMethod: "demo",
  role: "admin" as const,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
  lastSignedIn: new Date(),
};

const demoActivities = [
  ["Build with AI: Product Sprint", "Hackathon", "Innovation Lab", 60],
  ["Designing for Accessibility", "Workshop", "Seminar Hall 2", 90],
  ["Industry Connect: Cloud Careers", "Guest lecture", "Main Auditorium", 250],
  ["Campus Coding League", "Competition", "Lab 3", 40],
].map(([title, category, venue, capacity], index) => {
  const startsAt = new Date(Date.now() + (index + 3) * 86400000);
  return {
    id: index + 1,
    title,
    description: "A sample campus activity available in the Smart Curriculum demo.",
    category,
    startsAt,
    venue,
    capacity,
    registrationDeadline: new Date(startsAt.getTime() - 86400000),
    status: "open",
    registrations: index + 2,
    registered: false,
    availableSeats: Number(capacity) - index - 2,
    department: "Computer Science & Engineering",
  };
});

export function getDemoOverview() {
  const subjects = [
    { id: 1, name: "Data Structures", code: "CS201", conducted: 8, attended: 7, missed: 1, percentage: 87.5, required: 0, safeMisses: 1, status: "Safe" },
    { id: 2, name: "Database Management", code: "CS202", conducted: 8, attended: 6, missed: 2, percentage: 75, required: 0, safeMisses: 0, status: "Safe" },
    { id: 3, name: "Computer Networks", code: "CS203", conducted: 8, attended: 5, missed: 3, percentage: 62.5, required: 4, safeMisses: 0, status: "Low" },
    { id: 4, name: "Operating Systems", code: "CS204", conducted: 8, attended: 6, missed: 2, percentage: 75, required: 0, safeMisses: 0, status: "Safe" },
  ];
  return {
    user: { id: demoUser.id, name: demoUser.name, email: demoUser.email, role: demoUser.role },
    policy: { threshold: 75, lateCountsAsPresent: true },
    student: null, faculty: { id: 1, employeeCode: "DEMO-001" },
    stats: { overallAttendance: 75, totalClasses: 32, attendedClasses: 24, upcomingActivities: demoActivities.length, belowThreshold: 1, students: 20, faculty: 3, subjects: subjects.length, sessions: 40, institutionAttendance: 78.4, facultyAverage: 78.4 },
    subjects,
    facultySubjects: subjects.map(subject => ({ ...subject, enrolled: 20, sessions: 8 })),
    activities: demoActivities,
    announcements: [{ id: 1, title: "Welcome to the Smart Curriculum demo", body: "This read-only workspace contains representative campus data.", audience: "all", publishedAt: new Date() }],
    notifications: [],
    trend: [74, 76, 73, 79, 77, 78].map((attendance, index) => ({ label: `W${index + 1}`, attendance })),
  };
}

export function getDemoActivities(input?: { search?: string; category?: string }) {
  return demoActivities.filter(item => (!input?.search || String(item.title).toLowerCase().includes(input.search.toLowerCase())) && (!input?.category || item.category === input.category));
}

const demoSubjects = [
  { id: 1, name: "Data Structures", code: "CS201", departmentId: 1, credits: 4 },
  { id: 2, name: "Database Management", code: "CS202", departmentId: 1, credits: 4 },
  { id: 3, name: "Computer Networks", code: "CS203", departmentId: 1, credits: 3 },
  { id: 4, name: "Operating Systems", code: "CS204", departmentId: 1, credits: 4 },
];

const demoStudents = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  userId: index + 10,
  rollNumber: `SC24CSE${String(index + 1).padStart(3, "0")}`,
  course: "B.Tech Computer Science",
  year: 2,
  departmentId: 1,
  name: ["Aarav Nair", "Diya Joseph", "Kabir Singh", "Nisha Verma", "Arjun Das", "Ishita Roy", "Vihaan Kapoor", "Sana Khan"][index],
}));

export function getDemoAdminData() {
  const faculty = [
    { id: 1, userId: 2, employeeCode: "FAC-001", departmentId: 1, name: "Dr. Rohan Iyer" },
    { id: 2, userId: 3, employeeCode: "FAC-002", departmentId: 1, name: "Prof. Meera Shah" },
  ];
  const departments = [
    { id: 1, name: "Computer Science & Engineering", code: "CSE" },
    { id: 2, name: "Electronics & Communication", code: "ECE" },
    { id: 3, name: "Student Affairs", code: "SA" },
  ];
  const enrollments = demoStudents.flatMap(student => demoSubjects.slice(0, 3).map((subject, index) => ({
    id: student.id * 10 + index,
    studentId: student.id,
    subjectId: subject.id,
    subject,
    faculty: faculty[index % faculty.length].name,
    section: "A",
  })));
  const assignments = demoSubjects.map((subject, index) => ({
    ...subject,
    assignments: [{ id: index + 1, subjectId: subject.id, facultyId: faculty[index % faculty.length].id, section: "A", faculty: faculty[index % faculty.length].name }],
  }));
  return { students: demoStudents, faculty, departments, enrollments, assignments, subjects: demoSubjects };
}

export function getDemoAttendance() {
  const sessions = demoSubjects.slice(0, 3).flatMap((subject, subjectIndex) =>
    [0, 1].map(index => ({
      id: subjectIndex * 2 + index + 1,
      subjectId: subject.id,
      subject: subject.name,
      sessionDate: new Date(Date.now() - (index + subjectIndex + 1) * 86400000),
      sessionTime: index ? "11:00:00" : "09:00:00",
      record: { id: subjectIndex * 2 + index + 1, sessionId: subjectIndex * 2 + index + 1, studentId: 10, status: (index ? "present" : "late") as "present" | "absent" | "late" },
    }))
  );
  const roster = demoStudents.map((student, index) => ({
    studentId: student.id,
    name: student.name,
    rollNumber: student.rollNumber,
    status: (index % 4 === 0 ? "late" : index % 5 === 0 ? "absent" : "present") as "present" | "absent" | "late",
  }));
  return { sessions, roster };
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = values[field];
    }
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  if (isDemoMode() && openId === demoUser.openId) return demoUser;
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

async function idByOpenId(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, openId: string) {
  const row = await db.select({ id: users.id }).from(users).where(eq(users.openId, openId)).limit(1);
  return row[0]?.id;
}

export async function ensureDemoData() {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select({ id: departments.id }).from(departments).limit(1);
  if (existing.length) return db;

  await db.insert(departments).values([
    { name: "Computer Science & Engineering", code: "CSE" },
    { name: "Electronics & Communication", code: "ECE" },
    { name: "Student Affairs", code: "SA" },
  ]);
  const deptRows = await db.select().from(departments);
  const cse = deptRows.find(d => d.code === "CSE")!;
  const ece = deptRows.find(d => d.code === "ECE")!;
  const sa = deptRows.find(d => d.code === "SA")!;

  const demoUsers = [
    { openId: "demo-admin-001", name: "Ananya Menon", email: "ananya.admin@smartcurriculum.demo", role: "admin" as const, loginMethod: "demo-seed" },
    { openId: "demo-faculty-001", name: "Dr. Rohan Iyer", email: "rohan.iyer@smartcurriculum.demo", role: "faculty" as const, loginMethod: "demo-seed" },
    { openId: "demo-faculty-002", name: "Prof. Meera Shah", email: "meera.shah@smartcurriculum.demo", role: "faculty" as const, loginMethod: "demo-seed" },
    { openId: "demo-faculty-003", name: "Dr. Vikram Rao", email: "vikram.rao@smartcurriculum.demo", role: "faculty" as const, loginMethod: "demo-seed" },
    ...Array.from({ length: 20 }, (_, index) => ({
      openId: `demo-student-${String(index + 1).padStart(3, "0")}`,
      name: ["Aarav Nair", "Diya Joseph", "Kabir Singh", "Nisha Verma", "Arjun Das", "Ishita Roy", "Vihaan Kapoor", "Sana Khan", "Neil Mathew", "Tara Bose", "Riya Patel", "Aditya Jain", "Maya Thomas", "Yash Gupta", "Anika Sen", "Reyansh Kulkarni", "Sara Ali", "Dev Menon", "Kiara Rao", "Ojas Iyer"][index],
      email: `student${index + 1}@smartcurriculum.demo`,
      role: "student" as const,
      loginMethod: "demo-seed",
    })),
  ];
  await db.insert(users).values(demoUsers);
  const adminId = await idByOpenId(db, "demo-admin-001");
  const facultyIds = await Promise.all([1, 2, 3].map(index => idByOpenId(db, `demo-faculty-${String(index).padStart(3, "0")}`)));
  const studentIds = await Promise.all(Array.from({ length: 20 }, (_, index) => idByOpenId(db, `demo-student-${String(index + 1).padStart(3, "0")}`)));

  await db.insert(faculty).values([
    { userId: facultyIds[0]!, employeeCode: "FAC-001", departmentId: cse.id },
    { userId: facultyIds[1]!, employeeCode: "FAC-002", departmentId: cse.id },
    { userId: facultyIds[2]!, employeeCode: "FAC-003", departmentId: ece.id },
  ]);
  const facultyRows = await db.select().from(faculty);

  await db.insert(students).values(studentIds.map((userId, index) => ({
    userId: userId!, rollNumber: `SC24CSE${String(index + 1).padStart(3, "0")}`, course: "B.Tech Computer Science", year: index < 10 ? 2 : 3, departmentId: index % 5 === 0 ? ece.id : cse.id,
  })));
  const studentRows = await db.select().from(students);

  await db.insert(subjects).values([
    { name: "Data Structures", code: "CS201", departmentId: cse.id, credits: 4 },
    { name: "Database Management", code: "CS202", departmentId: cse.id, credits: 4 },
    { name: "Computer Networks", code: "CS203", departmentId: cse.id, credits: 3 },
    { name: "Operating Systems", code: "CS204", departmentId: cse.id, credits: 4 },
    { name: "Digital Communication", code: "EC205", departmentId: ece.id, credits: 3 },
  ]);
  const subjectRows = await db.select().from(subjects);
  await db.insert(courseAssignments).values(subjectRows.map((subject, index) => ({ subjectId: subject.id, facultyId: facultyRows[index % facultyRows.length].id, section: "A" })));
  await db.insert(enrolments).values(studentRows.flatMap(student => subjectRows.map(subject => ({ studentId: student.id, subjectId: subject.id }))));

  const sessionSeeds = subjectRows.flatMap((subject, subjectIndex) => Array.from({ length: 8 }, (_, index) => ({
    subjectId: subject.id,
    facultyId: facultyRows[subjectIndex % facultyRows.length].id,
    sessionDate: new Date(Date.now() - (8 - index) * 4 * 86400000),
    sessionTime: index % 2 === 0 ? "09:00:00" : "11:00:00",
    section: "A",
  })));
  await db.insert(attendanceSessions).values(sessionSeeds);
  const sessionRows = await db.select().from(attendanceSessions);
  const records = sessionRows.flatMap(session => studentRows.map(student => {
    const score = (student.id + session.id + session.subjectId) % 10;
    return { sessionId: session.id, studentId: student.id, status: (score < 2 ? "absent" : score === 2 ? "late" : "present") as "present" | "absent" | "late" };
  }));
  await db.insert(attendanceRecords).values(records);

  const now = Date.now();
  await db.insert(activities).values([
    { title: "Build with AI: Product Sprint", description: "A hands-on product sprint for turning campus problems into useful prototypes.", category: "Hackathon", startsAt: new Date(now + 3 * 86400000), venue: "Innovation Lab", departmentId: cse.id, coordinatorFacultyId: facultyRows[0].id, registrationDeadline: new Date(now + 2 * 86400000), capacity: 60, status: "open" },
    { title: "Designing for Accessibility", description: "Learn how to build interfaces that work for everyone.", category: "Workshop", startsAt: new Date(now + 6 * 86400000), venue: "Seminar Hall 2", departmentId: cse.id, coordinatorFacultyId: facultyRows[1].id, registrationDeadline: new Date(now + 5 * 86400000), capacity: 90, status: "open" },
    { title: "Industry Connect: Cloud Careers", description: "A candid conversation with engineers about skills, internships, and first roles.", category: "Guest lecture", startsAt: new Date(now + 9 * 86400000), venue: "Main Auditorium", departmentId: sa.id, coordinatorFacultyId: facultyRows[2].id, registrationDeadline: new Date(now + 8 * 86400000), capacity: 250, status: "open" },
    { title: "Campus Coding League", description: "Weekly competitive programming practice with a friendly leaderboard.", category: "Competition", startsAt: new Date(now + 12 * 86400000), venue: "Lab 3", departmentId: cse.id, coordinatorFacultyId: facultyRows[0].id, registrationDeadline: new Date(now + 11 * 86400000), capacity: 40, status: "open" },
    { title: "Robotics Club Open House", description: "Meet the teams and see what you can build this semester.", category: "Club", startsAt: new Date(now + 15 * 86400000), venue: "Makerspace", departmentId: ece.id, coordinatorFacultyId: facultyRows[2].id, registrationDeadline: new Date(now + 14 * 86400000), capacity: 80, status: "open" },
    { title: "Monsoon Music Evening", description: "An evening of student performances, acoustic sets, and campus stories.", category: "Cultural", startsAt: new Date(now + 18 * 86400000), venue: "Amphitheatre", departmentId: sa.id, coordinatorFacultyId: facultyRows[1].id, registrationDeadline: new Date(now + 16 * 86400000), capacity: 300, status: "upcoming" },
    { title: "Inter-department Futsal", description: "Register your team for the semester sports fixture.", category: "Sports", startsAt: new Date(now + 21 * 86400000), venue: "East Ground", departmentId: sa.id, coordinatorFacultyId: facultyRows[2].id, registrationDeadline: new Date(now + 17 * 86400000), capacity: 120, status: "open" },
    { title: "Research Paper Clinic", description: "A practical seminar on finding a question, structuring a paper, and presenting evidence.", category: "Seminar", startsAt: new Date(now + 24 * 86400000), venue: "Library Seminar Room", departmentId: cse.id, coordinatorFacultyId: facultyRows[1].id, registrationDeadline: new Date(now + 23 * 86400000), capacity: 50, status: "open" },
  ]);
  const activityRows = await db.select().from(activities);
  await db.insert(activityRegistrations).values(activityRows.slice(0, 4).flatMap((activity, index) => studentRows.slice(0, index + 2).map(student => ({ activityId: activity.id, studentId: student.id }))));
  await db.insert(announcements).values([
    { title: "Mid-semester attendance review", body: "Please review subject attendance before the next advising window. Students below 75% should speak with their faculty coordinator.", audience: "students", authorUserId: adminId! },
    { title: "Faculty sync this Friday", body: "The weekly faculty sync will cover attendance exceptions and upcoming activity calendars.", audience: "faculty", authorUserId: adminId! },
    { title: "Spring activity calendar is live", body: "Eight new workshops, talks, and campus events are now open for registration.", audience: "all", authorUserId: adminId! },
  ]);
  await db.insert(notifications).values([
    { userId: studentIds[0]!, title: "Attendance needs attention", body: "Database Management is at 68%. Attend the next 2 classes to get back to the safe zone.", kind: "attendance", isRead: 0 },
    { userId: studentIds[0]!, title: "Registration confirmed", body: "You are registered for Build with AI: Product Sprint.", kind: "activity", isRead: 0 },
    { userId: studentIds[0]!, title: "New announcement", body: "Spring activity calendar is live.", kind: "announcement", isRead: 1 },
  ]);
  await db.insert(appSettings).values({ attendanceThreshold: 75, lateCountsAsPresent: 1 });
  return db;
}

export async function getCurrentStudent(userId: number) {
  const db = await ensureDemoData();
  if (!db) return undefined;
  return (await db.select().from(students).where(eq(students.userId, userId)).limit(1))[0];
}

export async function getCurrentFaculty(userId: number) {
  const db = await ensureDemoData();
  if (!db) return undefined;
  return (await db.select().from(faculty).where(eq(faculty.userId, userId)).limit(1))[0];
}

export async function ensureUserProfile(user: { id: number; role: "student" | "faculty" | "admin" }) {
  const db = await ensureDemoData();
  if (!db || user.role === "admin") return db;
  const department = (await db.select().from(departments).where(eq(departments.code, "CSE")).limit(1))[0];
  if (!department) return db;
  if (user.role === "student") {
    const current = await getCurrentStudent(user.id);
    if (!current) {
      await db.insert(students).values({ userId: user.id, rollNumber: `LIVE${user.id}`, course: "B.Tech Computer Science", year: 2, departmentId: department.id });
      const profile = await getCurrentStudent(user.id);
      const subjectRows = await db.select({ id: subjects.id }).from(subjects);
      if (profile && subjectRows.length) await db.insert(enrolments).values(subjectRows.map(subject => ({ studentId: profile.id, subjectId: subject.id })));
    }
  } else if (!(await getCurrentFaculty(user.id))) {
    await db.insert(faculty).values({ userId: user.id, employeeCode: `LIVE-FAC-${user.id}`, departmentId: department.id });
  }
  return db;
}

export async function getAttendancePolicy() {
  const db = await ensureDemoData();
  if (!db) return { threshold: 75, lateCountsAsPresent: true };
  const row = (await db.select().from(appSettings).limit(1))[0];
  return { threshold: row?.attendanceThreshold ?? 75, lateCountsAsPresent: Boolean(row?.lateCountsAsPresent ?? 1) };
}

export { activities, activityRegistrations, announcements, appSettings, attendanceRecords, attendanceSessions, courseAssignments, departments, enrolments, faculty, notifications, students, subjects, users };
