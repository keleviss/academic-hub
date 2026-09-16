import type { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { StudentDashboardResponseSchema } from '@web-app/contracts';

import { createApp } from '../app.js';
import type { AuditLogger } from '../auth/audit-log.js';
import type { SessionService } from '../auth/session.js';
import { env } from '../config/env.js';

const studentId = '11111111-1111-4111-8111-111111111111';
const courseAId = '22222222-2222-4222-8222-222222222222';
const courseBId = '33333333-3333-4333-8333-333333333333';
const otherStudentId = '44444444-4444-4444-8444-444444444444';
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

const enrollments = [
  { courseId: courseAId, studentId, status: 'active', course: courseA },
  { courseId: courseBId, studentId, status: 'active', course: courseB },
];

const annotations = [
  {
    id: 'a1111111-1111-4111-8111-111111111111',
    courseId: courseAId,
    documentId: 'd1111111-1111-4111-8111-111111111111',
    authorId: studentId,
    type: 'note' as const,
    visibility: 'public' as const,
    body: 'Σημείωση',
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    target: {
      id: 'aa111111-1111-4111-8111-111111111111',
      pageNumber: 1,
      selectedText: null,
    },
    author: { id: studentId, fullName: 'Student', role: 'student' as const },
    document: { status: 'active', visibility: 'visible_to_students' },
    course: { code: courseA.code, title: courseA.title },
  },
];

interface ThreadFixture {
  id: string;
  courseId: string;
  authorId: string;
  status: string;
  visibility: 'public' | 'instructor_only';
  verifiedPostId: string | null;
  course: { code: string; title: string };
}

const threads: ThreadFixture[] = [
  {
    id: '51111111-1111-4111-8111-111111111111',
    courseId: courseAId,
    authorId: studentId,
    status: 'open',
    visibility: 'public',
    verifiedPostId: null,
    course: { code: courseA.code, title: courseA.title },
  },
  {
    id: '62222222-2222-4222-8222-222222222222',
    courseId: courseBId,
    authorId: studentId,
    status: 'verified',
    visibility: 'public',
    verifiedPostId: '72222222-2222-4222-8222-222222222222',
    course: { code: courseB.code, title: courseB.title },
  },
  {
    id: '83333333-3333-4333-8333-333333333333',
    courseId: courseAId,
    authorId: otherStudentId,
    status: 'open',
    visibility: 'public',
    verifiedPostId: null,
    course: { code: courseA.code, title: courseA.title },
  },
];

function threadRecord(thread: ThreadFixture) {
  return {
    id: thread.id,
    courseId: thread.courseId,
    documentId: null,
    annotationId: null,
    title: `Thread ${thread.id}`,
    status: thread.status,
    visibility: thread.visibility,
    pageNumberSnapshot: null,
    selectedTextSnapshot: null,
    documentTitleSnapshot: null,
    verifiedPostId: thread.verifiedPostId,
    createdAt: now,
    updatedAt: now,
    category: { kind: 'general' as const },
    author: {
      id: thread.authorId,
      fullName: 'Author',
      role: 'student' as const,
    },
    course: thread.course,
    posts: [],
    _count: { posts: 0 },
  };
}

function createTestApp() {
  const auditLogger: AuditLogger = {
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
  };

  const enrollment = {
    findMany: vi.fn(async ({ where }: { where: { studentId: string } }) =>
      enrollments.filter((item) => item.studentId === where.studentId),
    ),
  };

  const document = {
    count: vi.fn(async () => 0),
  };

  const courseInstructor = {
    findMany: vi.fn(async () => []),
  };

  const annotation = {
    findMany: vi.fn(
      async ({
        where,
      }: {
        where: { authorId: string; courseId: { in: string[] } };
      }) =>
        annotations.filter(
          (item) =>
            item.authorId === where.authorId &&
            where.courseId.in.includes(item.courseId),
        ),
    ),
  };

  const forumThread = {
    findMany: vi.fn(
      async ({
        where,
      }: {
        where: {
          authorId?: string;
          courseId: { in: string[] };
          status?: string | { in: string[] } | { not: string };
          OR?: { visibility: string; authorId?: string }[];
        };
      }) =>
        threads
          .filter((thread) => where.courseId.in.includes(thread.courseId))
          .filter(
            (thread) =>
              where.authorId === undefined || thread.authorId === where.authorId,
          )
          .filter((thread) => {
            if (where.status === undefined) return true;
            if (typeof where.status === 'string')
              return thread.status === where.status;
            if ('in' in where.status) return where.status.in.includes(thread.status);
            return thread.status !== where.status.not;
          })
          .filter(
            (thread) =>
              where.OR === undefined ||
              where.OR.some(
                (condition) =>
                  thread.visibility === condition.visibility &&
                  (condition.authorId === undefined ||
                    thread.authorId === condition.authorId),
              ),
          )
          .map(threadRecord),
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
              id: studentId,
              email: 'student@example.edu',
              fullName: 'Student',
              role: 'student' as UserRole,
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
    studentDashboardPrisma: {
      annotation,
      courseInstructor,
      document,
      enrollment,
      forumThread,
    } as unknown as Pick<
      PrismaClient,
      'annotation' | 'courseInstructor' | 'document' | 'enrollment' | 'forumThread'
    >,
  });

  return { app };
}

function authCookie(): string {
  return `${env.SESSION_COOKIE_NAME}=test-token`;
}

describe('student dashboard route', () => {
  it('aggregates courses, notes, and threads scoped to the student', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .get('/api/student/dashboard')
      .set('Cookie', authCookie());
    expect(response.status).toBe(200);

    const body = StudentDashboardResponseSchema.parse(response.body);
    expect(body.data.courses.map((course) => course.id).sort()).toEqual(
      [courseAId, courseBId].sort(),
    );
    expect(body.data.recentNotes).toHaveLength(1);
    expect(body.data.recentNotes[0]).toMatchObject({
      courseCode: 'CS101',
      courseTitle: 'Course A',
    });
    expect(body.data.openQuestions.map((thread) => thread.id)).toEqual([
      '51111111-1111-4111-8111-111111111111',
    ]);
    expect(body.data.verifiedAnswers.map((thread) => thread.id)).toEqual([
      '62222222-2222-4222-8222-222222222222',
    ]);
    // Active discussions is a course-wide recency feed, not limited to the
    // student's own threads.
    expect(body.data.activeDiscussions).toHaveLength(3);
  });
});
