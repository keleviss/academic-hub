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
  type ProfessorCourseAnalytics,
  type ProfessorCourseListItem,
  type ProfessorDashboardConfusionPoint,
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
  | 'annotation'
  | 'course'
  | 'courseInstructor'
  | 'document'
  | 'enrollment'
  | 'forumThread'
  | 'roadmapNode'
>;

export interface ProfessorDashboardRouteOptions {
  auditLogger?: AuditLogger;
  prisma?: ProfessorDashboardPrismaClient;
  sessionService?: SessionService;
}

const DASHBOARD_ITEM_LIMIT = 5;
const RECENTLY_VERIFIED_WINDOW_DAYS = 14;
const CONFUSION_WINDOW_DAYS = 14;
const CONFUSION_MIN_SIGNAL_COUNT = 2;
const CONFUSION_MIN_STUDENT_COUNT = 2;
// Higher than DASHBOARD_ITEM_LIMIT: this list backs both the compact
// dashboard widget (which only renders the first couple of items) and the
// full analytics page.
const CONFUSION_POINT_LIMIT = 20;

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

interface ConfusionAnnotationRecord {
  documentId: string;
  authorId: string;
  type: 'question' | 'confusing';
  createdAt: Date;
  document: { title: string; courseId: string; course: DashboardCourseRef };
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
        answeredThreads,
        confusionPoints,
        courseCounters,
        courseAnalytics,
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
        // Deliberately excludes 'open': this widget is the complement of the
        // unanswered queue, not a superset of it, so the two lists never show
        // the same thread and each one maps to a different teaching action.
        prisma.forumThread.findMany({
          include: dashboardThreadInclude(),
          orderBy: [{ updatedAt: 'desc' }],
          take: DASHBOARD_ITEM_LIMIT,
          where: {
            courseId: { in: myCourseIds },
            status: 'instructor_answered',
          },
        }),
        confusionPointsFor(prisma, myCourseIds),
        perCourseCountersFor(prisma, assignments),
        courseAnalyticsFor(prisma, assignments),
      ]);

      const payload: ProfessorDashboardResponse = {
        data: {
          courses,
          unansweredThreads: (unansweredThreads as DashboardThreadRecord[]).map(
            toDashboardForumThreadItem,
          ),
          answeredThreads: (answeredThreads as DashboardThreadRecord[]).map(
            toDashboardForumThreadItem,
          ),
          confusionPoints,
          perCourseCounters: courseCounters,
          courseAnalytics,
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

async function confusionPointsFor(
  prisma: ProfessorDashboardPrismaClient,
  myCourseIds: string[],
): Promise<ProfessorDashboardConfusionPoint[]> {
  const since = new Date(
    Date.now() - CONFUSION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const annotations = (await prisma.annotation.findMany({
    select: {
      documentId: true,
      authorId: true,
      type: true,
      createdAt: true,
      document: {
        select: {
          title: true,
          courseId: true,
          course: { select: { code: true, title: true } },
        },
      },
    },
    where: {
      isDeleted: false,
      visibility: { in: ['public', 'instructor_only'] },
      type: { in: ['question', 'confusing'] },
      createdAt: { gte: since },
      author: { role: 'student' },
      document: { status: 'active', courseId: { in: myCourseIds } },
    },
  })) as ConfusionAnnotationRecord[];

  interface DocumentAggregate {
    documentId: string;
    courseId: string;
    course: DashboardCourseRef;
    documentTitle: string;
    questionCount: number;
    confusingCount: number;
    studentIds: Set<string>;
    lastSignalAt: Date;
  }

  const aggregatesByDocumentId = new Map<string, DocumentAggregate>();
  for (const annotation of annotations) {
    let aggregate = aggregatesByDocumentId.get(annotation.documentId);
    if (!aggregate) {
      aggregate = {
        documentId: annotation.documentId,
        courseId: annotation.document.courseId,
        course: annotation.document.course,
        documentTitle: annotation.document.title,
        questionCount: 0,
        confusingCount: 0,
        studentIds: new Set(),
        lastSignalAt: annotation.createdAt,
      };
      aggregatesByDocumentId.set(annotation.documentId, aggregate);
    }

    if (annotation.type === 'question') aggregate.questionCount += 1;
    if (annotation.type === 'confusing') aggregate.confusingCount += 1;
    aggregate.studentIds.add(annotation.authorId);
    if (annotation.createdAt > aggregate.lastSignalAt) {
      aggregate.lastSignalAt = annotation.createdAt;
    }
  }

  return [...aggregatesByDocumentId.values()]
    .filter(
      (aggregate) =>
        aggregate.questionCount + aggregate.confusingCount >=
          CONFUSION_MIN_SIGNAL_COUNT &&
        aggregate.studentIds.size >= CONFUSION_MIN_STUDENT_COUNT,
    )
    .sort((a, b) => {
      const totalDiff =
        b.questionCount +
        b.confusingCount -
        (a.questionCount + a.confusingCount);
      if (totalDiff !== 0) return totalDiff;
      return b.lastSignalAt.getTime() - a.lastSignalAt.getTime();
    })
    .slice(0, CONFUSION_POINT_LIMIT)
    .map((aggregate) => ({
      courseId: aggregate.courseId,
      courseCode: aggregate.course.code,
      courseTitle: aggregate.course.title,
      documentId: aggregate.documentId,
      documentTitle: aggregate.documentTitle,
      questionCount: aggregate.questionCount,
      confusingCount: aggregate.confusingCount,
      studentCount: aggregate.studentIds.size,
      lastSignalAt: aggregate.lastSignalAt.toISOString(),
    }));
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

async function courseAnalyticsFor(
  prisma: ProfessorDashboardPrismaClient,
  assignments: { courseId: string; course: CourseRecord }[],
): Promise<ProfessorCourseAnalytics[]> {
  const myCourseIds = assignments.map((assignment) => assignment.courseId);

  const [threadStatusCounts, enrollmentCounts, roadmapNodes] =
    await Promise.all([
      prisma.forumThread.groupBy({
        _count: { _all: true },
        by: ['courseId', 'status'],
        where: { courseId: { in: myCourseIds }, status: { not: 'archived' } },
      }),
      prisma.enrollment.groupBy({
        _count: { _all: true },
        by: ['courseId'],
        where: { courseId: { in: myCourseIds }, status: 'active' },
      }),
      prisma.roadmapNode.findMany({
        select: {
          courseId: true,
          progress: { select: { status: true } },
        },
        where: { courseId: { in: myCourseIds } },
      }),
    ]);

  const questionCountByCourseId = new Map<string, number>();
  const answeredCountByCourseId = new Map<string, number>();
  for (const row of threadStatusCounts) {
    questionCountByCourseId.set(
      row.courseId,
      (questionCountByCourseId.get(row.courseId) ?? 0) + row._count._all,
    );
    if (row.status !== 'open') {
      answeredCountByCourseId.set(
        row.courseId,
        (answeredCountByCourseId.get(row.courseId) ?? 0) + row._count._all,
      );
    }
  }

  const studentCountByCourseId = new Map(
    enrollmentCounts.map((row) => [row.courseId, row._count._all]),
  );

  const nodeCountByCourseId = new Map<string, number>();
  const completedProgressByCourseId = new Map<string, number>();
  for (const node of roadmapNodes) {
    nodeCountByCourseId.set(
      node.courseId,
      (nodeCountByCourseId.get(node.courseId) ?? 0) + 1,
    );
    const completedCount = node.progress.filter(
      (entry) => entry.status === 'completed',
    ).length;
    completedProgressByCourseId.set(
      node.courseId,
      (completedProgressByCourseId.get(node.courseId) ?? 0) + completedCount,
    );
  }

  return assignments.map((assignment) => {
    const studentCount = studentCountByCourseId.get(assignment.courseId) ?? 0;
    const nodeCount = nodeCountByCourseId.get(assignment.courseId) ?? 0;
    const completedCount =
      completedProgressByCourseId.get(assignment.courseId) ?? 0;
    const possibleCount = studentCount * nodeCount;

    return {
      courseId: assignment.courseId,
      courseCode: assignment.course.code,
      courseTitle: assignment.course.title,
      questionCount: questionCountByCourseId.get(assignment.courseId) ?? 0,
      answeredCount: answeredCountByCourseId.get(assignment.courseId) ?? 0,
      studentCount,
      averageProgressPercentage:
        possibleCount === 0
          ? 0
          : Math.round((completedCount / possibleCount) * 100),
    };
  });
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
