import { Router } from 'express';
import type {
  AnnotationType,
  AnnotationVisibility,
  ForumCategoryKind,
  ForumThreadStatus,
  PrismaClient,
  RoadmapProgressStatus,
  UserRole,
} from '@prisma/client';
import {
  StudentDashboardResponseSchema,
  type CourseDocumentAnnotation,
  type DashboardAnnotationItem,
  type DashboardForumThreadItem,
  type StudentCourseListItem,
  type StudentDashboardContinueNode,
  type StudentDashboardRoadmapSummary,
  type StudentDashboardResponse,
} from '@web-app/contracts';

import { createAuditLogger, type AuditLogger } from '../auth/audit-log.js';
import {
  requireRole,
  type AuthorizationMiddlewareOptions,
} from '../auth/authorization-middleware.js';
import { type SessionService } from '../auth/session.js';
import { asyncHandler } from '../lib/async-handler.js';
import { forumThreadVisibilityWhere } from '../lib/forum-authorization.js';
import { prisma as defaultPrisma } from '../lib/prisma.js';
import { sendJson } from '../lib/send-json.js';

type StudentDashboardPrismaClient = Pick<
  PrismaClient,
  | 'annotation'
  | 'courseInstructor'
  | 'document'
  | 'enrollment'
  | 'forumThread'
  | 'roadmapNode'
>;

export interface StudentDashboardRouteOptions {
  auditLogger?: AuditLogger;
  prisma?: StudentDashboardPrismaClient;
  sessionService?: SessionService;
}

const DASHBOARD_ITEM_LIMIT = 5;
const RECENT_MATERIAL_WINDOW_DAYS = 3;

interface CourseRecord {
  code: string;
  description: string | null;
  ectsCredits: number;
  id: string;
  isActive: boolean;
  semester: number;
  title: string;
}

interface DashboardCourseRef {
  code: string;
  title: string;
}

interface DashboardAnnotationRecord {
  id: string;
  courseId: string;
  documentId: string;
  type: AnnotationType;
  visibility: AnnotationVisibility;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  target: { id: string; pageNumber: number; selectedText: string | null };
  author: { id: string; fullName: string; role: UserRole };
  course: DashboardCourseRef;
}

interface DashboardThreadRecord {
  id: string;
  courseId: string;
  documentId: string | null;
  annotationId: string | null;
  title: string;
  status: ForumThreadStatus;
  visibility: string;
  pageNumberSnapshot: number | null;
  selectedTextSnapshot: string | null;
  documentTitleSnapshot: string | null;
  verifiedPostId: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: { kind: ForumCategoryKind };
  author: { id: string; fullName: string; role: UserRole };
  course: DashboardCourseRef;
  posts: { createdAt: Date }[];
  _count: { posts: number };
}

interface DashboardRoadmapNodeRecord {
  id: string;
  courseId: string;
  title: string;
  estimatedMinutes: number | null;
  orderIndex: number;
  createdAt: Date;
  course: DashboardCourseRef;
  incomingEdges: { fromNodeId: string }[];
  progress: {
    status: RoadmapProgressStatus;
    updatedAt: Date;
  }[];
}

