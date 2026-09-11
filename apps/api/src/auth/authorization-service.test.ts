import type {
  Course,
  CourseInstructorRole,
  Document,
  DocumentStatus,
  DocumentVisibility,
  EnrollmentStatus,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { createAuthorizationService } from './authorization-service.js';
import type { CurrentSessionUser } from './session.js';

const courseId = '11111111-1111-4111-8111-111111111111';
const documentId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const otherCourseId = '44444444-4444-4444-8444-444444444444';
const date = new Date('2026-09-07T12:00:00Z');

function fixture(
  options: {
    activeCourse?: boolean;
    assigned?: boolean;
    instructorRole?: CourseInstructorRole;
    enrollment?: EnrollmentStatus | null;
    status?: DocumentStatus;
    visibility?: DocumentVisibility;
    documentCourseId?: string;
  } = {},
) {
  const course: Course = {
    id: courseId,
    code: 'TEST',
    title: 'Test course',
    description: null,
    isActive: options.activeCourse ?? true,
    createdAt: date,
    updatedAt: date,
  };
  const document: Document = {
    id: documentId,
    courseId: options.documentCourseId ?? courseId,
    title: 'Test document',
    description: null,
    status: options.status ?? 'active',
    visibility: options.visibility ?? 'visible_to_students',
    objectKey: 'protected.pdf',
    originalFilename: 'test.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 100n,
    checksumSha256: null,
    pageCount: 1,
    replacedAt: null,
    deletedAt: null,
    createdAt: date,
    updatedAt: date,
    createdById: userId,
    updatedById: null,
  };
  const prisma = {
    course: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === courseId ? course : { ...course, id: otherCourseId },
      ),
    },
    document: { findUnique: vi.fn(async () => document as Document | null) },
    courseInstructor: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            courseId_instructorId: { courseId: string; instructorId: string };
          };
        }) =>
          options.assigned !== false &&
          where.courseId_instructorId.courseId === courseId &&
          where.courseId_instructorId.instructorId === userId
            ? { instructorRole: options.instructorRole ?? 'owner' }
            : null,
      ),
    },
    enrollment: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            courseId_studentId: { courseId: string; studentId: string };
          };
        }) =>
          options.enrollment !== null &&
          where.courseId_studentId.courseId === courseId &&
          where.courseId_studentId.studentId === userId
            ? { status: options.enrollment ?? 'active' }
            : null,
      ),
    },
  };
  const auditLogger = { logAuditEvent: vi.fn().mockResolvedValue(undefined) };
  const service = createAuthorizationService({
    prisma: prisma as unknown as Pick<
      PrismaClient,
      'course' | 'courseInstructor' | 'enrollment' | 'document'
    >,
    auditLogger,
  });
  const user = (role: UserRole): CurrentSessionUser => ({
    id: userId,
    email: 'test@example.edu',
    fullName: 'Test User',
    role,
    isActive: true,
  });
  return { service, prisma, auditLogger, user, course, document };
}

const roles: UserRole[] = ['admin', 'professor', 'student'];

describe('authorization service access matrix', () => {
  for (const role of roles) {
    for (const activeCourse of [true, false]) {
      it(`${role} access to ${activeCourse ? 'active' : 'inactive'} course`, async () => {
        const f = fixture({ activeCourse });
        const result = f.service.assertCourseAccess(f.user(role), courseId);
        if (role === 'student' && !activeCourse) {
          await expect(result).rejects.toMatchObject({
            statusCode: 403,
            code: 'FORBIDDEN',
          });
        } else {
          await expect(result).resolves.toEqual(f.course);
          expect(f.auditLogger.logAuditEvent).not.toHaveBeenCalled();
        }
      });
      for (const status of ['active', 'deleted', 'replaced'] as const) {
        for (const visibility of [
          'visible_to_students',
          'hidden_from_students',
        ] as const) {
          it(`${role}: course active=${activeCourse}, document ${status}/${visibility}`, async () => {
            const f = fixture({ activeCourse, status, visibility });
            const allowed =
              status === 'active' &&
              (role !== 'student' ||
                (activeCourse && visibility === 'visible_to_students'));
            const result = f.service.assertDocumentAccess(
              f.user(role),
              documentId,
            );
            if (allowed) {
              await expect(result).resolves.toEqual(f.document);
              expect(f.auditLogger.logAuditEvent).not.toHaveBeenCalled();
            } else {
              await expect(result).rejects.toMatchObject({
                statusCode: 403,
                code: 'FORBIDDEN',
                message: 'Access denied',
              });
              expect(
                f.auditLogger.logAuditEvent,
              ).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                  action: 'auth.denied',
                  actorId: userId,
                  entityType: 'document',
                  entityId: documentId,
                }),
              );
            }
          });
        }
      }
    }
  }
});

