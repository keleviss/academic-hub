import { Router } from 'express';
import type {
  CourseInstructorRole,
  ForumCategoryKind,
  ForumThreadStatus,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import {
  ProfessorDashboardResponseSchema,
  type DashboardForumThreadItem,
  type ProfessorCourseListItem,
  type ProfessorDashboardCourseCounters,
  type ProfessorDashboardResponse,
} from '@web-app/contracts';

import { createAuditLogger, type AuditLogger } from '../auth/audit-log.js';
import {
  requireRole,
  type AuthorizationMiddlewareOptions,
} from '../auth/authorization-middleware.js';
import { type SessionService } from '../auth/session.js';
import { asyncHandler } from '../lib/async-handler.js';
import { prisma as defaultPrisma } from '../lib/prisma.js';
import { sendJson } from '../lib/send-json.js';

type ProfessorDashboardPrismaClient = Pick<
  PrismaClient,
  'course' | 'courseInstructor' | 'document' | 'forumThread'
>;

export interface ProfessorDashboardRouteOptions {
  auditLogger?: AuditLogger;
  prisma?: ProfessorDashboardPrismaClient;
  sessionService?: SessionService;
}

const DASHBOARD_ITEM_LIMIT = 5;
const RECENTLY_VERIFIED_WINDOW_DAYS = 14;

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

export function createProfessorDashboardRouter(
  options: ProfessorDashboardRouteOptions = {},
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
    requireRole(['professor'], gateOptions),
    asyncHandler(async (request, response) => {
      const actorId = request.currentSession!.user.id;

      const assignments = await prisma.courseInstructor.findMany({
        include: { course: true },
        orderBy: { course: { code: 'asc' } },
        where: { instructorId: actorId },
      });
      const myCourseIds = assignments.map((assignment) => assignment.courseId);

      const [
        courses,
        unansweredThreads,
        openThreads,
        recentActivity,
        courseCounters,
      ] = await Promise.all([
        Promise.all(
          assignments.slice(0, DASHBOARD_ITEM_LIMIT).map(async (assignment) => {
            const counts = await documentCountsFor(prisma, assignment.courseId);
            return toProfessorCourseListItem(
              assignment.course as CourseRecord,
              assignment.instructorRole,
              counts,
            );
          }),
        ),
        prisma.forumThread.findMany({
          include: dashboardThreadInclude(),
          orderBy: [{ updatedAt: 'desc' }],
          take: DASHBOARD_ITEM_LIMIT,
          where: { courseId: { in: myCourseIds }, status: 'open' },
        }),
        prisma.forumThread.findMany({
          include: dashboardThreadInclude(),
          orderBy: [{ updatedAt: 'desc' }],
          take: DASHBOARD_ITEM_LIMIT,
          where: {
            courseId: { in: myCourseIds },
            status: { in: ['open', 'instructor_answered'] },
          },
        }),
        prisma.forumThread.findMany({
          include: dashboardThreadInclude(),
          orderBy: [{ updatedAt: 'desc' }],
          take: DASHBOARD_ITEM_LIMIT,
          where: { courseId: { in: myCourseIds }, status: { not: 'archived' } },
        }),
        perCourseCountersFor(prisma, assignments),
      ]);

      const payload: ProfessorDashboardResponse = {
        data: {
          courses,
          unansweredThreads: (unansweredThreads as DashboardThreadRecord[]).map(
            toDashboardForumThreadItem,
          ),
          openThreads: (openThreads as DashboardThreadRecord[]).map(
            toDashboardForumThreadItem,
          ),
          recentActivity: (recentActivity as DashboardThreadRecord[]).map(
            toDashboardForumThreadItem,
          ),
          perCourseCounters: courseCounters,
        },
      };

      sendJson(response, 200, ProfessorDashboardResponseSchema, payload);
    }),
  );

  return router;
}

async function documentCountsFor(
  prisma: ProfessorDashboardPrismaClient,
  courseId: string,
): Promise<{ documentCount: number; visibleDocumentCount: number }> {
  const [documentCount, visibleDocumentCount] = await Promise.all([
    prisma.document.count({ where: { courseId, status: 'active' } }),
    prisma.document.count({
      where: { courseId, status: 'active', visibility: 'visible_to_students' },
    }),
  ]);

  return { documentCount, visibleDocumentCount };
}

function toProfessorCourseListItem(
  course: CourseRecord,
  instructorRole: CourseInstructorRole,
  counts: { documentCount: number; visibleDocumentCount: number },
): ProfessorCourseListItem {
  return {
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description,
    semester: course.semester,
    ectsCredits: course.ectsCredits,
    isActive: course.isActive,
    instructorRole,
    counts,
  };
}

async function perCourseCountersFor(
  prisma: ProfessorDashboardPrismaClient,
  assignments: { courseId: string; course: CourseRecord }[],
): Promise<ProfessorDashboardCourseCounters[]> {
  const myCourseIds = assignments.map((assignment) => assignment.courseId);
  const recentlyVerifiedSince = new Date(
    Date.now() - RECENTLY_VERIFIED_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const [statusCounts, recentlyVerifiedCounts] = await Promise.all([
    prisma.forumThread.groupBy({
      _count: { _all: true },
      by: ['courseId', 'status'],
      where: { courseId: { in: myCourseIds } },
    }),
    prisma.forumThread.groupBy({
      _count: { _all: true },
      by: ['courseId'],
      where: {
        courseId: { in: myCourseIds },
        status: 'verified',
        updatedAt: { gte: recentlyVerifiedSince },
      },
    }),
  ]);

  const unansweredByCourseId = new Map<string, number>();
  const openByCourseId = new Map<string, number>();
  for (const row of statusCounts) {
    if (row.status === 'open') {
      unansweredByCourseId.set(row.courseId, row._count._all);
    }
    if (row.status === 'open' || row.status === 'instructor_answered') {
      openByCourseId.set(
        row.courseId,
        (openByCourseId.get(row.courseId) ?? 0) + row._count._all,
      );
    }
  }
  const recentlyVerifiedByCourseId = new Map(
    recentlyVerifiedCounts.map((row) => [row.courseId, row._count._all]),
  );

  return assignments.map((assignment) => ({
    courseId: assignment.courseId,
    courseCode: assignment.course.code,
    courseTitle: assignment.course.title,
    unansweredCount: unansweredByCourseId.get(assignment.courseId) ?? 0,
    openCount: openByCourseId.get(assignment.courseId) ?? 0,
    recentlyVerifiedCount:
      recentlyVerifiedByCourseId.get(assignment.courseId) ?? 0,
  }));
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