export function createStudentDashboardRouter(
  options: StudentDashboardRouteOptions = {},
): Router {
  const router = Router();
  const prisma = options.prisma ?? defaultPrisma;
  const auditLogger = options.auditLogger ?? createAuditLogger();
  const gateOptions: AuthorizationMiddlewareOptions = {
    auditLogger,
    sessionService: options.sessionService,
  };

  router.get(
    '/',
    requireRole(['student'], gateOptions),
    asyncHandler(async (request, response) => {
      const actorId = request.currentSession!.user.id;

      const enrollments = await prisma.enrollment.findMany({
        include: { course: true },
        orderBy: { course: { code: 'asc' } },
        where: {
          studentId: actorId,
          status: 'active',
          course: { isActive: true },
        },
      });
      const enrolledCourseIds = enrollments.map(
        (enrollment) => enrollment.courseId,
      );

      const [
        courseItems,
        roadmapNodes,
        recentNotes,
        openQuestions,
        verifiedAnswers,
        activeDiscussions,
      ] = await Promise.all([
        Promise.all(
          enrollments.map(async (enrollment) => {
            const [documentCount, primaryInstructorName, hasRecentMaterial] =
              await Promise.all([
                visibleDocumentCountFor(prisma, enrollment.courseId),
                primaryInstructorNameFor(prisma, enrollment.courseId),
                hasRecentMaterialFor(prisma, enrollment.courseId),
              ]);
            return {
              ...toStudentCourseListItem(
                enrollment.course as CourseRecord,
                documentCount,
                primaryInstructorName,
              ),
              hasRecentMaterial,
            };
          }),
        ),
        prisma.roadmapNode.findMany({
          include: {
            course: { select: { code: true, title: true } },
            incomingEdges: { select: { fromNodeId: true } },
            progress: {
              select: { status: true, updatedAt: true },
              where: { studentId: actorId },
            },
          },
          orderBy: [
            { course: { code: 'asc' } },
            { orderIndex: 'asc' },
            { createdAt: 'asc' },
          ],
          where: { courseId: { in: enrolledCourseIds } },
        }),
        prisma.annotation.findMany({
          include: dashboardAnnotationInclude(),
          orderBy: [{ createdAt: 'desc' }],
          take: DASHBOARD_ITEM_LIMIT,
          where: {
            authorId: actorId,
            courseId: { in: enrolledCourseIds },
            isDeleted: false,
            document: {
              is: { status: 'active', visibility: 'visible_to_students' },
            },
          },
        }),
        prisma.forumThread.findMany({
          include: dashboardThreadInclude(),
          orderBy: [{ updatedAt: 'desc' }],
          take: DASHBOARD_ITEM_LIMIT,
          where: {
            authorId: actorId,
            courseId: { in: enrolledCourseIds },
            status: { in: ['open', 'instructor_answered'] },
          },
        }),
        prisma.forumThread.findMany({
          include: dashboardThreadInclude(),
          orderBy: [{ updatedAt: 'desc' }],
          take: DASHBOARD_ITEM_LIMIT,
          where: {
            authorId: actorId,
            courseId: { in: enrolledCourseIds },
            status: 'verified',
          },
        }),
        prisma.forumThread.findMany({
          include: dashboardThreadInclude(),
          orderBy: [{ updatedAt: 'desc' }],
          take: DASHBOARD_ITEM_LIMIT,
          where: {
            courseId: { in: enrolledCourseIds },
            status: { not: 'archived' },
            OR: forumThreadVisibilityWhere(actorId, 'student'),
          },
        }),
      ]);

      const roadmapDashboard = buildRoadmapDashboard(
        roadmapNodes as DashboardRoadmapNodeRecord[],
      );
      const courses = courseItems.map((course) => ({
        ...course,
        roadmap:
          roadmapDashboard.summaries.get(course.id) ?? emptyRoadmapSummary(),
      }));

      const payload: StudentDashboardResponse = {
        data: {
          courses,
          continueLearning: roadmapDashboard.continueLearning,
          recentNotes: (recentNotes as DashboardAnnotationRecord[]).map(
            toDashboardAnnotationItem,
          ),
          openQuestions: (openQuestions as DashboardThreadRecord[]).map(
            toDashboardForumThreadItem,
          ),
          verifiedAnswers: (verifiedAnswers as DashboardThreadRecord[]).map(
            toDashboardForumThreadItem,
          ),
          activeDiscussions: (activeDiscussions as DashboardThreadRecord[]).map(
            toDashboardForumThreadItem,
          ),
        },
      };

      sendJson(response, 200, StudentDashboardResponseSchema, payload);
    }),
  );

  return router;
}

function emptyRoadmapSummary(): StudentDashboardRoadmapSummary {
  return {
    totalNodeCount: 0,
    completedNodeCount: 0,
    completionPercentage: 0,
    needsReviewCount: 0,
  };
}

function buildRoadmapDashboard(nodes: DashboardRoadmapNodeRecord[]): {
  summaries: Map<string, StudentDashboardRoadmapSummary>;
  continueLearning: StudentDashboardContinueNode | null;
} {
  const completedNodeIds = new Set(
    nodes
      .filter((node) => node.progress[0]?.status === 'completed')
      .map((node) => node.id),
  );
  const states = nodes.map((node) => {
    const progress = node.progress[0] ?? null;
    const status = progress?.status ?? 'not_started';
    const isLocked =
      status !== 'completed' &&
      node.incomingEdges.some((edge) => !completedNodeIds.has(edge.fromNodeId));
    return { node, status, isLocked, updatedAt: progress?.updatedAt ?? null };
  });

  const summaries = new Map<string, StudentDashboardRoadmapSummary>();
  for (const { node, status } of states) {
    const current = summaries.get(node.courseId) ?? emptyRoadmapSummary();
    current.totalNodeCount += 1;
    if (status === 'completed') current.completedNodeCount += 1;
    if (status === 'needs_review') current.needsReviewCount += 1;
    summaries.set(node.courseId, current);
  }
  for (const summary of summaries.values()) {
    summary.completionPercentage =
      summary.totalNodeCount === 0
        ? 0
        : Math.round(
            (summary.completedNodeCount / summary.totalNodeCount) * 100,
          );
  }

  const availableStates = states.filter(
    (state) => state.status !== 'completed' && !state.isLocked,
  );
  const recentState = (status: 'in_progress' | 'needs_review') =>
    availableStates
      .filter((state) => state.status === status)
      .sort(
        (left, right) =>
          (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0),
      )[0];
  const nextState =
    recentState('in_progress') ??
    recentState('needs_review') ??
    availableStates.find((state) => state.status === 'not_started') ??
    null;

  return {
    summaries,
    continueLearning: nextState
      ? {
          id: nextState.node.id,
          courseId: nextState.node.courseId,
          courseCode: nextState.node.course.code,
          courseTitle: nextState.node.course.title,
          title: nextState.node.title,
          status: nextState.status as Exclude<
            RoadmapProgressStatus,
            'completed'
          >,
          estimatedMinutes: nextState.node.estimatedMinutes,
        }
      : null,
  };
}

