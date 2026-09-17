import { z } from 'zod';

import {
  CourseCodeSchema,
  CourseDocumentAnnotationSchema,
  ProfessorCourseListItemSchema,
  StudentCourseListItemSchema,
} from './course-management.js';
import { RoadmapProgressStatusSchema } from './enums.js';
import { ForumThreadListItemSchema } from './forum.js';

export const DashboardForumThreadItemSchema = ForumThreadListItemSchema.extend({
  courseCode: CourseCodeSchema,
  courseTitle: z.string().min(1),
});

export const DashboardAnnotationItemSchema =
  CourseDocumentAnnotationSchema.extend({
    courseCode: CourseCodeSchema,
    courseTitle: z.string().min(1),
  });

export const StudentDashboardRoadmapSummarySchema = z.object({
  totalNodeCount: z.number().int().nonnegative(),
  completedNodeCount: z.number().int().nonnegative(),
  completionPercentage: z.number().min(0).max(100),
  needsReviewCount: z.number().int().nonnegative(),
});

export const StudentDashboardCourseSchema = StudentCourseListItemSchema.extend({
  roadmap: StudentDashboardRoadmapSummarySchema,
});

export const StudentDashboardContinueNodeSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  courseCode: CourseCodeSchema,
  courseTitle: z.string().min(1),
  title: z.string().min(1),
  status: RoadmapProgressStatusSchema.exclude(['completed']),
  estimatedMinutes: z.number().int().positive().nullable(),
});

export const StudentDashboardSchema = z.object({
  courses: z.array(StudentDashboardCourseSchema),
  continueLearning: StudentDashboardContinueNodeSchema.nullable(),
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
export type StudentDashboardRoadmapSummary = z.infer<
  typeof StudentDashboardRoadmapSummarySchema
>;
export type StudentDashboardCourse = z.infer<
  typeof StudentDashboardCourseSchema
>;
export type StudentDashboardContinueNode = z.infer<
  typeof StudentDashboardContinueNodeSchema
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
