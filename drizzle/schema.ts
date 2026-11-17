import {
  date,
  foreignKey,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["student", "faculty", "admin"]).default("student").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  rollNumber: varchar("rollNumber", { length: 40 }).notNull().unique(),
  course: varchar("course", { length: 120 }).notNull(),
  year: int("year").notNull(),
  departmentId: int("departmentId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userFk: foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "student_user_fk" }), departmentFk: foreignKey({ columns: [table.departmentId], foreignColumns: [departments.id], name: "student_department_fk" }) }));

export const faculty = mysqlTable("faculty", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  employeeCode: varchar("employeeCode", { length: 40 }).notNull().unique(),
  departmentId: int("departmentId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userFk: foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "faculty_user_fk" }), departmentFk: foreignKey({ columns: [table.departmentId], foreignColumns: [departments.id], name: "faculty_department_fk" }) }));

export const subjects = mysqlTable("subjects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  code: varchar("code", { length: 30 }).notNull().unique(),
  departmentId: int("departmentId").notNull(),
  credits: int("credits").notNull().default(3),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ departmentFk: foreignKey({ columns: [table.departmentId], foreignColumns: [departments.id], name: "subject_department_fk" }) }));

export const courseAssignments = mysqlTable("courseAssignments", {
  id: int("id").autoincrement().primaryKey(),
  subjectId: int("subjectId").notNull(),
  facultyId: int("facultyId").notNull(),
  section: varchar("section", { length: 20 }).notNull().default("A"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ assignmentUnique: uniqueIndex("course_assignment_unique").on(table.subjectId, table.facultyId, table.section), subjectFk: foreignKey({ columns: [table.subjectId], foreignColumns: [subjects.id], name: "assignment_subject_fk" }), facultyFk: foreignKey({ columns: [table.facultyId], foreignColumns: [faculty.id], name: "assignment_faculty_fk" }) }));

export const enrolments = mysqlTable("enrolments", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  subjectId: int("subjectId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ enrolmentUnique: uniqueIndex("enrolment_unique").on(table.studentId, table.subjectId), studentFk: foreignKey({ columns: [table.studentId], foreignColumns: [students.id], name: "enrolment_student_fk" }), subjectFk: foreignKey({ columns: [table.subjectId], foreignColumns: [subjects.id], name: "enrolment_subject_fk" }) }));

export const attendanceSessions = mysqlTable("attendanceSessions", {
  id: int("id").autoincrement().primaryKey(),
  subjectId: int("subjectId").notNull(),
  facultyId: int("facultyId").notNull(),
  sessionDate: date("sessionDate").notNull(),
  sessionTime: time("sessionTime").notNull(),
  section: varchar("section", { length: 20 }).notNull().default("A"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ sessionUnique: uniqueIndex("attendance_session_unique").on(table.subjectId, table.sessionDate, table.sessionTime, table.section), subjectFk: foreignKey({ columns: [table.subjectId], foreignColumns: [subjects.id], name: "session_subject_fk" }), facultyFk: foreignKey({ columns: [table.facultyId], foreignColumns: [faculty.id], name: "session_faculty_fk" }) }));

export const attendanceRecords = mysqlTable("attendanceRecords", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentId: int("studentId").notNull(),
  status: mysqlEnum("status", ["present", "absent", "late"]).notNull(),
  markedAt: timestamp("markedAt").defaultNow().notNull(),
}, (table) => ({ recordUnique: uniqueIndex("attendance_record_unique").on(table.sessionId, table.studentId), sessionFk: foreignKey({ columns: [table.sessionId], foreignColumns: [attendanceSessions.id], name: "record_session_fk" }), studentFk: foreignKey({ columns: [table.studentId], foreignColumns: [students.id], name: "record_student_fk" }) }));

export const activities = mysqlTable("activities", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull(),
  category: mysqlEnum("category", ["Workshop", "Seminar", "Hackathon", "Competition", "Guest lecture", "Club", "Cultural", "Sports"]).notNull(),
  startsAt: timestamp("startsAt").notNull(),
  venue: varchar("venue", { length: 160 }).notNull(),
  departmentId: int("departmentId").notNull(),
  coordinatorFacultyId: int("coordinatorFacultyId").notNull(),
  registrationDeadline: timestamp("registrationDeadline").notNull(),
  capacity: int("capacity").notNull(),
  status: mysqlEnum("status", ["upcoming", "open", "closed", "completed"]).notNull().default("open"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ departmentFk: foreignKey({ columns: [table.departmentId], foreignColumns: [departments.id], name: "activity_department_fk" }), facultyFk: foreignKey({ columns: [table.coordinatorFacultyId], foreignColumns: [faculty.id], name: "activity_faculty_fk" }) }));

export const activityRegistrations = mysqlTable("activityRegistrations", {
  id: int("id").autoincrement().primaryKey(),
  activityId: int("activityId").notNull(),
  studentId: int("studentId").notNull(),
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
}, (table) => ({ registrationUnique: uniqueIndex("activity_registration_unique").on(table.activityId, table.studentId), activityFk: foreignKey({ columns: [table.activityId], foreignColumns: [activities.id], name: "registration_activity_fk" }), studentFk: foreignKey({ columns: [table.studentId], foreignColumns: [students.id], name: "registration_student_fk" }) }));

export const announcements = mysqlTable("announcements", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body").notNull(),
  audience: mysqlEnum("audience", ["all", "students", "faculty"]).notNull().default("all"),
  authorUserId: int("authorUserId").notNull(),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
}, (table) => ({ authorFk: foreignKey({ columns: [table.authorUserId], foreignColumns: [users.id], name: "announcement_author_fk" }) }));

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body").notNull(),
  kind: varchar("kind", { length: 40 }).notNull(),
  isRead: int("isRead").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userFk: foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "notification_user_fk" }) }));

export const appSettings = mysqlTable("appSettings", {
  id: int("id").autoincrement().primaryKey(),
  attendanceThreshold: int("attendanceThreshold").notNull().default(75),
  lateCountsAsPresent: int("lateCountsAsPresent").notNull().default(1),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Student = typeof students.$inferSelect;
export type Faculty = typeof faculty.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type AttendanceSession = typeof attendanceSessions.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