async function visibleDocumentCountFor(
  prisma: StudentDashboardPrismaClient,
  courseId: string,
): Promise<number> {
  return prisma.document.count({
    where: { courseId, status: 'active', visibility: 'visible_to_students' },
  });
}

async function hasRecentMaterialFor(
  prisma: StudentDashboardPrismaClient,
  courseId: string,
): Promise<boolean> {
  const since = new Date(
    Date.now() - RECENT_MATERIAL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const recentCount = await prisma.document.count({
    where: {
      courseId,
      status: 'active',
      visibility: 'visible_to_students',
      createdAt: { gte: since },
    },
  });
  return recentCount > 0;
}

async function primaryInstructorNameFor(
  prisma: StudentDashboardPrismaClient,
  courseId: string,
): Promise<string | null> {
  const owners = await prisma.courseInstructor.findMany({
    include: { instructor: true },
    orderBy: { createdAt: 'asc' },
    where: { courseId, instructorRole: 'owner' },
  });
  return owners[0]?.instructor.fullName ?? null;
}

function toStudentCourseListItem(
  course: CourseRecord,
  documentCount: number,
  primaryInstructorName: string | null,
): StudentCourseListItem {
  return {
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description,
    semester: course.semester,
    ectsCredits: course.ectsCredits,
    isActive: course.isActive,
    counts: { documentCount },
    primaryInstructor: primaryInstructorName
      ? { fullName: primaryInstructorName }
      : null,
  };
}

function dashboardAnnotationInclude() {
  return {
    author: { select: { fullName: true, id: true, role: true } },
    course: { select: { code: true, title: true } },
    target: { select: { id: true, pageNumber: true, selectedText: true } },
  } as const;
}

function toDashboardAnnotationItem(
  annotation: DashboardAnnotationRecord,
): DashboardAnnotationItem {
  const base: CourseDocumentAnnotation = {
    id: annotation.id,
    courseId: annotation.courseId,
    documentId: annotation.documentId,
    target: annotation.target,
    author: annotation.author,
    type: annotation.type,
    visibility: annotation.visibility,
    body: annotation.body,
    createdAt: annotation.createdAt.toISOString(),
    updatedAt: annotation.updatedAt.toISOString(),
  };

  return {
    ...base,
    courseCode: annotation.course.code,
    courseTitle: annotation.course.title,
  };
}

function dashboardThreadInclude() {
  return {
    author: { select: { fullName: true, id: true, role: true } },
    category: { select: { kind: true } },
    course: { select: { code: true, title: true } },
    posts: {
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
      take: 1,
      where: { isDeleted: false },
    },
    _count: { select: { posts: { where: { isDeleted: false } } } },
  } as const;
}

function toDashboardForumThreadItem(
  thread: DashboardThreadRecord,
): DashboardForumThreadItem {
  const lastPost = thread.posts[0];

  return {
    id: thread.id,
    courseId: thread.courseId,
    categoryKind: thread.category.kind,
    documentId: thread.documentId,
    annotationId: thread.annotationId,
    title: thread.title,
    status: thread.status,
    visibility: thread.visibility as 'public' | 'instructor_only',
    pageNumber: thread.pageNumberSnapshot,
    selectedText: thread.selectedTextSnapshot,
    documentTitle: thread.documentTitleSnapshot,
    author: thread.author,
    postCount: thread._count.posts,
    verifiedPostId: thread.verifiedPostId,
    lastPostAt: lastPost ? lastPost.createdAt.toISOString() : null,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    courseCode: thread.course.code,
    courseTitle: thread.course.title,
  };
}
