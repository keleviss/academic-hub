import type { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  CourseDocumentResponseSchema,
  CourseDocumentsResponseSchema,
} from '@web-app/contracts';

import { createApp } from '../app.js';
import type { AuditLogger } from '../auth/audit-log.js';
import type { SessionService } from '../auth/session.js';
import { env } from '../config/env.js';

const courseId = '11111111-1111-4111-8111-111111111111';
const missingCourseId = '99999999-9999-4999-8999-999999999999';
const documentId = '44444444-4444-4444-8444-444444444444';
const secondDocumentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const visibleDocumentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const deletedDocumentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const professorId = '22222222-2222-4222-8222-222222222222';
const adminId = '77777777-7777-4777-8777-777777777777';
const studentId = '33333333-3333-4333-8333-333333333333';
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

const documentRecord = {
  id: documentId,
  title: 'Syllabus',
  description: null,
  status: 'active',
  visibility: 'hidden_from_students',
  originalFilename: 'syllabus.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: 1234n,
  pageCount: 8,
  createdAt: now,
  updatedAt: now,
};

function createTestApp(
  role: UserRole | null = 'professor',
  options: {
    activeEnrollment?: boolean;
    assignedProfessor?: boolean;
    visibilityFixtures?: boolean;
  } = {},
) {
  const auditLogger: AuditLogger = {
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
  };
  const documents = options.visibilityFixtures
    ? [
        { ...documentRecord },
        {
          ...documentRecord,
          id: visibleDocumentId,
          title: 'Visible handout',
          visibility: 'visible_to_students',
        },
        {
          ...documentRecord,
          id: deletedDocumentId,
          status: 'deleted',
          title: 'Deleted handout',
          visibility: 'visible_to_students',
        },
      ]
    : [{ ...documentRecord }];
  const courseDelegate = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === courseId ? course : null,
    ),
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
        options.assignedProfessor === false ||
        where.courseId_instructorId.courseId !== courseId ||
        where.courseId_instructorId.instructorId !== professorId
          ? null
          : { id: '55555555-5555-4555-8555-555555555555' },
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
        options.activeEnrollment === false ||
        where.courseId_studentId.courseId !== courseId ||
        where.courseId_studentId.studentId !== studentId
          ? null
          : { id: '66666666-6666-4666-8666-666666666666', status: 'active' },
    ),
  };
  const document = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          courseId: string;
          createdById: string;
          description: string | null;
          fileSizeBytes: bigint | null;
          mimeType: string | null;
          originalFilename: string | null;
          pageCount: number | null;
          title: string;
          updatedById: string;
          visibility: 'hidden_from_students' | 'visible_to_students';
        };
      }) => {
        const record = {
          id: secondDocumentId,
          title: data.title,
          description: data.description,
          status: 'active',
          visibility: data.visibility,
          originalFilename: data.originalFilename,
          mimeType: data.mimeType,
          fileSizeBytes: data.fileSizeBytes,
          pageCount: data.pageCount,
          createdAt: now,
          updatedAt: now,
        };
        documents.push(record);
        return record;
      },
    ),
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: {
          courseId: string;
          id: string;
          status?: 'active' | 'deleted' | 'replaced';
          visibility?: 'hidden_from_students' | 'visible_to_students';
        };
      }) =>
        where.courseId === courseId
          ? documents.find((record) => documentMatchesWhere(record, where)) ??
            null
          : null,
    ),
    findMany: vi.fn(
      async ({
        where,
      }: {
        where: {
          courseId: string;
          status?: 'active' | 'deleted' | 'replaced';
          visibility?: 'hidden_from_students' | 'visible_to_students';
        };
      }) =>
        where.courseId === courseId
          ? documents.filter((record) => documentMatchesWhere(record, where))
          : [],
    ),
    update: vi.fn(
      async ({
        data,
        where,
      }: {
        data: {
          description?: string | null;
          pageCount?: number | null;
          status?: 'active' | 'deleted' | 'replaced';
          title?: string;
          updatedById: string;
          visibility?: 'hidden_from_students' | 'visible_to_students';
        };
        where: { id: string };
      }) => {
        const recordIndex = documents.findIndex(
          (record) => record.id === where.id,
        );
        const next = {
          ...documents[recordIndex],
          ...data,
          updatedAt: now,
        };
        documents[recordIndex] = next;
        return next;
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
              id:
                role === 'professor'
                  ? professorId
                  : role === 'student'
                    ? studentId
                    : adminId,
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
    courseDocumentsPrisma: {
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

  return { app, courseDelegate, courseInstructor, document };
}

function documentMatchesWhere(
  record: typeof documentRecord,
  where: {
    id?: string;
    status?: 'active' | 'deleted' | 'replaced';
    visibility?: 'hidden_from_students' | 'visible_to_students';
  },
): boolean {
  return (
    (where.id === undefined || record.id === where.id) &&
    (where.status === undefined || record.status === where.status) &&
    (where.visibility === undefined || record.visibility === where.visibility)
  );
}

function authCookie(): string {
  return `${env.SESSION_COOKIE_NAME}=test-token`;
}

describe('course document routes', () => {
  it('lists course documents for an assigned professor', async () => {
    const { app, courseInstructor, document } = createTestApp('professor');

    const response = await request(app)
      .get(`/api/courses/${courseId}/documents`)
      .set('Cookie', authCookie())
      .expect(200);

    const body = CourseDocumentsResponseSchema.parse(response.body);
    expect(body.data).toEqual([
      expect.objectContaining({
        id: documentId,
        title: 'Syllabus',
        visibility: 'hidden_from_students',
      }),
    ]);
    expect(courseInstructor.findUnique).toHaveBeenCalled();
    expect(document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'asc' },
        where: { courseId },
      }),
    );
  });

  it('creates hidden document metadata by default', async () => {
    const { app, document } = createTestApp('admin');

    const response = await request(app)
      .post(`/api/courses/${courseId}/documents`)
      .set('Cookie', authCookie())
      .send({
        title: 'Lecture 1',
        originalFilename: 'lecture-1.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 2048,
        pageCount: 12,
      })
      .expect(201);

    const body = CourseDocumentResponseSchema.parse(response.body);
    expect(body.data).toMatchObject({
      id: secondDocumentId,
      title: 'Lecture 1',
      visibility: 'hidden_from_students',
      fileSizeBytes: 2048,
    });
    expect(document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courseId,
          createdById: adminId,
          fileSizeBytes: 2048n,
          title: 'Lecture 1',
          visibility: 'hidden_from_students',
        }),
      }),
    );
  });

  it('updates document metadata for an assigned professor', async () => {
    const { app, document } = createTestApp('professor');

    const response = await request(app)
      .patch(`/api/courses/${courseId}/documents/${documentId}`)
      .set('Cookie', authCookie())
      .send({
        description: 'Updated description',
        pageCount: 9,
        visibility: 'visible_to_students',
      })
      .expect(200);

    const body = CourseDocumentResponseSchema.parse(response.body);
    expect(body.data).toMatchObject({
      id: documentId,
      description: 'Updated description',
      pageCount: 9,
      visibility: 'visible_to_students',
    });
    expect(document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { courseId, id: documentId },
      }),
    );
    expect(document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pageCount: 9,
          updatedById: professorId,
          visibility: 'visible_to_students',
        }),
        where: { id: documentId },
      }),
    );
  });

  it('shows students only active documents visible to students', async () => {
    const { app, document } = createTestApp('student', {
      visibilityFixtures: true,
    });

    const response = await request(app)
      .get(`/api/courses/${courseId}/documents`)
      .set('Cookie', authCookie())
      .expect(200);

    const body = CourseDocumentsResponseSchema.parse(response.body);
    expect(body.data).toEqual([
      expect.objectContaining({
        id: visibleDocumentId,
        status: 'active',
        visibility: 'visible_to_students',
      }),
    ]);
    expect(document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          courseId,
          status: 'active',
          visibility: 'visible_to_students',
        },
      }),
    );
  });

  it('hides hidden and deleted document details from students', async () => {
    const { app } = createTestApp('student', {
      visibilityFixtures: true,
    });

    const visibleResponse = await request(app)
      .get(`/api/courses/${courseId}/documents/${visibleDocumentId}`)
      .set('Cookie', authCookie())
      .expect(200);

    expect(CourseDocumentResponseSchema.parse(visibleResponse.body).data.id).toBe(
      visibleDocumentId,
    );

    const hiddenResponse = await request(app)
      .get(`/api/courses/${courseId}/documents/${documentId}`)
      .set('Cookie', authCookie())
      .expect(404);
    expect(hiddenResponse.body.error.code).toBe('DOCUMENT_NOT_FOUND');

    const deletedResponse = await request(app)
      .get(`/api/courses/${courseId}/documents/${deletedDocumentId}`)
      .set('Cookie', authCookie())
      .expect(404);
    expect(deletedResponse.body.error.code).toBe('DOCUMENT_NOT_FOUND');
  });

  it('rejects unassigned professors before reading document rows', async () => {
    const { app, document } = createTestApp('professor', {
      assignedProfessor: false,
    });

    await request(app)
      .get(`/api/courses/${courseId}/documents`)
      .set('Cookie', authCookie())
      .expect(403);

    expect(document.findMany).not.toHaveBeenCalled();
  });

  it('returns validation and not-found errors', async () => {
    const { app } = createTestApp('admin');

    await request(app)
      .post(`/api/courses/${courseId}/documents`)
      .set('Cookie', authCookie())
      .send({})
      .expect(400);

    await request(app)
      .get(`/api/courses/${courseId}/documents/not-a-uuid`)
      .set('Cookie', authCookie())
      .expect(400);

    const missingResponse = await request(app)
      .get(`/api/courses/${courseId}/documents/${secondDocumentId}`)
      .set('Cookie', authCookie())
      .expect(404);

    expect(missingResponse.body.error.code).toBe('DOCUMENT_NOT_FOUND');

    await request(app)
      .get(`/api/courses/${missingCourseId}/documents`)
      .set('Cookie', authCookie())
      .expect(404);
  });
});
