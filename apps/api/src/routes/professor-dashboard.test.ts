import type {
  CourseInstructorRole,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ProfessorDashboardResponseSchema } from '@web-app/contracts';

import { createApp } from '../app.js';
import type { AuditLogger } from '../auth/audit-log.js';
import type { SessionService } from '../auth/session.js';
import { env } from '../config/env.js';

const professorId = '11111111-1111-4111-8111-111111111111';
const courseAId = '22222222-2222-4222-8222-222222222222';
const courseBId = '33333333-3333-4333-8333-333333333333';
const courseCId = '35555555-5555-4555-8555-555555555555';
const studentId = '44444444-4444-4444-8444-444444444444';
const studentId2 = '45555555-5555-4555-8555-555555555555';
const studentId3 = '46666666-6666-4666-8666-666666666666';
const now = new Date('2026-09-12T09:00:00.000Z');

const RECENT_ANNOTATION_AT = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
const STALE_ANNOTATION_AT = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

const courseA = {
  id: courseAId,
  code: 'CS101',
  title: 'Course A',
  description: null,
  semester: 1,
  ectsCredits: 6,
  isActive: true,
};
const courseB = {
  id: courseBId,
  code: 'CS102',
  title: 'Course B',
  description: null,
  semester: 1,
  ectsCredits: 6,
  isActive: true,
};

const assignments = [
  {
    courseId: courseAId,
    instructorId: professorId,
    instructorRole: 'owner' as CourseInstructorRole,
    course: courseA,
  },
  {
    courseId: courseBId,
    instructorId: professorId,
    instructorRole: 'owner' as CourseInstructorRole,
    course: courseB,
  },
];

interface ThreadFixture {
  id: string;
  courseId: string;
  status: string;
  updatedAt: Date;
}

const threads: ThreadFixture[] = [
  {
    id: '51111111-1111-4111-8111-111111111111',
    courseId: courseAId,
    status: 'open',
    updatedAt: now,
  },
  {
    id: '62222222-2222-4222-8222-222222222222',
    courseId: courseAId,
    status: 'instructor_answered',
    updatedAt: now,
  },
  {
    id: '73333333-3333-4333-8333-333333333333',
    courseId: courseBId,
    status: 'verified',
    updatedAt: now,
  },
  {
    id: '84444444-4444-4444-8444-444444444444',
    courseId: courseBId,
    status: 'verified',
    updatedAt: new Date('2020-01-01T00:00:00.000Z'),
  },
];

const enrollments: { courseId: string; status: 'active' | 'inactive' }[] = [
  { courseId: courseAId, status: 'active' },
  { courseId: courseAId, status: 'active' },
  { courseId: courseAId, status: 'active' },
  { courseId: courseBId, status: 'active' },
  { courseId: courseBId, status: 'active' },
];

const roadmapNodesFixture: {
  courseId: string;
  progress: { status: string }[];
}[] = [
  {
    courseId: courseAId,
    progress: [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'not_started' },
    ],
  },
  { courseId: courseBId, progress: [{ status: 'completed' }] },
];

function threadRecord(thread: ThreadFixture) {
  const course = thread.courseId === courseAId ? courseA : courseB;
  return {
    id: thread.id,
    courseId: thread.courseId,
    documentId: null,
    annotationId: null,
    title: `Thread ${thread.id}`,
    status: thread.status,
    visibility: 'public' as const,
    pageNumberSnapshot: null,
    selectedTextSnapshot: null,
    documentTitleSnapshot: null,
    verifiedPostId: null,
    createdAt: now,
    updatedAt: thread.updatedAt,
    category: { kind: 'general' as const },
    author: { id: studentId, fullName: 'Student', role: 'student' as UserRole },
    course: { code: course.code, title: course.title },
    posts: [],
    _count: { posts: 0 },
  };
}

interface AnnotationFixture {
  documentId: string;
  documentTitle: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  authorId: string;
  authorRole: UserRole;
  type: 'question' | 'confusing' | 'note' | 'highlight' | 'important';
  visibility: 'private' | 'public' | 'instructor_only';
  isDeleted: boolean;
  documentStatus: 'active' | 'archived';
  createdAt: Date;
}

function annotation(
  overrides: Partial<AnnotationFixture> & {
    documentId: string;
    authorId: string;
    type: AnnotationFixture['type'];
  },
): AnnotationFixture {
  return {
    documentTitle: 'Document',
    courseId: courseAId,
    courseCode: courseA.code,
    courseTitle: courseA.title,
    authorRole: 'student',
    visibility: 'public',
    isDeleted: false,
    documentStatus: 'active',
    createdAt: RECENT_ANNOTATION_AT,
    ...overrides,
  };
}

interface WhereClause {
  isDeleted?: boolean;
  visibility?: { in: string[] };
  type?: { in: string[] };
  createdAt?: { gte: Date };
  author?: { role: string };
  document?: { status: string; courseId: { in: string[] } };
}

