import type { CourseInstructorRole, PrismaClient, UserRole } from '@prisma/client';
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
const studentId = '44444444-4444-4444-8444-444444444444';
const now = new Date('2026-09-12T09:00:00.000Z');

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
  { id: '51111111-1111-4111-8111-111111111111', courseId: courseAId, status: 'open', updatedAt: now },
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

function createTestApp() {
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
            if ('in' in where.status) return where.status.in.includes(thread.status);
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
          status?: string;
          updatedAt?: { gte: Date };
        };
      }) => {
        const filtered = threads
          .filter((thread) => where.courseId.in.includes(thread.courseId))
          .filter(
            (thread) => where.status === undefined || thread.status === where.status,
          )
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
      course,
      courseInstructor,
      document,
      forumThread,
    } as unknown as Pick<
      PrismaClient,
      'course' | 'courseInstructor' | 'document' | 'forumThread'
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
    expect(body.data.openThreads.map((thread) => thread.id).sort()).toEqual(
      [
        '51111111-1111-4111-8111-111111111111',
        '62222222-2222-4222-8222-222222222222',
      ].sort(),
    );
    expect(body.data.recentActivity).toHaveLength(4);

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
});
