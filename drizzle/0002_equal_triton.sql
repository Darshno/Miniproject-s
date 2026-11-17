ALTER TABLE `activityRegistrations` ADD CONSTRAINT `activity_registration_unique` UNIQUE(`activityId`,`studentId`);--> statement-breakpoint
ALTER TABLE `attendanceRecords` ADD CONSTRAINT `attendance_record_unique` UNIQUE(`sessionId`,`studentId`);--> statement-breakpoint
ALTER TABLE `courseAssignments` ADD CONSTRAINT `course_assignment_unique` UNIQUE(`subjectId`,`facultyId`,`section`);--> statement-breakpoint
ALTER TABLE `enrolments` ADD CONSTRAINT `enrolment_unique` UNIQUE(`studentId`,`subjectId`);