function createAnnotationFindMany(fixtures: AnnotationFixture[]) {
  return vi.fn(async ({ where }: { where: WhereClause }) =>
    fixtures
      .filter(
        (item) =>
          where.isDeleted === undefined || item.isDeleted === where.isDeleted,
      )
      .filter(
        (item) =>
          where.visibility === undefined ||
          where.visibility.in.includes(item.visibility),
      )
      .filter(
        (item) => where.type === undefined || where.type.in.includes(item.type),
      )
      .filter(
        (item) =>
          where.createdAt === undefined ||
          item.createdAt.getTime() >= where.createdAt.gte.getTime(),
      )
      .filter(
        (item) =>
          where.author === undefined || item.authorRole === where.author.role,
      )
      .filter(
        (item) =>
          where.document === undefined ||
          (item.documentStatus === where.document.status &&
            where.document.courseId.in.includes(item.courseId)),
      )
      .map((item) => ({
        documentId: item.documentId,
        authorId: item.authorId,
        type: item.type,
        createdAt: item.createdAt,
        document: {
          title: item.documentTitle,
          courseId: item.courseId,
          course: { code: item.courseCode, title: item.courseTitle },
        },
      })),
  );
}

function createTestApp(annotationFixtures: AnnotationFixture[] = []) {
  const auditLogger: AuditLogger = {
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
  };

  const courseInstructor = {
    findMany: vi.fn(async ({ where }: { where: { instructorId: string } }) =>
      assignments.filter((item) => item.instructorId === where.instructorId),
    ),
  };

  const document = { count: vi.fn(async () => 0) };
  const course = { findUnique: vi.fn(async () => null) };
  const annotationClient = {
    findMany: createAnnotationFindMany(annotationFixtures),
  };

  const forumThread = {
    findMany: vi.fn(
      async ({
        where,
      }: {
        where: {
          courseId: { in: string[] };
          status?: string | { in: string[] } | { not: string };
        };
      }) =>
        threads
          .filter((thread) => where.courseId.in.includes(thread.courseId))
          .filter((thread) => {
            if (where.status === undefined) return true;
            if (typeof where.status === 'string')
              return thread.status === where.status;
            if ('in' in where.status)
              return where.status.in.includes(thread.status);
            return thread.status !== where.status.not;
          })
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .map(threadRecord),
    ),
    groupBy: vi.fn(
      async ({
        by,
        where,
      }: {
        by: string[];
        where: {
          courseId: { in: string[] };
          status?: string | { not: string };
          updatedAt?: { gte: Date };
        };
      }) => {
        const filtered = threads
          .filter((thread) => where.courseId.in.includes(thread.courseId))
          .filter((thread) => {
            if (where.status === undefined) return true;
            if (typeof where.status === 'string')
              return thread.status === where.status;
            return thread.status !== where.status.not;
          })
          .filter(
            (thread) =>
              where.updatedAt === undefined ||
              thread.updatedAt.getTime() >= where.updatedAt.gte.getTime(),
          );

        if (by.includes('status')) {
          const groups = new Map<string, number>();
          for (const thread of filtered) {
            const key = `${thread.courseId}::${thread.status}`;
            groups.set(key, (groups.get(key) ?? 0) + 1);
          }
          return [...groups.entries()].map(([key, count]) => {
            const [groupCourseId, status] = key.split('::');
            return { courseId: groupCourseId, status, _count: { _all: count } };
          });
        }

        const groups = new Map<string, number>();
        for (const thread of filtered) {
          groups.set(thread.courseId, (groups.get(thread.courseId) ?? 0) + 1);
        }
        return [...groups.entries()].map(([groupCourseId, count]) => ({
          courseId: groupCourseId,
          _count: { _all: count },
        }));
      },
    ),
  };

  const enrollment = {
    groupBy: vi.fn(
      async ({
        where,
      }: {
        where: { courseId: { in: string[] }; status: string };
      }) => {
        const groups = new Map<string, number>();
        for (const item of enrollments) {
          if (!where.courseId.in.includes(item.courseId)) continue;
          if (item.status !== where.status) continue;
          groups.set(item.courseId, (groups.get(item.courseId) ?? 0) + 1);
        }
        return [...groups.entries()].map(([groupCourseId, count]) => ({
          courseId: groupCourseId,
          _count: { _all: count },
        }));
      },
    ),
  };

  const roadmapNode = {
    findMany: vi.fn(
      async ({ where }: { where: { courseId: { in: string[] } } }) =>
        roadmapNodesFixture.filter((node) =>
          where.courseId.in.includes(node.courseId),
        ),
    ),
  };

  const sessionService: SessionService = {
    createSession: vi.fn(),
    getSession: vi.fn(async (token) =>
      token
        ? {
            id: 'test-session',
            expiresAt: new Date(now.getTime() + 60_000),
            user: {
              id: professorId,
              email: 'professor@example.edu',
              fullName: 'Professor',
              role: 'professor' as UserRole,
              isActive: true,
            },
          }
        : null,
    ),
    revokeSession: vi.fn(),
  };

  const app = createApp({
    auditLogger,
    sessionService,
    professorDashboardPrisma: {
      annotation: annotationClient,
      course,
      courseInstructor,
      document,
      enrollment,
      forumThread,
      roadmapNode,
    } as unknown as Pick<
      PrismaClient,
      | 'annotation'
      | 'course'
      | 'courseInstructor'
      | 'document'
      | 'enrollment'
      | 'forumThread'
      | 'roadmapNode'
    >,
  });

  return { app };
}

