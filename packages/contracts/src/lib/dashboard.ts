import { z } from 'zod';

import {
  CourseCodeSchema,
  CourseDocumentAnnotationSchema,
  ProfessorCourseListItemSchema,
  StudentCourseListItemSchema,
} from './course-management.js';
import { ForumThreadListItemSchema } from './forum.js';

export const DashboardForumThreadItemSchema = ForumThreadListItemSchema.extend(
  {
    courseCode: CourseCodeSchema,
    courseTitle: z.string().min(1),
  },
);

export const DashboardAnnotationItemSchema = CourseDocumentAnnotationSchema.extend(
  {
    courseCode: CourseCodeSchema,
    courseTitle: z.string().min(1),
  },
);

export const StudentDashboardSchema = z.object({
  courses: z.array(StudentCourseListItemSchema),
  recentNotes: z.array(DashboardAnnotationItemSchema),
  openQuestions: z.array(DashboardForumThreadItemSchema),
  verifiedAnswers: z.array(DashboardForumThreadItemSchema),
  activeDiscussions: z.array(DashboardForumThreadItemSchema),
});

export const StudentDashboardResponseSchema = z.object({
  data: StudentDashboardSchema,
});

export const ProfessorDashboardCourseCountersSchema = z.object({
  courseId: z.uuid(),
  courseCode: CourseCodeSchema,
  courseTitle: z.string().min(1),
  unansweredCount: z.number().int().nonnegative(),
  openCount: z.number().int().nonnegative(),
  recentlyVerifiedCount: z.number().int().nonnegative(),
});

export const ProfessorDashboardSchema = z.object({
  courses: z.array(ProfessorCourseListItemSchema),
  unansweredThreads: z.array(DashboardForumThreadItemSchema),
  openThreads: z.array(DashboardForumThreadItemSchema),
  recentActivity: z.array(DashboardForumThreadItemSchema),
  perCourseCounters: z.array(ProfessorDashboardCourseCountersSchema),
});

export const ProfessorDashboardResponseSchema = z.object({
  data: ProfessorDashboardSchema,
});

export type DashboardForumThreadItem = z.infer<
  typeof DashboardForumThreadItemSchema
>;
export type DashboardAnnotationItem = z.infer<
  typeof DashboardAnnotationItemSchema
>;
export type StudentDashboard = z.infer<typeof StudentDashboardSchema>;
export type StudentDashboardResponse = z.infer<
  typeof StudentDashboardResponseSchema
>;
export type ProfessorDashboardCourseCounters = z.infer<
  typeof ProfessorDashboardCourseCountersSchema
>;
export type ProfessorDashboard = z.infer<typeof ProfessorDashboardSchema>;
export type ProfessorDashboardResponse = z.infer<
  typeof ProfessorDashboardResponseSchema
>;
