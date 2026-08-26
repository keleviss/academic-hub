-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'professor', 'student');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'inactive', 'completed');

-- CreateEnum
CREATE TYPE "CourseInstructorRole" AS ENUM ('owner', 'assistant');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('active', 'replaced', 'deleted');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('visible_to_students', 'hidden_from_students');

-- CreateEnum
CREATE TYPE "ForumCategoryKind" AS ENUM ('general', 'document_discussion', 'archived_document_discussion');

-- CreateEnum
CREATE TYPE "ForumThreadStatus" AS ENUM ('open', 'instructor_answered', 'verified', 'resolved', 'archived');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "CompletionRule" AS ENUM ('manual', 'self_check', 'view_resource');

-- CreateEnum
CREATE TYPE "RoadmapProgressStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'needs_review');

-- CreateEnum
CREATE TYPE "RoadmapResourceType" AS ENUM ('document_page', 'document_section', 'external_url', 'text_note');

-- CreateEnum
CREATE TYPE "AnnotationType" AS ENUM ('highlight', 'note', 'question', 'important', 'confusing');

-- CreateEnum
CREATE TYPE "AnnotationVisibility" AS ENUM ('private', 'public', 'instructor_only');

-- CreateEnum
CREATE TYPE "ThreadLinkType" AS ENUM ('duplicate', 'related');

-- CreateEnum
CREATE TYPE "SelfCheckType" AS ENUM ('single_choice', 'multiple_choice', 'completion_ack');

-- CreateEnum
CREATE TYPE "SelfCheckAttemptStatus" AS ENUM ('submitted', 'passed', 'failed');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('document.opened', 'document.page_viewed', 'document.replaced', 'document.deleted', 'annotation.created', 'forum.thread.created', 'forum.thread.resolved', 'roadmap.node_started', 'roadmap.node_completed', 'self_check.completed', 'intervention.created');

