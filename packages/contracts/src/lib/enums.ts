import { z } from 'zod';

export const userRoleValues = ['admin', 'professor', 'student'] as const;
export const enrollmentStatusValues = [
  'active',
  'inactive',
  'completed',
] as const;
export const courseInstructorRoleValues = ['owner', 'assistant'] as const;
export const documentStatusValues = ['active', 'replaced', 'deleted'] as const;
export const documentVisibilityValues = [
  'visible_to_students',
  'hidden_from_students',
] as const;
export const forumCategoryKindValues = [
  'general',
  'document_discussion',
  'archived_document_discussion',
] as const;
export const forumThreadStatusValues = [
  'open',
  'instructor_answered',
  'verified',
  'resolved',
  'archived',
] as const;
export const difficultyLevelValues = ['low', 'medium', 'high'] as const;
export const completionRuleValues = [
  'manual',
  'self_check',
  'view_resource',
] as const;
export const roadmapProgressStatusValues = [
  'not_started',
  'in_progress',
  'completed',
  'needs_review',
] as const;
export const roadmapResourceTypeValues = [
  'document_page',
  'document_section',
  'external_url',
  'text_note',
] as const;
export const annotationTypeValues = [
  'highlight',
  'note',
  'question',
  'important',
  'confusing',
] as const;
export const annotationVisibilityValues = [
  'private',
  'public',
  'instructor_only',
] as const;
export const threadLinkTypeValues = ['duplicate', 'related'] as const;
export const selfCheckTypeValues = [
  'single_choice',
  'multiple_choice',
  'completion_ack',
] as const;
export const selfCheckAttemptStatusValues = [
  'submitted',
  'passed',
  'failed',
] as const;
export const analyticsEventTypeValues = [
  'document.opened',
  'document.page_viewed',
  'document.replaced',
  'document.deleted',
  'annotation.created',
  'forum.thread.created',
  'forum.thread.resolved',
  'roadmap.node_started',
  'roadmap.node_completed',
  'self_check.completed',
  'intervention.created',
] as const;
export const interventionTypeValues = [
  'clarification',
  'additional_resource',
  'lecture_adjustment',
  'answer_thread',
  'revise_material',
] as const;
export const auditActionValues = [
  'user.created',
  'course.created',
  'enrollment.changed',
  'document.uploaded',
  'document.replaced',
  'document.deleted',
  'thread.category_changed',
  'auth.login',
  'auth.logout',
  'auth.denied',
  'role.changed',
] as const;

export const UserRoleSchema = z.enum(userRoleValues);
export const EnrollmentStatusSchema = z.enum(enrollmentStatusValues);
export const CourseInstructorRoleSchema = z.enum(courseInstructorRoleValues);
export const DocumentStatusSchema = z.enum(documentStatusValues);
export const DocumentVisibilitySchema = z.enum(documentVisibilityValues);
export const ForumCategoryKindSchema = z.enum(forumCategoryKindValues);
export const ForumThreadStatusSchema = z.enum(forumThreadStatusValues);
export const DifficultyLevelSchema = z.enum(difficultyLevelValues);
export const CompletionRuleSchema = z.enum(completionRuleValues);
export const RoadmapProgressStatusSchema = z.enum(roadmapProgressStatusValues);
export const RoadmapResourceTypeSchema = z.enum(roadmapResourceTypeValues);
export const AnnotationTypeSchema = z.enum(annotationTypeValues);
export const AnnotationVisibilitySchema = z.enum(annotationVisibilityValues);
export const ThreadLinkTypeSchema = z.enum(threadLinkTypeValues);
export const SelfCheckTypeSchema = z.enum(selfCheckTypeValues);
export const SelfCheckAttemptStatusSchema = z.enum(
  selfCheckAttemptStatusValues,
);
export const AnalyticsEventTypeSchema = z.enum(analyticsEventTypeValues);
export const InterventionTypeSchema = z.enum(interventionTypeValues);
export const AuditActionSchema = z.enum(auditActionValues);

export type UserRole = z.infer<typeof UserRoleSchema>;
export type EnrollmentStatus = z.infer<typeof EnrollmentStatusSchema>;
export type CourseInstructorRole = z.infer<typeof CourseInstructorRoleSchema>;
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
export type DocumentVisibility = z.infer<typeof DocumentVisibilitySchema>;
export type ForumCategoryKind = z.infer<typeof ForumCategoryKindSchema>;
export type ForumThreadStatus = z.infer<typeof ForumThreadStatusSchema>;
export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>;
export type CompletionRule = z.infer<typeof CompletionRuleSchema>;
export type RoadmapProgressStatus = z.infer<typeof RoadmapProgressStatusSchema>;
export type RoadmapResourceType = z.infer<typeof RoadmapResourceTypeSchema>;
export type AnnotationType = z.infer<typeof AnnotationTypeSchema>;
export type AnnotationVisibility = z.infer<typeof AnnotationVisibilitySchema>;
export type ThreadLinkType = z.infer<typeof ThreadLinkTypeSchema>;
export type SelfCheckType = z.infer<typeof SelfCheckTypeSchema>;
export type SelfCheckAttemptStatus = z.infer<
  typeof SelfCheckAttemptStatusSchema
>;
export type AnalyticsEventType = z.infer<typeof AnalyticsEventTypeSchema>;
export type InterventionType = z.infer<typeof InterventionTypeSchema>;
export type AuditAction = z.infer<typeof AuditActionSchema>;