function authCookie(): string {
  return `${env.SESSION_COOKIE_NAME}=test-token`;
}

describe('professor dashboard route', () => {
  it('aggregates courses, thread widgets, and per-course counters', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .get('/api/professor/dashboard')
      .set('Cookie', authCookie())
      .expect(200);

    const body = ProfessorDashboardResponseSchema.parse(response.body);
    expect(body.data.courses.map((course) => course.id).sort()).toEqual(
      [courseAId, courseBId].sort(),
    );
    expect(body.data.unansweredThreads.map((thread) => thread.id)).toEqual([
      '51111111-1111-4111-8111-111111111111',
    ]);
    // The answered widget is the complement of the unanswered one: it carries
    // only the instructor-answered thread, never the open one above.
    expect(body.data.answeredThreads.map((thread) => thread.id)).toEqual([
      '62222222-2222-4222-8222-222222222222',
    ]);
    expect(body.data.confusionPoints).toEqual([]);

    const counterA = body.data.perCourseCounters.find(
      (row) => row.courseId === courseAId,
    );
    expect(counterA).toMatchObject({
      unansweredCount: 1,
      openCount: 2,
      recentlyVerifiedCount: 0,
    });

    const counterB = body.data.perCourseCounters.find(
      (row) => row.courseId === courseBId,
    );
    expect(counterB).toMatchObject({
      unansweredCount: 0,
      openCount: 0,
      // Only one of the two verified threads in course B falls inside the
      // recently-verified window; the other is far in the past.
      recentlyVerifiedCount: 1,
    });
  });

  describe('confusion points widget', () => {
    it('counts only non-deleted, public/instructor_only, student-authored question and confusing signals', async () => {
      const documentId = 'a1111111-1111-4111-8111-111111111111';
      const fixtures: AnnotationFixture[] = [
        annotation({
          documentId,
          authorId: studentId,
          type: 'question',
          visibility: 'public',
        }),
        annotation({
          documentId,
          authorId: studentId2,
          type: 'confusing',
          visibility: 'instructor_only',
        }),
        // Excluded: private visibility, even though otherwise qualifying.
        annotation({
          documentId,
          authorId: studentId3,
          type: 'confusing',
          visibility: 'private',
        }),
        // Excluded: soft-deleted.
        annotation({
          documentId,
          authorId: studentId3,
          type: 'question',
          visibility: 'public',
          isDeleted: true,
        }),
        // Excluded: not a question/confusing annotation type.
        annotation({
          documentId,
          authorId: studentId3,
          type: 'note',
          visibility: 'public',
        }),
        // Excluded: authored by a professor, not a student.
        annotation({
          documentId,
          authorId: professorId,
          type: 'question',
          visibility: 'public',
          authorRole: 'professor',
        }),
      ];

      const { app } = createTestApp(fixtures);

      const response = await request(app)
        .get('/api/professor/dashboard')
        .set('Cookie', authCookie())
        .expect(200);

      const body = ProfessorDashboardResponseSchema.parse(response.body);
      expect(body.data.confusionPoints).toEqual([
        expect.objectContaining({
          documentId,
          questionCount: 1,
          confusingCount: 1,
          studentCount: 2,
        }),
      ]);
    });

    it('only surfaces signals on active documents belonging to the requesting professor', async () => {
      const ownDocumentId = 'a2222222-2222-4222-8222-222222222222';
      const otherCourseDocumentId = 'a3333333-3333-4333-8333-333333333333';
      const archivedDocumentId = 'a4444444-4444-4444-8444-444444444444';

      const fixtures: AnnotationFixture[] = [
        annotation({
          documentId: ownDocumentId,
          authorId: studentId,
          type: 'question',
        }),
        annotation({
          documentId: ownDocumentId,
          authorId: studentId2,
          type: 'confusing',
        }),
        // Excluded: belongs to a course the professor does not teach.
        annotation({
          documentId: otherCourseDocumentId,
          authorId: studentId,
          type: 'question',
          courseId: courseCId,
        }),
        annotation({
          documentId: otherCourseDocumentId,
          authorId: studentId2,
          type: 'confusing',
          courseId: courseCId,
        }),
        // Excluded: document is not active.
        annotation({
          documentId: archivedDocumentId,
          authorId: studentId,
          type: 'question',
          documentStatus: 'archived',
        }),
        annotation({
          documentId: archivedDocumentId,
          authorId: studentId2,
          type: 'confusing',
          documentStatus: 'archived',
        }),
      ];

      const { app } = createTestApp(fixtures);

      const response = await request(app)
        .get('/api/professor/dashboard')
        .set('Cookie', authCookie())
        .expect(200);

      const body = ProfessorDashboardResponseSchema.parse(response.body);
      expect(body.data.confusionPoints.map((item) => item.documentId)).toEqual([
        ownDocumentId,
      ]);
    });

    it('only counts signals within the last 14 days', async () => {
      const documentId = 'a5555555-5555-4555-8555-555555555555';
      const fixtures: AnnotationFixture[] = [
        annotation({
          documentId,
          authorId: studentId,
          type: 'question',
          createdAt: STALE_ANNOTATION_AT,
        }),
        annotation({
          documentId,
          authorId: studentId2,
          type: 'confusing',
          createdAt: STALE_ANNOTATION_AT,
        }),
      ];

      const { app } = createTestApp(fixtures);

      const response = await request(app)
        .get('/api/professor/dashboard')
        .set('Cookie', authCookie())
        .expect(200);

      const body = ProfessorDashboardResponseSchema.parse(response.body);
      expect(body.data.confusionPoints).toEqual([]);
    });

    it('requires at least two signals from two distinct students, and sorts by signal volume', async () => {
      const belowThresholdDocumentId = 'a6666666-6666-4666-8666-666666666666';
      const sameStudentDocumentId = 'a7777777-7777-4777-8777-777777777777';
      const highVolumeDocumentId = 'a8888888-8888-4888-8888-888888888888';
      const lowVolumeDocumentId = 'a9999999-9999-4999-8999-999999999999';

      const fixtures: AnnotationFixture[] = [
        // Excluded: only a single signal.
        annotation({
          documentId: belowThresholdDocumentId,
          authorId: studentId,
          type: 'question',
        }),
        // Excluded: two signals, but from the same student.
        annotation({
          documentId: sameStudentDocumentId,
          authorId: studentId,
          type: 'question',
        }),
        annotation({
          documentId: sameStudentDocumentId,
          authorId: studentId,
          type: 'confusing',
        }),
        // Included: 3 signals from 2 students -> ranks first.
        annotation({
          documentId: highVolumeDocumentId,
          authorId: studentId,
          type: 'question',
        }),
        annotation({
          documentId: highVolumeDocumentId,
          authorId: studentId,
          type: 'confusing',
        }),
        annotation({
          documentId: highVolumeDocumentId,
          authorId: studentId2,
          type: 'confusing',
        }),
        // Included: 2 signals from 2 students -> ranks second.
        annotation({
          documentId: lowVolumeDocumentId,
          authorId: studentId,
          type: 'question',
        }),
        annotation({
          documentId: lowVolumeDocumentId,
          authorId: studentId2,
          type: 'confusing',
        }),
      ];

      const { app } = createTestApp(fixtures);

      const response = await request(app)
        .get('/api/professor/dashboard')
        .set('Cookie', authCookie())
        .expect(200);

      const body = ProfessorDashboardResponseSchema.parse(response.body);
      expect(body.data.confusionPoints.map((item) => item.documentId)).toEqual([
        highVolumeDocumentId,
        lowVolumeDocumentId,
      ]);
    });
  });

  describe('course analytics widget', () => {
    it('aggregates question/answer counts and average roadmap progress per course', async () => {
      const { app } = createTestApp();

      const response = await request(app)
        .get('/api/professor/dashboard')
        .set('Cookie', authCookie())
        .expect(200);

      const body = ProfessorDashboardResponseSchema.parse(response.body);

      // Course A: 3 active students, 1 roadmap node with 2/3 completions,
      // and 2 non-archived threads (1 open, 1 instructor_answered).
      expect(
        body.data.courseAnalytics.find((row) => row.courseId === courseAId),
      ).toMatchObject({
        questionCount: 2,
        answeredCount: 1,
        studentCount: 3,
        averageProgressPercentage: 67,
      });

      // Course B: 2 active students, 1 roadmap node with 1/2 completions,
      // and 2 non-archived (verified) threads.
      expect(
        body.data.courseAnalytics.find((row) => row.courseId === courseBId),
      ).toMatchObject({
        questionCount: 2,
        answeredCount: 2,
        studentCount: 2,
        averageProgressPercentage: 50,
      });
    });
  });
});