-- CreateEnum
CREATE TYPE "InterventionType" AS ENUM ('clarification', 'additional_resource', 'lecture_adjustment', 'answer_thread', 'revise_material');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('user.created', 'course.created', 'enrollment.changed', 'document.uploaded', 'document.replaced', 'document.deleted', 'thread.category_changed', 'auth.login', 'auth.logout', 'auth.denied', 'role.changed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_instructors" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "instructor_role" "CourseInstructorRole" NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'active',
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'hidden_from_students',
    "object_key" TEXT,
    "original_filename" TEXT,
    "mime_type" TEXT,
    "file_size_bytes" BIGINT,
    "checksum_sha256" TEXT,
    "page_count" INTEGER,
    "replaced_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concepts" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "learning_objective" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_nodes" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "concept_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "learning_objective" TEXT,
    "estimated_minutes" INTEGER,
    "difficulty" "DifficultyLevel",
    "completion_rule" "CompletionRule" NOT NULL DEFAULT 'manual',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roadmap_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_edges" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "from_node_id" UUID NOT NULL,
    "to_node_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_node_resources" (
    "id" UUID NOT NULL,
    "roadmap_node_id" UUID NOT NULL,
    "resource_type" "RoadmapResourceType" NOT NULL,
    "document_id" UUID,
    "page_start" INTEGER,
    "page_end" INTEGER,
    "section_label" TEXT,
    "external_url" TEXT,
    "title" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_node_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_progress" (
    "id" UUID NOT NULL,
    "roadmap_node_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "RoadmapProgressStatus" NOT NULL DEFAULT 'not_started',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "needs_review_reason" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roadmap_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_categories" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ForumCategoryKind" NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forum_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotation_targets" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "page_number" INTEGER NOT NULL,
    "selected_text" TEXT,
    "text_quote_exact" TEXT,
    "text_quote_prefix" TEXT,
    "text_quote_suffix" TEXT,
    "normalized_rects" JSONB NOT NULL DEFAULT '[]',
    "snapshot_image_key" TEXT,
    "selector_metadata" JSONB,
    "document_title_snapshot" TEXT NOT NULL,
    "document_filename_snapshot" TEXT,
    "document_checksum_snapshot" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annotation_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotations" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "concept_id" UUID,
    "roadmap_node_id" UUID,
    "type" "AnnotationType" NOT NULL,
    "visibility" "AnnotationVisibility" NOT NULL,
    "body" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_threads" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "annotation_id" UUID,
    "target_id" UUID,
    "document_id" UUID,
    "author_id" UUID NOT NULL,
    "concept_id" UUID,
    "roadmap_node_id" UUID,
    "title" TEXT NOT NULL,
    "status" "ForumThreadStatus" NOT NULL DEFAULT 'open',
    "visibility" "AnnotationVisibility" NOT NULL,
    "page_number_snapshot" INTEGER,
    "selected_text_snapshot" TEXT,
    "document_title_snapshot" TEXT,
    "verified_post_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forum_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_posts" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "parent_post_id" UUID,
    "body" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thread_links" (
    "id" UUID NOT NULL,
    "source_thread_id" UUID NOT NULL,
    "target_thread_id" UUID NOT NULL,
    "link_type" "ThreadLinkType" NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_checks" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "roadmap_node_id" UUID NOT NULL,
    "concept_id" UUID,
    "type" "SelfCheckType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB,
    "correct_answer" JSONB,
    "passing_score" INTEGER,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "self_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_check_attempts" (
    "id" UUID NOT NULL,
    "self_check_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "answer" JSONB,
    "score" INTEGER,
    "status" "SelfCheckAttemptStatus" NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "self_check_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "event_type" "AnalyticsEventType" NOT NULL,
    "course_id" UUID NOT NULL,
    "user_id" UUID,
    "document_id" UUID,
    "concept_id" UUID,
    "roadmap_node_id" UUID,
    "annotation_id" UUID,
    "thread_id" UUID,
    "self_check_id" UUID,
    "intervention_id" UUID,
    "target_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_interventions" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "type" "InterventionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source_action" TEXT NOT NULL,
    "source_entity_type" TEXT,
    "source_entity_id" UUID,
    "concept_id" UUID,
    "roadmap_node_id" UUID,
    "thread_id" UUID,
    "target_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "follow_up_at" TIMESTAMPTZ(6),

    CONSTRAINT "teaching_interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "course_id" UUID,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE INDEX "courses_is_active_idx" ON "courses"("is_active");

-- CreateIndex
CREATE INDEX "enrollments_student_id_idx" ON "enrollments"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_course_id_student_id_key" ON "enrollments"("course_id", "student_id");

-- CreateIndex
CREATE INDEX "course_instructors_instructor_id_idx" ON "course_instructors"("instructor_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_instructors_course_id_instructor_id_key" ON "course_instructors"("course_id", "instructor_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_object_key_key" ON "documents"("object_key");

-- CreateIndex
CREATE INDEX "documents_course_id_status_idx" ON "documents"("course_id", "status");

-- CreateIndex
CREATE INDEX "documents_course_id_visibility_idx" ON "documents"("course_id", "visibility");

-- CreateIndex
CREATE INDEX "documents_created_by_id_idx" ON "documents"("created_by_id");

-- CreateIndex
CREATE INDEX "concepts_course_id_order_index_idx" ON "concepts"("course_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "concepts_course_id_slug_key" ON "concepts"("course_id", "slug");

-- CreateIndex
CREATE INDEX "roadmap_nodes_course_id_order_index_idx" ON "roadmap_nodes"("course_id", "order_index");

-- CreateIndex
CREATE INDEX "roadmap_nodes_concept_id_idx" ON "roadmap_nodes"("concept_id");

-- CreateIndex
CREATE INDEX "roadmap_edges_to_node_id_idx" ON "roadmap_edges"("to_node_id");

-- CreateIndex
CREATE INDEX "roadmap_edges_course_id_idx" ON "roadmap_edges"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_edges_from_node_id_to_node_id_key" ON "roadmap_edges"("from_node_id", "to_node_id");

-- CreateIndex
CREATE INDEX "roadmap_node_resources_roadmap_node_id_order_index_idx" ON "roadmap_node_resources"("roadmap_node_id", "order_index");

-- CreateIndex
CREATE INDEX "roadmap_node_resources_document_id_idx" ON "roadmap_node_resources"("document_id");

-- CreateIndex
CREATE INDEX "roadmap_progress_student_id_status_idx" ON "roadmap_progress"("student_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_progress_roadmap_node_id_student_id_key" ON "roadmap_progress"("roadmap_node_id", "student_id");

-- CreateIndex
CREATE INDEX "forum_categories_course_id_kind_idx" ON "forum_categories"("course_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "forum_categories_course_id_name_key" ON "forum_categories"("course_id", "name");

-- CreateIndex
CREATE INDEX "annotation_targets_document_id_page_number_idx" ON "annotation_targets"("document_id", "page_number");

-- CreateIndex
CREATE INDEX "annotations_course_id_created_at_idx" ON "annotations"("course_id", "created_at");

-- CreateIndex
CREATE INDEX "annotations_document_id_idx" ON "annotations"("document_id");

-- CreateIndex
CREATE INDEX "annotations_target_id_idx" ON "annotations"("target_id");

-- CreateIndex
CREATE INDEX "annotations_author_id_idx" ON "annotations"("author_id");

-- CreateIndex
CREATE INDEX "annotations_concept_id_idx" ON "annotations"("concept_id");

-- CreateIndex
CREATE INDEX "annotations_roadmap_node_id_idx" ON "annotations"("roadmap_node_id");

-- CreateIndex
CREATE INDEX "annotations_type_idx" ON "annotations"("type");

-- CreateIndex
CREATE INDEX "annotations_visibility_idx" ON "annotations"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "forum_threads_annotation_id_key" ON "forum_threads"("annotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "forum_threads_verified_post_id_key" ON "forum_threads"("verified_post_id");

-- CreateIndex
CREATE INDEX "forum_threads_course_id_category_id_updated_at_idx" ON "forum_threads"("course_id", "category_id", "updated_at");

-- CreateIndex
CREATE INDEX "forum_threads_course_id_status_idx" ON "forum_threads"("course_id", "status");

-- CreateIndex
CREATE INDEX "forum_threads_document_id_idx" ON "forum_threads"("document_id");

-- CreateIndex
CREATE INDEX "forum_threads_target_id_idx" ON "forum_threads"("target_id");

-- CreateIndex
CREATE INDEX "forum_threads_concept_id_idx" ON "forum_threads"("concept_id");

-- CreateIndex
CREATE INDEX "forum_threads_roadmap_node_id_idx" ON "forum_threads"("roadmap_node_id");

-- CreateIndex
CREATE INDEX "forum_posts_thread_id_created_at_idx" ON "forum_posts"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "forum_posts_author_id_idx" ON "forum_posts"("author_id");

-- CreateIndex
CREATE INDEX "forum_posts_parent_post_id_idx" ON "forum_posts"("parent_post_id");

-- CreateIndex
CREATE INDEX "thread_links_target_thread_id_idx" ON "thread_links"("target_thread_id");

-- CreateIndex
CREATE UNIQUE INDEX "thread_links_source_thread_id_target_thread_id_link_type_key" ON "thread_links"("source_thread_id", "target_thread_id", "link_type");

-- CreateIndex
CREATE INDEX "self_checks_roadmap_node_id_order_index_idx" ON "self_checks"("roadmap_node_id", "order_index");

-- CreateIndex
CREATE INDEX "self_checks_concept_id_idx" ON "self_checks"("concept_id");

-- CreateIndex
CREATE INDEX "self_check_attempts_self_check_id_submitted_at_idx" ON "self_check_attempts"("self_check_id", "submitted_at");

-- CreateIndex
CREATE INDEX "self_check_attempts_student_id_submitted_at_idx" ON "self_check_attempts"("student_id", "submitted_at");

-- CreateIndex
CREATE INDEX "analytics_events_course_id_created_at_idx" ON "analytics_events"("course_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_event_type_created_at_idx" ON "analytics_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_concept_id_created_at_idx" ON "analytics_events"("concept_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_roadmap_node_id_created_at_idx" ON "analytics_events"("roadmap_node_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_document_id_created_at_idx" ON "analytics_events"("document_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_thread_id_created_at_idx" ON "analytics_events"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "teaching_interventions_course_id_created_at_idx" ON "teaching_interventions"("course_id", "created_at");

-- CreateIndex
CREATE INDEX "teaching_interventions_concept_id_idx" ON "teaching_interventions"("concept_id");

-- CreateIndex
CREATE INDEX "teaching_interventions_roadmap_node_id_idx" ON "teaching_interventions"("roadmap_node_id");

-- CreateIndex
CREATE INDEX "teaching_interventions_thread_id_idx" ON "teaching_interventions"("thread_id");

-- CreateIndex
CREATE INDEX "teaching_interventions_source_action_idx" ON "teaching_interventions"("source_action");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_course_id_created_at_idx" ON "audit_logs"("course_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_instructors" ADD CONSTRAINT "course_instructors_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_instructors" ADD CONSTRAINT "course_instructors_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_nodes" ADD CONSTRAINT "roadmap_nodes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_nodes" ADD CONSTRAINT "roadmap_nodes_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_nodes" ADD CONSTRAINT "roadmap_nodes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_edges" ADD CONSTRAINT "roadmap_edges_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_edges" ADD CONSTRAINT "roadmap_edges_from_node_id_fkey" FOREIGN KEY ("from_node_id") REFERENCES "roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_edges" ADD CONSTRAINT "roadmap_edges_to_node_id_fkey" FOREIGN KEY ("to_node_id") REFERENCES "roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_node_resources" ADD CONSTRAINT "roadmap_node_resources_roadmap_node_id_fkey" FOREIGN KEY ("roadmap_node_id") REFERENCES "roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_node_resources" ADD CONSTRAINT "roadmap_node_resources_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_progress" ADD CONSTRAINT "roadmap_progress_roadmap_node_id_fkey" FOREIGN KEY ("roadmap_node_id") REFERENCES "roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_progress" ADD CONSTRAINT "roadmap_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_categories" ADD CONSTRAINT "forum_categories_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotation_targets" ADD CONSTRAINT "annotation_targets_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "annotation_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_roadmap_node_id_fkey" FOREIGN KEY ("roadmap_node_id") REFERENCES "roadmap_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "forum_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_annotation_id_fkey" FOREIGN KEY ("annotation_id") REFERENCES "annotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "annotation_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_roadmap_node_id_fkey" FOREIGN KEY ("roadmap_node_id") REFERENCES "roadmap_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_verified_post_id_fkey" FOREIGN KEY ("verified_post_id") REFERENCES "forum_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_parent_post_id_fkey" FOREIGN KEY ("parent_post_id") REFERENCES "forum_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_links" ADD CONSTRAINT "thread_links_source_thread_id_fkey" FOREIGN KEY ("source_thread_id") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_links" ADD CONSTRAINT "thread_links_target_thread_id_fkey" FOREIGN KEY ("target_thread_id") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_links" ADD CONSTRAINT "thread_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_checks" ADD CONSTRAINT "self_checks_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_checks" ADD CONSTRAINT "self_checks_roadmap_node_id_fkey" FOREIGN KEY ("roadmap_node_id") REFERENCES "roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_checks" ADD CONSTRAINT "self_checks_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_checks" ADD CONSTRAINT "self_checks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_check_attempts" ADD CONSTRAINT "self_check_attempts_self_check_id_fkey" FOREIGN KEY ("self_check_id") REFERENCES "self_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_check_attempts" ADD CONSTRAINT "self_check_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_roadmap_node_id_fkey" FOREIGN KEY ("roadmap_node_id") REFERENCES "roadmap_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_annotation_id_fkey" FOREIGN KEY ("annotation_id") REFERENCES "annotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_self_check_id_fkey" FOREIGN KEY ("self_check_id") REFERENCES "self_checks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "teaching_interventions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "annotation_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_interventions" ADD CONSTRAINT "teaching_interventions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_interventions" ADD CONSTRAINT "teaching_interventions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_interventions" ADD CONSTRAINT "teaching_interventions_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_interventions" ADD CONSTRAINT "teaching_interventions_roadmap_node_id_fkey" FOREIGN KEY ("roadmap_node_id") REFERENCES "roadmap_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_interventions" ADD CONSTRAINT "teaching_interventions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_interventions" ADD CONSTRAINT "teaching_interventions_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "annotation_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