describe('membership and strict role assertions', () => {
  it.each(['owner', 'assistant'] as const)(
    'accepts %s professor assignment on inactive courses',
    async (instructorRole) => {
      const f = fixture({ instructorRole, activeCourse: false });
      await expect(
        f.service.assertProfessorCourseAccess(f.user('professor'), courseId),
      ).resolves.toEqual(f.course);
    },
  );

  it('accepts an active student enrollment', async () => {
    const f = fixture();
    await expect(
      f.service.assertStudentCourseAccess(f.user('student'), courseId),
    ).resolves.toEqual(f.course);
  });

  it.each([null, 'inactive', 'completed'] as const)(
    'rejects student enrollment %s',
    async (enrollment) => {
      const f = fixture({ enrollment });
      await expect(
        f.service.assertStudentCourseAccess(f.user('student'), courseId),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        f.service.assertDocumentAccess(f.user('student'), documentId),
      ).rejects.toMatchObject({ statusCode: 403 });
    },
  );

  it('rejects professors without assignment for course and document', async () => {
    const f = fixture({ assigned: false });
    await expect(
      f.service.assertProfessorCourseAccess(f.user('professor'), courseId),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      f.service.assertDocumentAccess(f.user('professor'), documentId),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it.each(roles)('does not authorize inactive %s users', async (role) => {
    const f = fixture();
    await expect(
      f.service.assertCourseAccess(
        { ...f.user(role), isActive: false },
        courseId,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it.each(['admin', 'student'] as const)(
    'professor-only helper rejects %s',
    async (role) => {
      const f = fixture();
      await expect(
        f.service.assertProfessorCourseAccess(f.user(role), courseId),
      ).rejects.toMatchObject({ statusCode: 403 });
    },
  );

  it.each(['admin', 'professor'] as const)(
    'student-only helper rejects %s',
    async (role) => {
      const f = fixture();
      await expect(
        f.service.assertStudentCourseAccess(f.user(role), courseId),
      ).rejects.toMatchObject({ statusCode: 403 });
    },
  );

  it.each(['professor', 'student'] as const)(
    'uses the document stored courseId for %s',
    async (role) => {
      const f = fixture({ documentCourseId: otherCourseId });
      await expect(
        f.service.assertDocumentAccess(f.user(role), documentId),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(f.prisma.course.findUnique).toHaveBeenCalledWith({
        where: { id: otherCourseId },
      });
    },
  );

  it.each(['professor', 'student'] as const)(
    'checks membership for the actual %s user',
    async (role) => {
      const f = fixture();
      await expect(
        f.service.assertCourseAccess(
          { ...f.user(role), id: otherCourseId },
          courseId,
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
    },
  );
});

describe('authorization errors and audit', () => {
  it.each([
    'assertCourseAccess',
    'assertProfessorCourseAccess',
    'assertStudentCourseAccess',
    'assertDocumentAccess',
  ] as const)('%s validates IDs before querying', async (method) => {
    const f = fixture();
    await expect(
      f.service[method](f.user('admin'), 'invalid'),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'REQUEST_VALIDATION_ERROR',
    });
    for (const delegate of Object.values(f.prisma))
      expect(delegate.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 for missing course and document', async () => {
    const f = fixture();
    f.prisma.course.findUnique.mockResolvedValue(null as unknown as Course);
    f.prisma.document.findUnique.mockResolvedValue(null);
    await expect(
      f.service.assertCourseAccess(f.user('admin'), courseId),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    await expect(
      f.service.assertDocumentAccess(f.user('admin'), documentId),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('logs only safe context and a specific internal reason', async () => {
    const f = fixture({ visibility: 'hidden_from_students' });
    const context = {
      method: 'GET',
      route: '/documents/:id?token=secret#secret',
      cookie: 'secret',
    };
    await expect(
      f.service.assertDocumentAccess(f.user('student'), documentId, context),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(f.auditLogger.logAuditEvent).toHaveBeenCalledExactlyOnceWith({
      action: 'auth.denied',
      actorId: userId,
      entityType: 'document',
      entityId: documentId,
      metadata: {
        reason: 'document_hidden',
        method: 'GET',
        route: '/documents/:id',
      },
    });
  });

  it('preserves denial if the injected audit logger rejects', async () => {
    const f = fixture({ assigned: false });
    f.auditLogger.logAuditEvent.mockRejectedValue(
      new Error('audit unavailable'),
    );
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(
        f.service.assertCourseAccess(f.user('professor'), courseId),
      ).rejects.toMatchObject({ statusCode: 403 });
    } finally {
      errorLog.mockRestore();
    }
  });

  it.each(['course', 'courseInstructor', 'enrollment', 'document'] as const)(
    'propagates %s database failures instead of granting access',
    async (delegate) => {
      const f = fixture();
      const error = new Error('database unavailable');
      f.prisma[delegate].findUnique.mockRejectedValue(error);
      const role = delegate === 'courseInstructor' ? 'professor' : 'student';
      const result =
        delegate === 'document'
          ? f.service.assertDocumentAccess(f.user(role), documentId)
          : f.service.assertCourseAccess(f.user(role), courseId);
      await expect(result).rejects.toBe(error);
      expect(f.auditLogger.logAuditEvent).not.toHaveBeenCalled();
    },
  );
});
