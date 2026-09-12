import type { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  ProfessorCourseDetailResponseSchema,
  ProfessorCourseListResponseSchema,
} from '@web-app/contracts';

import { createApp } from '../app.js';
import type { AuditLogger } from '../auth/audit-log.js';
import type { SessionService } from '../auth/session.js';
import { env } from '../config/env.js';

const courseId = '11111111-1111-4111-8111-111111111111';
const otherCourseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const missingCourseId = '99999999-9999-4999-8999-999999999999';
const ownerProfessorId = '22222222-2222-4222-8222-222222222222';
const assistantProfessorId = '33333333-3333-4333-8333-333333333333';
const unassignedProfessorId = '44444444-4444-4444-8444-444444444444';
const adminId = '55555555-5555-4555-8555-555555555555';
const now = new Date('2026-09-12T09:00:00.000Z');

const course = {
  id: courseId,
  code: 'CS101',
  title: 'Data Structures',
  description: 'Core course',
  semester: 3,
  ectsCredits: 6,
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

const otherCourse = {
  ...course,
  id: otherCourseId,
  code: 'CS202',
  title: 'Algorithms',
};

const assignments = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    courseId,
    instructorId: ownerProfessorId,
    instructorRole: 'owner' as const,
    createdAt: now,
    instructor: {
      id: ownerProfessorId,
      email: 'owner@example.edu',
      fullName: 'Owner Professor',
    },
    course,
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    courseId,
    instructorId: assistantProfessorId,
    instructorRole: 'assistant' as const,
    createdAt: now,
    instructor: {
      id: assistantProfessorId,
      email: 'assistant@example.edu',
      fullName: 'Assistant Professor',
    },
    course,
  },
  {
    id: '88888888-8888-4888-8888-888888888888',
    courseId: otherCourseId,
    instructorId: assistantProfessorId,
    instructorRole: 'owner' as const,
    createdAt: now,
    instructor: {
      id: assistantProfessorId,
      email: 'assistant@example.edu',
      fullName: 'Assistant Professor',
    },
    course: otherCourse,
  },
];

const documents = [
  { courseId, status: 'active', visibility: 'visible_to_students' },
  { courseId, status: 'active', visibility: 'hidden_from_students' },
  { courseId, status: 'deleted', visibility: 'visible_to_students' },
];

const enrollments = [
  { courseId, studentId: 'student-1' },
  { courseId, studentId: 'student-2' },
];

function createTestApp(role: UserRole, userId: string) {
  const auditLogger: AuditLogger = {
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
  };

  const courseDelegate = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      if (where.id === courseId) return course;
      if (where.id === otherCourseId) return otherCourse;
      return null;
    }),
  };

  const courseInstructor = {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          courseId_instructorId: { courseId: string; instructorId: string };
        };
      }) =>
        assignments.find(
          (assignment) =>
            assignment.courseId === where.courseId_instructorId.courseId &&
            assignment.instructorId ===
              where.courseId_instructorId.instructorId,
        ) ?? null,
    ),
    findMany: vi.fn(
      async ({
        where,
      }: {
        where: { courseId?: string; instructorId?: string };
      }) =>
        assignments.filter(
          (assignment) =>
            (where.courseId === undefined ||
              assignment.courseId === where.courseId) &&
            (where.instructorId === undefined ||
              assignment.instructorId === where.instructorId),
        ),
    ),
  };

  const document = {
    count: vi.fn(
      async ({
        where,
      }: {
        where: { courseId: string; status?: string; visibility?: string };
      }) =>
        documents.filter(
          (item) =>
            item.courseId === where.courseId &&
            (where.status === undefined || item.status === where.status) &&
            (where.visibility === undefined ||
              item.visibility === where.visibility),
        ).length,
    ),
  };

  const enrollment = {
    count: vi.fn(async ({ where }: { where: { courseId: string } }) =>
      enrollments.filter((item) => item.courseId === where.courseId).length,
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
              id: userId,
              email: `${userId}@example.edu`,
              fullName: 'Test User',
              role,
              isActive: true,
            },
          }
        : null,
    ),
    revokeSession: vi.fn(),
  };

  const app = createApp({
    auditLogger,
    professorCoursesPrisma: {
      course: courseDelegate,
      courseInstructor,
      document,
      enrollment,
    } as unknown as Pick<
      PrismaClient,
      'course' | 'courseInstructor' | 'document' | 'enrollment'
    >,
    sessionService,
  });

  return { app, auditLogger };
}

function authCookie(): string {
  return `${env.SESSION_COOKIE_NAME}=test-token`;
}

describe('professor course routes', () => {
  it('lists only the courses assigned to the requesting professor', async () => {
    const { app } = createTestApp('professor', ownerProfessorId);

    const response = await request(app)
      .get('/api/professor/courses')
      .set('Cookie', authCookie())
      .expect(200);

    const body = ProfessorCourseListResponseSchema.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        id: courseId,
        instructorRole: 'owner',
        counts: { documentCount: 2, visibleDocumentCount: 1 },
      }),
    );
    expect(body.summary.assignedCourseCount).toBe(1);
  });

  it('lists courses where the professor is an assistant', async () => {
    const { app } = createTestApp('professor', assistantProfessorId);

    const response = await request(app)
      .get('/api/professor/courses')
      .set('Cookie', authCookie())
      .expect(200);

    const body = ProfessorCourseListResponseSchema.parse(response.body);
    expect(body.data.map((item) => item.id).sort()).toEqual(
      [courseId, otherCourseId].sort(),
    );
  });

  it.each(['admin', 'student'] as const)(
    'rejects the professor list route for a %s',
    async (role) => {
      const { app } = createTestApp(role, adminId);

      await request(app)
        .get('/api/professor/courses')
        .set('Cookie', authCookie())
        .expect(403);
    },
  );

  it('returns course detail with all instructors and student count', async () => {
    const { app } = createTestApp('professor', ownerProfessorId);

    const response = await request(app)
      .get(`/api/professor/courses/${courseId}`)
      .set('Cookie', authCookie())
      .expect(200);

    const body = ProfessorCourseDetailResponseSchema.parse(response.body);
    expect(body.data.instructorRole).toBe('owner');
    expect(body.data.studentCount).toBe(2);
    expect(body.data.instructors.map((instructor) => instructor.role).sort()).toEqual(
      ['assistant', 'owner'],
    );
  });

  it('denies course detail access to a professor without an assignment and audits it', async () => {
    const { app, auditLogger } = createTestApp(
      'professor',
      unassignedProfessorId,
    );

    await request(app)
      .get(`/api/professor/courses/${courseId}`)
      .set('Cookie', authCookie())
      .expect(403);

    expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.denied',
        actorId: unassignedProfessorId,
        metadata: expect.objectContaining({ reason: 'professor_not_assigned' }),
      }),
    );
  });

  it('returns 404 for an unknown course id', async () => {
    const { app } = createTestApp('professor', ownerProfessorId);

    await request(app)
      .get(`/api/professor/courses/${missingCourseId}`)
      .set('Cookie', authCookie())
      .expect(404);
  });

  it('rejects the professor detail route for a student', async () => {
    const { app } = createTestApp('student', 'student-1');

    await request(app)
      .get(`/api/professor/courses/${courseId}`)
      .set('Cookie', authCookie())
      .expect(403);
  });
});
