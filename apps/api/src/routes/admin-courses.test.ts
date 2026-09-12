import type { EnrollmentStatus, PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  CourseDetailResponseSchema,
  CourseEnrollmentsResponseSchema,
  CourseInstructorsResponseSchema,
  CourseListResponseSchema,
  CourseMemberCandidatesResponseSchema,
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
const newStudentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const inactiveStudentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
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
    duplicateEnrollmentOnCreate?: boolean;
    duplicateOnCreate?: boolean;
    duplicateOnUpdate?: boolean;
    professorActive?: boolean;
    professorExists?: boolean;
    professorRole?: UserRole;
    studentActive?: boolean;
    studentExists?: boolean;
    studentRole?: UserRole;
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
  const enrollmentRecords = [
    ...detailCourse.enrollments,
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      createdAt: now,
      updatedAt: now,
      status: 'inactive' as EnrollmentStatus,
      student: {
        id: inactiveStudentId,
        email: 'inactive@example.edu',
        fullName: 'Inactive Student',
      },
    },
  ];
  const enrollment = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          courseId: string;
          status: EnrollmentStatus;
          studentId: string;
        };
      }) => {
        if (options.duplicateEnrollmentOnCreate) {
          throw courseWriteError('P2002');
        }

        const record = {
          id: '99999999-9999-4999-8999-999999999993',
          createdAt: now,
          updatedAt: now,
          status: data.status,
          student: {
            id: data.studentId,
            email: 'newstudent@example.edu',
            fullName: 'New Student',
          },
        };
        enrollmentRecords.push(record);
        return { id: record.id, status: record.status };
      },
    ),
    findMany: vi.fn(async () => enrollmentRecords),
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          courseId_studentId: { courseId: string; studentId: string };
        };
      }) =>
        enrollmentRecords.find(
          (record) =>
            where.courseId_studentId.courseId === courseId &&
            record.student.id === where.courseId_studentId.studentId,
        ) ?? null,
    ),
    update: vi.fn(
      async ({
        data,
        where,
      }: {
        data: { status: EnrollmentStatus };
        where: {
          courseId_studentId: { courseId: string; studentId: string };
        };
      }) => {
        const recordIndex = enrollmentRecords.findIndex(
          (record) =>
            where.courseId_studentId.courseId === courseId &&
            record.student.id === where.courseId_studentId.studentId,
        );

        if (recordIndex === -1) throw courseWriteError('P2025');

        enrollmentRecords[recordIndex] = {
          ...enrollmentRecords[recordIndex],
          status: data.status,
          updatedAt: now,
        };

        return {
          id: enrollmentRecords[recordIndex].id,
          status: data.status,
        };
      },
    ),
  };
  const user = {
    findMany: vi.fn(async () => [
      {
        id: secondInstructorId,
        email: 'grace@example.edu',
        fullName: 'Grace Hopper',
        role: 'professor',
      },
    ]),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      if (where.id === instructorId || where.id === secondInstructorId) {
        return options.professorExists === false
          ? null
          : {
              id: where.id,
              isActive: options.professorActive ?? true,
              role: options.professorRole ?? 'professor',
            };
      }

      return options.studentExists === false
        ? null
        : {
            id: where.id,
            isActive: options.studentActive ?? true,
            role: options.studentRole ?? 'student',
          };
    }),
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
    coursesPrisma: {
      course,
      courseInstructor,
      enrollment,
      user,
    } as unknown as Pick<
      PrismaClient,
      'course' | 'courseInstructor' | 'enrollment' | 'user'
    >,
    sessionService,
  });

  return { app, auditLogger, course, courseInstructor, enrollment, user };
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

  it('finds active, unassigned members by role and search text', async () => {
    const { app, user } = createTestApp();

    const response = await request(app)
      .get(`/api/admin/courses/${courseId}/member-candidates?role=professor&search=gr`)
      .set('Cookie', authCookie())
      .expect(200);

    expect(CourseMemberCandidatesResponseSchema.parse(response.body)).toEqual({
      data: [
        {
          id: secondInstructorId,
          email: 'grace@example.edu',
          fullName: 'Grace Hopper',
          role: 'professor',
        },
      ],
    });
    expect(user.findMany).toHaveBeenCalledWith({
      orderBy: { fullName: 'asc' },
      select: { email: true, fullName: true, id: true, role: true },
      take: 20,
      where: {
        instructedCourses: { none: { courseId } },
        isActive: true,
        role: 'professor',
        OR: [
          { fullName: { contains: 'gr', mode: 'insensitive' } },
          { email: { contains: 'gr', mode: 'insensitive' } },
        ],
      },
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
      .get(`/api/admin/courses/${courseId}/member-candidates?role=student&search=st`)
      .expect(401);

    await request(createTestApp('professor').app)
      .get(`/api/admin/courses/${courseId}/member-candidates?role=student&search=st`)
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
      .get(`/api/admin/courses/${courseId}/member-candidates?role=student&search=x`)
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

  it('lists enrolled students for admins', async () => {
    const { app, enrollment } = createTestApp();

    const response = await request(app)
      .get(`/api/admin/courses/${courseId}/enrollments`)
      .set('Cookie', authCookie())
      .expect(200);

    const body = CourseEnrollmentsResponseSchema.parse(response.body);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentId,
          email: 'student@example.edu',
          status: 'active',
        }),
      ]),
    );
    expect(enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'asc' },
        where: { courseId },
      }),
    );
  });

  it('enrolls an active student in a course', async () => {
    const { app, auditLogger, enrollment, user } = createTestApp();

    const response = await request(app)
      .post(`/api/admin/courses/${courseId}/enrollments`)
      .set('Cookie', authCookie())
      .send({ studentId: newStudentId })
      .expect(201);

    const body = CourseEnrollmentsResponseSchema.parse(response.body);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: newStudentId,
          fullName: 'New Student',
          status: 'active',
        }),
      ]),
    );
    expect(user.findUnique).toHaveBeenCalledWith({
      select: { id: true, isActive: true, role: true },
      where: { id: newStudentId },
    });
    expect(enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { courseId, status: 'active', studentId: newStudentId },
      }),
    );
    expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'enrollment.changed',
        entityType: 'enrollment',
        metadata: expect.objectContaining({
          courseId,
          status: 'active',
          studentId: newStudentId,
        }),
      }),
    );
  });

  it('reactivates a previously inactive enrollment instead of creating a duplicate', async () => {
    const { app, enrollment } = createTestApp();

    const response = await request(app)
      .post(`/api/admin/courses/${courseId}/enrollments`)
      .set('Cookie', authCookie())
      .send({ studentId: inactiveStudentId, status: 'active' })
      .expect(200);

    const body = CourseEnrollmentsResponseSchema.parse(response.body);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: inactiveStudentId,
          status: 'active',
        }),
      ]),
    );
    expect(enrollment.create).not.toHaveBeenCalled();
    expect(enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'active' },
        where: {
          courseId_studentId: { courseId, studentId: inactiveStudentId },
        },
      }),
    );
  });

  it('rejects enrolling a student who already has an active enrollment', async () => {
    const { app, enrollment } = createTestApp();

    const response = await request(app)
      .post(`/api/admin/courses/${courseId}/enrollments`)
      .set('Cookie', authCookie())
      .send({ studentId })
      .expect(409);

    expect(response.body.error.code).toBe('STUDENT_ALREADY_ENROLLED');
    expect(enrollment.create).not.toHaveBeenCalled();
    expect(enrollment.update).not.toHaveBeenCalled();
  });

  it('rejects missing, inactive and non-student users for enrollment', async () => {
    const missingResponse = await request(
      createTestApp('admin', { studentExists: false }).app,
    )
      .post(`/api/admin/courses/${courseId}/enrollments`)
      .set('Cookie', authCookie())
      .send({ studentId: newStudentId })
      .expect(404);

    expect(missingResponse.body.error.code).toBe('STUDENT_NOT_FOUND');

    const inactiveResponse = await request(
      createTestApp('admin', { studentActive: false }).app,
    )
      .post(`/api/admin/courses/${courseId}/enrollments`)
      .set('Cookie', authCookie())
      .send({ studentId: newStudentId })
      .expect(409);

    expect(inactiveResponse.body.error.code).toBe('STUDENT_INACTIVE');

    const professorResponse = await request(
      createTestApp('admin', { studentRole: 'professor' }).app,
    )
      .post(`/api/admin/courses/${courseId}/enrollments`)
      .set('Cookie', authCookie())
      .send({ studentId: newStudentId })
      .expect(409);

    expect(professorResponse.body.error.code).toBe('USER_IS_NOT_STUDENT');
  });

  it('updates an enrollment status and writes an enrollment.changed audit event', async () => {
    const { app, auditLogger, enrollment } = createTestApp();

    const response = await request(app)
      .patch(`/api/admin/courses/${courseId}/enrollments/${studentId}`)
      .set('Cookie', authCookie())
      .send({ status: 'completed' })
      .expect(200);

    const body = CourseEnrollmentsResponseSchema.parse(response.body);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ studentId, status: 'completed' }),
      ]),
    );
    expect(enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'completed' },
        where: { courseId_studentId: { courseId, studentId } },
      }),
    );
    expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'enrollment.changed',
        metadata: expect.objectContaining({
          previousStatus: 'active',
          status: 'completed',
          studentId,
        }),
      }),
    );
  });

  it('returns 404 when updating a missing enrollment', async () => {
    const { app, enrollment } = createTestApp();

    const response = await request(app)
      .patch(`/api/admin/courses/${courseId}/enrollments/${newStudentId}`)
      .set('Cookie', authCookie())
      .send({ status: 'inactive' })
      .expect(404);

    expect(response.body.error.code).toBe('ENROLLMENT_NOT_FOUND');
    expect(enrollment.update).not.toHaveBeenCalled();
  });

  it('returns 404 for enrollment endpoints on a missing course', async () => {
    const missingCourseId = '99999999-9999-4999-8999-999999999999';

    const listResponse = await request(createTestApp().app)
      .get(`/api/admin/courses/${missingCourseId}/enrollments`)
      .set('Cookie', authCookie())
      .expect(404);
    expect(listResponse.body.error.code).toBe('COURSE_NOT_FOUND');

    const enrollResponse = await request(createTestApp().app)
      .post(`/api/admin/courses/${missingCourseId}/enrollments`)
      .set('Cookie', authCookie())
      .send({ studentId: newStudentId })
      .expect(404);
    expect(enrollResponse.body.error.code).toBe('COURSE_NOT_FOUND');
  });

  it('rejects anonymous and non-admin users for enrollment endpoints', async () => {
    await request(createTestApp(null).app)
      .get(`/api/admin/courses/${courseId}/enrollments`)
      .expect(401);

    await request(createTestApp('professor').app)
      .post(`/api/admin/courses/${courseId}/enrollments`)
      .set('Cookie', authCookie())
      .send({ studentId: newStudentId })
      .expect(403);

    await request(createTestApp('student').app)
      .patch(`/api/admin/courses/${courseId}/enrollments/${studentId}`)
      .set('Cookie', authCookie())
      .send({ status: 'inactive' })
      .expect(403);
  });

  it('returns validation errors for invalid enrollment params and bodies', async () => {
    const { app } = createTestApp();

    await request(app)
      .post(`/api/admin/courses/${courseId}/enrollments`)
      .set('Cookie', authCookie())
      .send({ studentId: 'not-a-uuid' })
      .expect(400);

    await request(app)
      .patch(`/api/admin/courses/${courseId}/enrollments/${studentId}`)
      .set('Cookie', authCookie())
      .send({ status: 'graduated' })
      .expect(400);

    await request(app)
      .patch(`/api/admin/courses/not-a-uuid/enrollments/${studentId}`)
      .set('Cookie', authCookie())
      .send({ status: 'inactive' })
      .expect(400);
  });
});
