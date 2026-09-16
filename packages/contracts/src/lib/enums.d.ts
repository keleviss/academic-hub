import { z } from 'zod';
export declare const userRoleValues: readonly ["admin", "professor", "student"];
export declare const enrollmentStatusValues: readonly ["active", "inactive", "completed"];
export declare const courseInstructorRoleValues: readonly ["owner", "assistant"];
export declare const documentStatusValues: readonly ["active", "replaced", "deleted"];
export declare const documentVisibilityValues: readonly ["visible_to_students", "hidden_from_students"];
export declare const forumCategoryKindValues: readonly ["general", "document_discussion", "archived_document_discussion"];
export declare const forumThreadStatusValues: readonly ["open", "instructor_answered", "verified", "resolved", "archived"];
export declare const difficultyLevelValues: readonly ["low", "medium", "high"];
export declare const completionRuleValues: readonly ["manual", "self_check", "view_resource"];
export declare const roadmapProgressStatusValues: readonly ["not_started", "in_progress", "completed", "needs_review"];
export declare const roadmapResourceTypeValues: readonly ["document_page", "document_section", "external_url", "text_note"];
export declare const annotationTypeValues: readonly ["highlight", "note", "question", "important", "confusing"];
export declare const annotationVisibilityValues: readonly ["private", "public", "instructor_only"];
export declare const threadLinkTypeValues: readonly ["duplicate", "related"];
export declare const selfCheckTypeValues: readonly ["single_choice", "multiple_choice", "completion_ack"];
export declare const selfCheckAttemptStatusValues: readonly ["submitted", "passed", "failed"];
export declare const analyticsEventTypeValues: readonly ["document.opened", "document.page_viewed", "document.replaced", "document.deleted", "annotation.created", "forum.thread.created", "forum.thread.resolved", "roadmap.node_started", "roadmap.node_completed", "self_check.completed", "intervention.created"];
export declare const interventionTypeValues: readonly ["clarification", "additional_resource", "lecture_adjustment", "answer_thread", "revise_material"];
export declare const auditActionValues: readonly ["user.created", "course.created", "course.updated", "course.deactivated", "enrollment.changed", "document.uploaded", "document.replaced", "document.deleted", "thread.category_changed", "auth.login", "auth.logout", "auth.denied", "role.changed"];
export declare const UserRoleSchema: z.ZodEnum<{
    admin: "admin";
    professor: "professor";
    student: "student";
}>;
export declare const EnrollmentStatusSchema: z.ZodEnum<{
    active: "active";
    inactive: "inactive";
    completed: "completed";
}>;
export declare const CourseInstructorRoleSchema: z.ZodEnum<{
    owner: "owner";
    assistant: "assistant";
}>;
export declare const DocumentStatusSchema: z.ZodEnum<{
    active: "active";
    replaced: "replaced";
    deleted: "deleted";
}>;
export declare const DocumentVisibilitySchema: z.ZodEnum<{
    visible_to_students: "visible_to_students";
    hidden_from_students: "hidden_from_students";
}>;
export declare const ForumCategoryKindSchema: z.ZodEnum<{
    general: "general";
    document_discussion: "document_discussion";
    archived_document_discussion: "archived_document_discussion";
}>;
export declare const ForumThreadStatusSchema: z.ZodEnum<{
    open: "open";
    instructor_answered: "instructor_answered";
    verified: "verified";
    resolved: "resolved";
    archived: "archived";
}>;
export declare const DifficultyLevelSchema: z.ZodEnum<{
    low: "low";
    medium: "medium";
    high: "high";
}>;
export declare const CompletionRuleSchema: z.ZodEnum<{
    manual: "manual";
    self_check: "self_check";
    view_resource: "view_resource";
}>;
export declare const RoadmapProgressStatusSchema: z.ZodEnum<{
    completed: "completed";
    not_started: "not_started";
    in_progress: "in_progress";
    needs_review: "needs_review";
}>;
export declare const RoadmapResourceTypeSchema: z.ZodEnum<{
    document_page: "document_page";
    document_section: "document_section";
    external_url: "external_url";
    text_note: "text_note";
}>;
export declare const AnnotationTypeSchema: z.ZodEnum<{
    highlight: "highlight";
    note: "note";
    question: "question";
    important: "important";
    confusing: "confusing";
}>;
export declare const AnnotationVisibilitySchema: z.ZodEnum<{
    private: "private";
    public: "public";
    instructor_only: "instructor_only";
}>;
export declare const ThreadLinkTypeSchema: z.ZodEnum<{
    duplicate: "duplicate";
    related: "related";
}>;
export declare const SelfCheckTypeSchema: z.ZodEnum<{
    single_choice: "single_choice";
    multiple_choice: "multiple_choice";
    completion_ack: "completion_ack";
}>;
export declare const SelfCheckAttemptStatusSchema: z.ZodEnum<{
    submitted: "submitted";
    passed: "passed";
    failed: "failed";
}>;
export declare const AnalyticsEventTypeSchema: z.ZodEnum<{
    "document.opened": "document.opened";
    "document.page_viewed": "document.page_viewed";
    "document.replaced": "document.replaced";
    "document.deleted": "document.deleted";
    "annotation.created": "annotation.created";
    "forum.thread.created": "forum.thread.created";
    "forum.thread.resolved": "forum.thread.resolved";
    "roadmap.node_started": "roadmap.node_started";
    "roadmap.node_completed": "roadmap.node_completed";
    "self_check.completed": "self_check.completed";
    "intervention.created": "intervention.created";
}>;
export declare const InterventionTypeSchema: z.ZodEnum<{
    clarification: "clarification";
    additional_resource: "additional_resource";
    lecture_adjustment: "lecture_adjustment";
    answer_thread: "answer_thread";
    revise_material: "revise_material";
}>;
export declare const AuditActionSchema: z.ZodEnum<{
    "document.replaced": "document.replaced";
    "document.deleted": "document.deleted";
    "user.created": "user.created";
    "course.created": "course.created";
    "course.updated": "course.updated";
    "course.deactivated": "course.deactivated";
    "enrollment.changed": "enrollment.changed";
    "document.uploaded": "document.uploaded";
    "thread.category_changed": "thread.category_changed";
    "auth.login": "auth.login";
    "auth.logout": "auth.logout";
    "auth.denied": "auth.denied";
    "role.changed": "role.changed";
}>;
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
export type SelfCheckAttemptStatus = z.infer<typeof SelfCheckAttemptStatusSchema>;
export type AnalyticsEventType = z.infer<typeof AnalyticsEventTypeSchema>;
export type InterventionType = z.infer<typeof InterventionTypeSchema>;
export type AuditAction = z.infer<typeof AuditActionSchema>;
//# sourceMappingURL=enums.d.ts.map