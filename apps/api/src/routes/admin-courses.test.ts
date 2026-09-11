import type { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  CourseDetailResponseSchema,
  CourseInstructorsResponseSchema,
  CourseListResponseSchema,
  CourseMutationResponseSchema,
} from '@web-app/contracts';

import { createApp } from '../app.js';
import type { AuditLogger } from '../auth/audit-log.js';
import type { SessionService } from '../auth/session.js';
import { env } from '../config/env.js';

const courseId = '11111111-1111-4111-8111-111111111111';
const instructorId = '22222222-2222-4222-8222-222222222222';
const secondInstructorId = '99999999-9999-4999-8999-999999999991';
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
  options: {
    duplicateAssignment?: boolean;
    duplicateAssignmentOnCreate?: boolean;
    duplicateOnCreate?: boolean;
    duplicateOnUpdate?: boolean;
    professorActive?: boolean;
    professorExists?: boolean;
    professorRole?: UserRole;
  } = {},
) {
  const auditLogger: AuditLogger = {
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
  };
  const instructorAssignments = [...detailCourse.instructors];
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
  const courseInstructor = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          courseId: string;
          instructorId: string;
          instructorRole: 'owner' | 'assistant';
        };
      }) => {
        if (options.duplicateAssignmentOnCreate) {
          throw courseWriteError('P2002');
        }

        const assignment = {
          id: '99999999-9999-4999-8999-999999999992',
          createdAt: now,
          instructorRole: data.instructorRole,
          instructor: {
            id: data.instructorId,
            email: 'grace@example.edu',
            fullName: 'Grace Hopper',
          },
        };
        instructorAssignments.push(assignment);
        return assignment;
      },
    ),
    delete: vi.fn(
      async ({
        where,
      }: {
        where: {
          courseId_instructorId: { courseId: string; instructorId: string };
        };
      }) => {
        const assignmentIndex = instructorAssignments.findIndex(
          (assignment) =>
            where.courseId_instructorId.courseId === courseId &&
            assignment.instructor.id ===
              where.courseId_instructorId.instructorId,
        );

        if (assignmentIndex === -1) throw courseWriteError('P2025');

        const [assignment] = instructorAssignments.splice(assignmentIndex, 1);
        return assignment;
      },
    ),
    findMany: vi.fn(async () => instructorAssignments),
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          courseId_instructorId: { courseId: string; instructorId: string };
        };
      }) => {
        if (options.duplicateAssignment) return detailCourse.instructors[0];

        return (
          instructorAssignments.find(
            (assignment) =>
              where.courseId_instructorId.courseId === courseId &&
              assignment.instructor.id ===
                where.courseId_instructorId.instructorId,
          ) ?? null
        );
      },
    ),
  };
  const user = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      options.professorExists === false
        ? null
        : {
            id: where.id,
            isActive: options.professorActive ?? true,
            role: options.professorRole ?? 'professor',
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
    coursesPrisma: { course, courseInstructor, user } as unknown as Pick<
      PrismaClient,
      'course' | 'courseInstructor' | 'user'
    >,
    sessionService,
  });

  return { app, auditLogger, course, courseInstructor, user };
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

  it('lists assigned course instructors for admins', async () => {
    const { app, courseInstructor } = createTestApp();

    const response = await request(app)
      .get(`/api/admin/courses/${courseId}/instructors`)
      .set('Cookie', authCookie())
      .expect(200);

    const body = CourseInstructorsResponseSchema.parse(response.body);
    expect(body.data).toEqual([
      {
        id: '55555555-5555-4555-8555-555555555555',
        userId: instructorId,
        fullName: 'Ada Lovelace',
        email: 'ada@example.edu',
        role: 'owner',
        assignedAt: now.toISOString(),
      },
    ]);
    expect(courseInstructor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'asc' },
        where: { courseId },
      }),
    );
  });

  it('assigns an active professor to a course', async () => {
    const { app, courseInstructor, user } = createTestApp();

    const response = await request(app)
      .post(`/api/admin/courses/${courseId}/instructors`)
      .set('Cookie', authCookie())
      .send({ instructorId: secondInstructorId, role: 'assistant' })
      .expect(201);

    const body = CourseInstructorsResponseSchema.parse(response.body);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: secondInstructorId,
          fullName: 'Grace Hopper',
          email: 'grace@example.edu',
          role: 'assistant',
        }),
      ]),
    );
    expect(user.findUnique).toHaveBeenCalledWith({
      select: { id: true, isActive: true, role: true },
      where: { id: secondInstructorId },
    });
    expect(courseInstructor.create).toHaveBeenCalledWith({
      data: {
        courseId,
        instructorId: secondInstructorId,
        instructorRole: 'assistant',
      },
    });
  });

  it('removes an assigned professor from a course', async () => {
    const { app, courseInstructor } = createTestApp();

    const response = await request(app)
      .delete(`/api/admin/courses/${courseId}/instructors/${instructorId}`)
      .set('Cookie', authCookie())
      .expect(200);

    const body = CourseInstructorsResponseSchema.parse(response.body);
    expect(body.data).toEqual([]);
    expect(courseInstructor.delete).toHaveBeenCalledWith({
      where: {
        courseId_instructorId: {
          courseId,
          instructorId,
        },
      },
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

    await request(createTestApp(null).app)
      .post(`/api/admin/courses/${courseId}/instructors`)
      .send({ instructorId: secondInstructorId })
      .expect(401);

    await request(createTestApp('professor').app)
      .post(`/api/admin/courses/${courseId}/instructors`)
      .set('Cookie', authCookie())
      .send({ instructorId: secondInstructorId })
      .expect(403);

    await request(createTestApp(null).app)
      .delete(`/api/admin/courses/${courseId}/instructors/${instructorId}`)
      .expect(401);

    await request(createTestApp('professor').app)
      .delete(`/api/admin/courses/${courseId}/instructors/${instructorId}`)
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

    await request(app)
      .get('/api/admin/courses/not-a-uuid/instructors')
      .set('Cookie', authCookie())
      .expect(400);

    await request(app)
      .post('/api/admin/courses/not-a-uuid/instructors')
      .set('Cookie', authCookie())
      .send({ instructorId: secondInstructorId })
      .expect(400);

    await request(app)
      .delete(`/api/admin/courses/not-a-uuid/instructors/${instructorId}`)
      .set('Cookie', authCookie())
      .expect(400);

    await request(app)
      .delete(`/api/admin/courses/${courseId}/instructors/not-a-uuid`)
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

    await request(app)
      .post(`/api/admin/courses/${courseId}/instructors`)
      .set('Cookie', authCookie())
      .send({ instructorId: 'not-a-uuid', role: 'primary' })
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

  it('returns 404 when listing instructors for a missing course', async () => {
    const { app, courseInstructor } = createTestApp();

    const response = await request(app)
      .get('/api/admin/courses/99999999-9999-4999-8999-999999999999/instructors')
      .set('Cookie', authCookie())
      .expect(404);

    expect(response.body.error.code).toBe('COURSE_NOT_FOUND');
    expect(courseInstructor.findMany).not.toHaveBeenCalled();
  });

  it('returns 404 when assigning an instructor to a missing course', async () => {
    const { app, courseInstructor, user } = createTestApp();

    const response = await request(app)
      .post('/api/admin/courses/99999999-9999-4999-8999-999999999999/instructors')
      .set('Cookie', authCookie())
      .send({ instructorId: secondInstructorId })
      .expect(404);

    expect(response.body.error.code).toBe('COURSE_NOT_FOUND');
    expect(user.findUnique).not.toHaveBeenCalled();
    expect(courseInstructor.create).not.toHaveBeenCalled();
  });

  it('returns 404 when removing an instructor from a missing course', async () => {
    const { app, courseInstructor } = createTestApp();

    const response = await request(app)
      .delete(
        `/api/admin/courses/99999999-9999-4999-8999-999999999999/instructors/${instructorId}`,
      )
      .set('Cookie', authCookie())
      .expect(404);

    expect(response.body.error.code).toBe('COURSE_NOT_FOUND');
    expect(courseInstructor.delete).not.toHaveBeenCalled();
  });

  it('rejects missing, inactive and non-professor users for course assignment', async () => {
    const missingResponse = await request(
      createTestApp('admin', { professorExists: false }).app,
    )
      .post(`/api/admin/courses/${courseId}/instructors`)
      .set('Cookie', authCookie())
      .send({ instructorId: secondInstructorId })
      .expect(404);

    expect(missingResponse.body.error.code).toBe('PROFESSOR_NOT_FOUND');

    const inactiveResponse = await request(
      createTestApp('admin', { professorActive: false }).app,
    )
      .post(`/api/admin/courses/${courseId}/instructors`)
      .set('Cookie', authCookie())
      .send({ instructorId: secondInstructorId })
      .expect(409);

    expect(inactiveResponse.body.error.code).toBe('PROFESSOR_INACTIVE');

    const studentResponse = await request(
      createTestApp('admin', { professorRole: 'student' }).app,
    )
      .post(`/api/admin/courses/${courseId}/instructors`)
      .set('Cookie', authCookie())
      .send({ instructorId: secondInstructorId })
      .expect(409);

    expect(studentResponse.body.error.code).toBe('USER_IS_NOT_PROFESSOR');
  });

  it('returns 409 when assigning an already assigned professor', async () => {
    const { app, courseInstructor } = createTestApp('admin', {
      duplicateAssignment: true,
    });

    const response = await request(app)
      .post(`/api/admin/courses/${courseId}/instructors`)
      .set('Cookie', authCookie())
      .send({ instructorId })
      .expect(409);

    expect(response.body.error.code).toBe(
      'COURSE_INSTRUCTOR_ALREADY_ASSIGNED',
    );
    expect(courseInstructor.create).not.toHaveBeenCalled();
  });

  it('returns 404 when removing a missing course instructor assignment', async () => {
    const { app, courseInstructor } = createTestApp();

    const response = await request(app)
      .delete(`/api/admin/courses/${courseId}/instructors/${secondInstructorId}`)
      .set('Cookie', authCookie())
      .expect(404);

    expect(response.body.error.code).toBe(
      'COURSE_INSTRUCTOR_ASSIGNMENT_NOT_FOUND',
    );
    expect(courseInstructor.delete).not.toHaveBeenCalled();
  });
});
