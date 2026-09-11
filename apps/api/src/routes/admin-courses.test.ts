import type { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  CourseDetailResponseSchema,
  CourseListResponseSchema,
  CourseMutationResponseSchema,
} from '@web-app/contracts';

import { createApp } from '../app.js';
import type { AuditLogger } from '../auth/audit-log.js';
import type { SessionService } from '../auth/session.js';
import { env } from '../config/env.js';

const courseId = '11111111-1111-4111-8111-111111111111';
const instructorId = '22222222-2222-4222-8222-222222222222';
const studentId = '33333333-3333-4333-8333-333333333333';
const documentId = '44444444-4444-4444-8444-444444444444';
const now = new Date('2026-09-11T12:00:00.000Z');

const listCourse = {
  id: courseId,
  code: 'CS101',
  title: 'Data Structures',
  description: 'Core course',
  semester: 3,
  ectsCredits: 6,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  _count: {
    documents: 1,
    enrollments: 1,
    instructors: 1,
  },
  instructors: [
    {
      instructor: {
        id: instructorId,
        fullName: 'Ada Lovelace',
      },
    },
  ],
};

const detailCourse = {
  ...listCourse,
  instructors: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      createdAt: now,
      instructorRole: 'owner',
      instructor: {
        id: instructorId,
        email: 'ada@example.edu',
        fullName: 'Ada Lovelace',
      },
    },
  ],
  enrollments: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      createdAt: now,
      updatedAt: now,
      status: 'active',
      student: {
        id: studentId,
        email: 'student@example.edu',
        fullName: 'Example Student',
      },
    },
  ],
  documents: [
    {
      id: documentId,
      title: 'Syllabus',
      description: null,
      status: 'active',
      visibility: 'visible_to_students',
      originalFilename: 'syllabus.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1234n,
      pageCount: 8,
      createdAt: now,
      updatedAt: now,
    },
  ],
};

function courseWriteError(code: string): Error & {
  code: string;
  meta: { target: string[] };
} {
  return Object.assign(new Error('Course write failed'), {
    code,
    meta: { target: ['code'] },
  });
}

