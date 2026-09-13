import type { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  StudentCourseDetailResponseSchema,
  StudentCourseListResponseSchema,
} from '@web-app/contracts';

import { createApp } from '../app.js';
import type { AuditLogger } from '../auth/audit-log.js';
import type { SessionService } from '../auth/session.js';
import { env } from '../config/env.js';

const courseId = '11111111-1111-4111-8111-111111111111';
const inactiveCourseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const missingCourseId = '99999999-9999-4999-8999-999999999999';
const activeStudentId = '22222222-2222-4222-8222-222222222222';
const inactiveEnrollmentStudentId = '33333333-3333-4333-8333-333333333333';
const completedEnrollmentStudentId = '44444444-4444-4444-8444-444444444444';
const inactiveCourseStudentId = '55555555-5555-4555-8555-555555555555';
const professorId = '66666666-6666-4666-8666-666666666666';
const adminId = '77777777-7777-4777-8777-777777777777';
const instructorId = '88888888-8888-4888-8888-888888888888';
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

const inactiveCourse = {
  ...course,
  id: inactiveCourseId,
  code: 'CS202',
  title: 'Retired Course',
  isActive: false,
};

const enrollments = [
  {
    id: 'e1111111-1111-4111-8111-111111111111',
    courseId,
    studentId: activeStudentId,
    status: 'active' as const,
    course,
  },
  {
    id: 'e2222222-2222-4222-8222-222222222222',
    courseId,
    studentId: inactiveEnrollmentStudentId,
    status: 'inactive' as const,
    course,
  },
  {
    id: 'e3333333-3333-4333-8333-333333333333',
    courseId,
    studentId: completedEnrollmentStudentId,
    status: 'completed' as const,
    course,
  },
  {
    id: 'e4444444-4444-4444-8444-444444444444',
    courseId: inactiveCourseId,
    studentId: inactiveCourseStudentId,
    status: 'active' as const,
    course: inactiveCourse,
  },
];

const documents = [
  { courseId, status: 'active', visibility: 'visible_to_students' },
  { courseId, status: 'active', visibility: 'hidden_from_students' },
  { courseId, status: 'deleted', visibility: 'visible_to_students' },
];

const instructorAssignments = [
  {
    id: '99999999-9999-4999-8999-999999999999',
    courseId,
    instructorRole: 'owner' as const,
    createdAt: now,
    instructor: {
      id: instructorId,
      email: 'owner@example.edu',
      fullName: 'Owner Professor',
    },
  },
];

function createTestApp(role: UserRole, userId: string) {
  const auditLogger: AuditLogger = {
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
  };

  const courseDelegate = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      if (where.id === courseId) return course;
      if (where.id === inactiveCourseId) return inactiveCourse;
      return null;
    }),
  };

  const courseInstructor = {
    findMany: vi.fn(async ({ where }: { where: { courseId: string } }) =>
      instructorAssignments.filter(
        (assignment) => assignment.courseId === where.courseId,
      ),
    ),
  };

  const enrollment = {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          courseId_studentId: { courseId: string; studentId: string };
        };
      }) =>
        enrollments.find(
          (item) =>
            item.courseId === where.courseId_studentId.courseId &&
            item.studentId === where.courseId_studentId.studentId,
        ) ?? null,
    ),
    findMany: vi.fn(
      async ({
        where,
      }: {
        where: {
          studentId: string;
          status?: string;
          course?: { isActive: boolean };
        };
      }) =>
        enrollments.filter(
          (item) =>
            item.studentId === where.studentId &&
            (where.status === undefined || item.status === where.status) &&
            (where.course?.isActive === undefined ||
              item.course.isActive === where.course.isActive),
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
    studentCoursesPrisma: {
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

describe('student course routes', () => {
  it('lists only courses with an active enrollment in an active course', async () => {
    const { app } = createTestApp('student', activeStudentId);

    const response = await request(app)
      .get('/api/student/courses')
      .set('Cookie', authCookie())
      .expect(200);

    const body = StudentCourseListResponseSchema.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        id: courseId,
        counts: { documentCount: 1 },
      }),
    );
    expect(body.summary.enrolledCourseCount).toBe(1);
  });

  it('excludes inactive and completed enrollments from the list', async () => {
    const { app: inactiveApp } = createTestApp(
      'student',
      inactiveEnrollmentStudentId,
    );
    const { app: completedApp } = createTestApp(
      'student',
      completedEnrollmentStudentId,
    );

    const inactiveResponse = await request(inactiveApp)
      .get('/api/student/courses')
      .set('Cookie', authCookie())
      .expect(200);
    const completedResponse = await request(completedApp)
      .get('/api/student/courses')
      .set('Cookie', authCookie())
      .expect(200);

    expect(
      StudentCourseListResponseSchema.parse(inactiveResponse.body).data,
    ).toHaveLength(0);
    expect(
      StudentCourseListResponseSchema.parse(completedResponse.body).data,
    ).toHaveLength(0);
  });

  it('excludes an active enrollment in an inactive course from the list', async () => {
    const { app } = createTestApp('student', inactiveCourseStudentId);

    const response = await request(app)
      .get('/api/student/courses')
      .set('Cookie', authCookie())
      .expect(200);

    expect(
      StudentCourseListResponseSchema.parse(response.body).data,
    ).toHaveLength(0);
  });

  it.each(['admin', 'professor'] as const)(
    'rejects the student list route for a %s',
    async (role) => {
      const { app } = createTestApp(role, adminId);

      await request(app)
        .get('/api/student/courses')
        .set('Cookie', authCookie())
        .expect(403);
    },
  );

  it('returns course detail with instructors and the visible document count only', async () => {
    const { app } = createTestApp('student', activeStudentId);

    const response = await request(app)
      .get(`/api/student/courses/${courseId}`)
      .set('Cookie', authCookie())
      .expect(200);

    const body = StudentCourseDetailResponseSchema.parse(response.body);
    expect(body.data.counts.documentCount).toBe(1);
    expect(body.data.instructors).toHaveLength(1);
    expect(body.data.instructors[0]?.role).toBe('owner');
  });

  it('denies course detail access without an active enrollment and audits it', async () => {
    const { app, auditLogger } = createTestApp(
      'student',
      inactiveEnrollmentStudentId,
    );

    await request(app)
      .get(`/api/student/courses/${courseId}`)
      .set('Cookie', authCookie())
      .expect(403);

    expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.denied',
        actorId: inactiveEnrollmentStudentId,
        metadata: expect.objectContaining({ reason: 'no_active_enrollment' }),
      }),
    );
  });

  it('denies course detail access for an inactive course', async () => {
    const { app } = createTestApp('student', inactiveCourseStudentId);

    await request(app)
      .get(`/api/student/courses/${inactiveCourseId}`)
      .set('Cookie', authCookie())
      .expect(403);
  });

  it('returns 404 for an unknown course id', async () => {
    const { app } = createTestApp('student', activeStudentId);

    await request(app)
      .get(`/api/student/courses/${missingCourseId}`)
      .set('Cookie', authCookie())
      .expect(404);
  });

  it('rejects the student detail route for a professor', async () => {
    const { app } = createTestApp('professor', professorId);

    await request(app)
      .get(`/api/student/courses/${courseId}`)
      .set('Cookie', authCookie())
      .expect(403);
  });
});