function createTestApp(
  role: UserRole | null = 'admin',
  options: { duplicateOnCreate?: boolean; duplicateOnUpdate?: boolean } = {},
) {
  const auditLogger: AuditLogger = {
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
  };
  const course = {
    count: vi.fn(async (args?: { where?: unknown }) => {
      const where = args?.where as
        | { instructors?: { none?: object }; isActive?: boolean }
        | undefined;

      if (where?.instructors?.none) return 1;
      if (where?.isActive === true) return 2;
      if (where && Object.keys(where).length > 0) return 1;
      return 3;
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (options.duplicateOnCreate) throw courseWriteError('P2002');

      return {
        ...detailCourse,
        ...data,
        id: '88888888-8888-4888-8888-888888888888',
        _count: {
          documents: 0,
          enrollments: 0,
          instructors: 0,
        },
        documents: [],
        enrollments: [],
        instructors: [],
      };
    }),
    findMany: vi.fn(async () => [listCourse]),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === courseId ? detailCourse : null,
    ),
    update: vi.fn(
      async ({
        data,
        where,
      }: {
        data: Record<string, unknown>;
        where: { id: string };
      }) => {
        if (options.duplicateOnUpdate) throw courseWriteError('P2002');
        if (where.id !== courseId) throw courseWriteError('P2025');

        return {
          ...detailCourse,
          ...data,
        };
      },
    ),
  };

  const sessionService: SessionService = {
    createSession: vi.fn(),
    getSession: vi.fn(async (token) =>
      role && token
        ? {
            id: 'test-session',
            expiresAt: new Date(now.getTime() + 60_000),
            user: {
              id: '77777777-7777-4777-8777-777777777777',
              email: `${role}@example.edu`,
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
    coursesPrisma: { course } as unknown as Pick<PrismaClient, 'course'>,
    sessionService,
  });

  return { app, auditLogger, course };
}

function authCookie(): string {
  return `${env.SESSION_COOKIE_NAME}=test-token`;
}

describe('admin course routes', () => {
  it('lists courses with pagination metadata and summary counts', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .get('/api/admin/courses')
      .set('Cookie', authCookie())
      .expect(200);

    const body = CourseListResponseSchema.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: courseId,
      code: 'CS101',
      counts: {
        documentCount: 1,
        instructorCount: 1,
        studentCount: 1,
      },
      primaryInstructor: {
        id: instructorId,
        fullName: 'Ada Lovelace',
      },
    });
    expect(body.meta).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 3,
      totalPages: 1,
    });
    expect(body.summary).toEqual({
      totalCourses: 3,
      activeCourses: 2,
      unassignedCourses: 1,
    });
  });

  it('applies list pagination, search, semester and status filters', async () => {
    const { app, course } = createTestApp();

    await request(app)
      .get(
        '/api/admin/courses?page=2&pageSize=5&search=data&semester=3&status=active',
      )
      .set('Cookie', authCookie())
      .expect(200);

    expect(course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: {
          AND: [
            { isActive: true },
            { semester: 3 },
            {
              OR: [
                { code: { contains: 'data', mode: 'insensitive' } },
                { title: { contains: 'data', mode: 'insensitive' } },
                { description: { contains: 'data', mode: 'insensitive' } },
              ],
            },
          ],
        },
      }),
    );
  });

  it('returns a course detail response with read-only relations', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .get(`/api/admin/courses/${courseId}`)
      .set('Cookie', authCookie())
      .expect(200);

    const body = CourseDetailResponseSchema.parse(response.body);
    expect(body.data).toMatchObject({
      id: courseId,
      instructors: [{ userId: instructorId, email: 'ada@example.edu' }],
      enrollments: [{ studentId, email: 'student@example.edu' }],
      documents: [{ id: documentId, title: 'Syllabus' }],
    });
  });

  it('creates a course and writes a course.created audit event', async () => {
    const { app, auditLogger, course } = createTestApp();

    const response = await request(app)
      .post('/api/admin/courses')
      .set('Cookie', authCookie())
      .send({
        code: 'CS201',
        title: 'Algorithms',
        description: 'Algorithm design',
        semester: 4,
        ectsCredits: 6,
      })
      .expect(201);

    const body = CourseMutationResponseSchema.parse(response.body);
    expect(body.data).toMatchObject({
      code: 'CS201',
      title: 'Algorithms',
      description: 'Algorithm design',
    });
    expect(course.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'CS201',
          description: 'Algorithm design',
        }),
      }),
    );
    expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'course.created',
        entityId: body.data.id,
        entityType: 'course',
      }),
    );
  });

  it('updates a course and writes a course.updated audit event', async () => {
    const { app, auditLogger, course } = createTestApp();

    const response = await request(app)
      .patch(`/api/admin/courses/${courseId}`)
      .set('Cookie', authCookie())
      .send({ title: 'Advanced Data Structures' })
      .expect(200);

    const body = CourseMutationResponseSchema.parse(response.body);
    expect(body.data.title).toBe('Advanced Data Structures');
    expect(course.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { title: 'Advanced Data Structures' },
        where: { id: courseId },
      }),
    );
    expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'course.updated',
        entityId: courseId,
      }),
    );
  });

  it('deactivates a course with isActive=false and writes a course.deactivated audit event', async () => {
    const { app, auditLogger } = createTestApp();

    const response = await request(app)
      .patch(`/api/admin/courses/${courseId}`)
      .set('Cookie', authCookie())
      .send({ isActive: false })
      .expect(200);

    const body = CourseMutationResponseSchema.parse(response.body);
    expect(body.data.isActive).toBe(false);
    expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'course.deactivated',
        entityId: courseId,
      }),
    );
  });

  it('rejects anonymous and non-admin users', async () => {
    await request(createTestApp(null).app)
      .get('/api/admin/courses')
      .expect(401);

    await request(createTestApp('professor').app)
      .get('/api/admin/courses')
      .set('Cookie', authCookie())
      .expect(403);
  });

  it('returns validation errors for invalid query and params', async () => {
    const { app } = createTestApp();

    await request(app)
      .get('/api/admin/courses?pageSize=101')
      .set('Cookie', authCookie())
      .expect(400);

    await request(app)
      .get('/api/admin/courses/not-a-uuid')
      .set('Cookie', authCookie())
      .expect(400);
  });

  it('returns validation errors for invalid create and empty update bodies', async () => {
    const { app } = createTestApp();

    await request(app)
      .post('/api/admin/courses')
      .set('Cookie', authCookie())
      .send({ code: 'bad code', title: '', semester: 0, ectsCredits: 0 })
      .expect(400);

    await request(app)
      .patch(`/api/admin/courses/${courseId}`)
      .set('Cookie', authCookie())
      .send({})
      .expect(400);
  });

  it('returns 409 for duplicate course codes on create and update', async () => {
    await request(createTestApp('admin', { duplicateOnCreate: true }).app)
      .post('/api/admin/courses')
      .set('Cookie', authCookie())
      .send({
        code: 'CS101',
        title: 'Duplicate Course',
        semester: 3,
        ectsCredits: 6,
      })
      .expect(409);

    await request(createTestApp('admin', { duplicateOnUpdate: true }).app)
      .patch(`/api/admin/courses/${courseId}`)
      .set('Cookie', authCookie())
      .send({ code: 'CS101' })
      .expect(409);
  });

  it('returns 404 when a course does not exist', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .get('/api/admin/courses/99999999-9999-4999-8999-999999999999')
      .set('Cookie', authCookie())
      .expect(404);

    expect(response.body.error.code).toBe('COURSE_NOT_FOUND');
  });
});
