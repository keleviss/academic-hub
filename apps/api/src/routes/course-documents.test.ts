import type { PrismaClient, UserRole } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  CourseDocumentAnnotationResponseSchema,
  CourseDocumentAnnotationsResponseSchema,
  CourseDocumentResponseSchema,
  CourseDocumentsResponseSchema,
} from '@web-app/contracts';

import { createApp } from '../app.js';
import type { AuditLogger } from '../auth/audit-log.js';
import type { SessionService } from '../auth/session.js';
import type { StorageService } from '../storage/storage-service.js';
import { env } from '../config/env.js';

async function buildValidPdfBuffer(): Promise<Buffer> {
  const pdfDocument = await PDFDocument.create();
  pdfDocument.addPage([200, 200]);
  return Buffer.from(await pdfDocument.save());
}

const courseId = '11111111-1111-4111-8111-111111111111';
const missingCourseId = '99999999-9999-4999-8999-999999999999';
const documentId = '44444444-4444-4444-8444-444444444444';
const secondDocumentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const visibleDocumentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const deletedDocumentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const professorId = '22222222-2222-4222-8222-222222222222';
const adminId = '77777777-7777-4777-8777-777777777777';
const studentId = '33333333-3333-4333-8333-333333333333';
const otherStudentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const now = new Date('2026-09-12T09:00:00.000Z');
const documentDiscussionCategoryId = '19191919-1919-4191-8191-191919191919';

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
  checksumSha256: 'abc123',
  courseId,
  id: documentId,
  title: 'Syllabus',
  description: null,
  status: 'active',
  visibility: 'hidden_from_students',
  originalFilename: 'syllabus.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: 1234n,
  pageCount: 8,
  objectKey: `courses/${courseId}/documents/${documentId}.pdf`,
  createdAt: now,
  updatedAt: now,
};

const annotationTargetRecord = {
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  pageNumber: 2,
  selectedText: 'βασική έννοια',
};

const publicAnnotation = {
  id: '88888888-8888-4888-8888-888888888888',
  courseId,
  documentId: visibleDocumentId,
  targetId: annotationTargetRecord.id,
  authorId: studentId,
  type: 'question',
  visibility: 'public',
  body: 'Τι σημαίνει αυτό το σημείο;',
  isDeleted: false,
  createdAt: now,
  updatedAt: now,
  target: annotationTargetRecord,
  author: {
    id: studentId,
    fullName: 'Test User',
    role: 'student',
  },
};

interface ForumPostRecord {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  isVerified: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    fullName: string;
    role: UserRole;
  };
}

interface ForumThreadRecord {
  annotationId: string | null;
  annotation: { body: string | null } | null;
  authorId: string;
  author: {
    id: string;
    fullName: string;
    role: UserRole;
  };
  categoryId: string;
  courseId: string;
  createdAt: Date;
  documentId: string;
  documentTitleSnapshot: string;
  id: string;
  pageNumberSnapshot: number;
  posts: ForumPostRecord[];
  selectedTextSnapshot: string | null;
  status: 'open' | 'instructor_answered' | 'verified' | 'resolved' | 'archived';
  targetId: string;
  title: string;
  updatedAt: Date;
  verifiedPost: ForumPostRecord | null;
  verifiedPostId: string | null;
  visibility: 'private' | 'public' | 'instructor_only';
}

function createTestApp(
  role: UserRole | null = 'professor',
  options: {
    activeEnrollment?: boolean;
    assignedProfessor?: boolean;
    existingThreadForPublicAnnotation?: boolean;
    maxUploadBytes?: number;
    visibilityFixtures?: boolean;
  } = {},
) {
  const auditLogger: AuditLogger = {
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
  };
  const storageService: StorageService = {
    checkBucketReadiness: vi.fn(),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    ensureBucketReady: vi.fn(),
    getObject: vi.fn(async (key: string) => ({
      body: new TextEncoder().encode(`content-of-${key}`),
      contentType: 'application/pdf',
      key,
      metadata: {},
    })),
    headObject: vi.fn(),
    putObject: vi.fn().mockResolvedValue(undefined),
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
  const annotationTargets = [{ ...annotationTargetRecord }];
  const annotations = [
    { ...publicAnnotation },
    {
      ...publicAnnotation,
      id: '12121212-1212-4121-8121-121212121212',
      authorId: studentId,
      visibility: 'private',
      body: 'Προσωπική σημείωση',
      target: {
        ...annotationTargetRecord,
        id: 'abababab-abab-4aba-8aba-abababababab',
        pageNumber: 1,
        selectedText: 'προσωπικό σημείο',
      },
    },
    {
      ...publicAnnotation,
      id: '13131313-1313-4131-8131-131313131313',
      authorId: studentId,
      visibility: 'instructor_only',
      body: 'Ερώτηση μόνο προς τον διδάσκοντα',
      target: {
        ...annotationTargetRecord,
        id: 'bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc',
        pageNumber: 3,
        selectedText: 'δύσκολο σημείο',
      },
    },
    {
      ...publicAnnotation,
      id: '14141414-1414-4141-8141-141414141414',
      authorId: otherStudentId,
      visibility: 'private',
      body: 'Ιδιωτική σημείωση άλλου φοιτητή',
      target: {
        ...annotationTargetRecord,
        id: 'cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcdcd',
        pageNumber: 4,
        selectedText: 'κρυφό σημείο',
      },
      author: {
        id: otherStudentId,
        fullName: 'Other Student',
        role: 'student',
      },
    },
    {
      ...publicAnnotation,
      id: '15151515-1515-4151-8151-151515151515',
      authorId: otherStudentId,
      visibility: 'instructor_only',
      body: 'Απορία άλλου φοιτητή προς τον διδάσκοντα',
      target: {
        ...annotationTargetRecord,
        id: 'dededede-dede-4ded-8ded-dededededede',
        pageNumber: 5,
        selectedText: 'άλλη απορία',
      },
      author: {
        id: otherStudentId,
        fullName: 'Other Student',
        role: 'student',
      },
    },
  ];
  const forumCategories = [
    {
      id: documentDiscussionCategoryId,
      courseId,
      name: 'Συζητήσεις εγγράφων',
      kind: 'document_discussion',
      description: 'Νήματα από σχόλια εγγράφων.',
      orderIndex: 1,
      isVisible: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const forumPosts: ForumPostRecord[] = [];
  const forumThreads: ForumThreadRecord[] =
    options.existingThreadForPublicAnnotation
      ? [
          {
            annotationId: publicAnnotation.id,
            annotation: { body: publicAnnotation.body },
            authorId: studentId,
            author: {
              id: studentId,
              fullName: 'Test User',
              role: 'student',
            },
            categoryId: documentDiscussionCategoryId,
            courseId,
            createdAt: now,
            documentId: visibleDocumentId,
            documentTitleSnapshot: 'Visible handout',
            id: '20202020-2020-4202-8202-202020202020',
            pageNumberSnapshot: annotationTargetRecord.pageNumber,
            posts: [],
            selectedTextSnapshot: annotationTargetRecord.selectedText,
            status: 'open',
            targetId: annotationTargetRecord.id,
            title: publicAnnotation.body,
            updatedAt: now,
            verifiedPost: null,
            verifiedPostId: null,
            visibility: 'public',
          },
        ]
      : [];
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
          checksumSha256: string;
          courseId: string;
          createdById: string;
          description: string | null;
          fileSizeBytes: bigint | null;
          id: string;
          mimeType: string | null;
          objectKey: string;
          originalFilename: string | null;
          pageCount: number | null;
          title: string;
          updatedById: string;
          visibility: 'hidden_from_students' | 'visible_to_students';
        };
      }) => {
        const record = {
          id: data.id,
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
          ? (documents.find((record) => documentMatchesWhere(record, where)) ??
            null)
          : null,
    ),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const record = documents.find((item) => item.id === where.id);
      return record ?? null;
    }),
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
  const annotationTarget = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          documentId: string;
          pageNumber: number;
          selectedText?: string | null;
        };
      }) => {
        const target = {
          id: '16161616-1616-4161-8161-161616161616',
          pageNumber: data.pageNumber,
          selectedText: data.selectedText ?? null,
        };
        annotationTargets.push(target);
        return target;
      },
    ),
  };
  const annotation = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          authorId: string;
          body: string | null;
          courseId: string;
          documentId: string;
          targetId: string;
          type: 'highlight' | 'note' | 'question' | 'important' | 'confusing';
          visibility: 'private' | 'public' | 'instructor_only';
        };
      }) => {
        const target =
          annotationTargets.find((item) => item.id === data.targetId) ??
          annotationTargetRecord;
        const record = {
          id: '17171717-1717-4171-8171-171717171717',
          ...data,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
          target,
          author: {
            id: data.authorId,
            fullName: 'Test User',
            role: role ?? 'student',
          },
        };
        annotations.push(record);
        return record;
      },
    ),
    findMany: vi.fn(
      async ({
        where,
      }: {
        where: {
          courseId: string;
          documentId: string;
          isDeleted: boolean;
          OR: Array<{ authorId?: string; visibility: string }>;
        };
      }) =>
        annotations.filter(
          (record) =>
            record.courseId === where.courseId &&
            record.documentId === where.documentId &&
            record.isDeleted === where.isDeleted &&
            where.OR.some(
              (condition) =>
                record.visibility === condition.visibility &&
                (condition.authorId === undefined ||
                  record.authorId === condition.authorId),
            ),
        ),
    ),
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: {
          courseId: string;
          documentId: string;
          id: string;
          isDeleted: boolean;
        };
      }) =>
        annotations.find(
          (record) =>
            record.courseId === where.courseId &&
            record.documentId === where.documentId &&
            record.id === where.id &&
            record.isDeleted === where.isDeleted,
        ) ?? null,
    ),
    update: vi.fn(
      async ({
        data,
        where,
      }: {
        data: {
          body?: string | null;
          isDeleted?: boolean;
          type?: 'highlight' | 'note' | 'question' | 'important' | 'confusing';
          visibility?: 'private' | 'public' | 'instructor_only';
        };
        where: { id: string };
      }) => {
        const recordIndex = annotations.findIndex(
          (record) => record.id === where.id,
        );
        const next = {
          ...annotations[recordIndex],
          ...data,
          updatedAt: now,
        };
        annotations[recordIndex] = next;
        return next;
      },
    ),
  };
  const forumCategory = {
    upsert: vi.fn(
      async ({
        create,
        update,
        where,
      }: {
        create: {
          courseId: string;
          description: string;
          kind: 'document_discussion';
          name: string;
          orderIndex: number;
        };
        update: {
          isVisible: boolean;
          kind: 'document_discussion';
        };
        where: { courseId_name: { courseId: string; name: string } };
      }) => {
        const existingIndex = forumCategories.findIndex(
          (category) =>
            category.courseId === where.courseId_name.courseId &&
            category.name === where.courseId_name.name,
        );

        if (existingIndex >= 0) {
          const next = {
            ...forumCategories[existingIndex],
            ...update,
            updatedAt: now,
          };
          forumCategories[existingIndex] = next;
          return next;
        }

        const record = {
          id: documentDiscussionCategoryId,
          ...create,
          isVisible: true,
          createdAt: now,
          updatedAt: now,
        };
        forumCategories.push(record);
        return record;
      },
    ),
  };
  const forumThread = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          annotationId: string;
          authorId: string;
          categoryId: string;
          courseId: string;
          documentId: string;
          documentTitleSnapshot: string;
          pageNumberSnapshot: number;
          selectedTextSnapshot: string | null;
          targetId: string;
          title: string;
          visibility: 'private' | 'public' | 'instructor_only';
        };
      }) => {
        const record = {
          id: '18181818-1818-4181-8181-181818181818',
          ...data,
          annotation: { body: data.title },
          author: {
            id: data.authorId,
            fullName: 'Test User',
            role: role ?? 'student',
          },
          createdAt: now,
          posts: [],
          status: 'open' as const,
          updatedAt: now,
          verifiedPost: null,
          verifiedPostId: null,
        };
        forumThreads.push(record);
        return record;
      },
    ),
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: {
          courseId: string;
          documentId: string;
          id: string;
          status?: { not: string };
          visibility?: { in: Array<'public' | 'instructor_only'> };
        };
      }) =>
        forumThreads.find(
          (thread) =>
            thread.courseId === where.courseId &&
            thread.documentId === where.documentId &&
            thread.id === where.id &&
            (where.status?.not === undefined ||
              thread.status !== where.status.not) &&
            (where.visibility?.in === undefined ||
              where.visibility.in.includes(thread.visibility)),
        ) ?? null,
    ),
    findMany: vi.fn(
      async ({
        where,
      }: {
        where: {
          authorId?: string;
          courseId: string;
          document?: {
            is: {
              status: 'active';
              visibility?: 'visible_to_students';
            };
          };
          documentId?: string;
          OR?: Array<{ authorId?: string; visibility: string }>;
          status?:
            | 'open'
            | 'verified'
            | { in: Array<'open' | 'instructor_answered'> }
            | { not: 'archived' };
          verifiedPostId?: { not: null };
          visibility?: { in: Array<'public' | 'instructor_only'> };
        };
      }) =>
        forumThreads.filter((thread) => {
          const doc = documents.find((item) => item.id === thread.documentId);
          return (
            thread.courseId === where.courseId &&
            (where.authorId === undefined ||
              thread.authorId === where.authorId) &&
            (where.documentId === undefined ||
              thread.documentId === where.documentId) &&
            (where.document === undefined ||
              (doc?.status === where.document.is.status &&
                (where.document.is.visibility === undefined ||
                  doc.visibility === where.document.is.visibility))) &&
            threadMatchesStatus(thread, where.status) &&
            (where.verifiedPostId === undefined ||
              thread.verifiedPostId !== null) &&
            (where.visibility === undefined ||
              where.visibility.in.includes(thread.visibility)) &&
            (where.OR === undefined ||
              where.OR.some(
                (condition) =>
                  thread.visibility === condition.visibility &&
                  (condition.authorId === undefined ||
                    thread.authorId === condition.authorId),
              ))
          );
        }),
    ),
    findUnique: vi.fn(
      async ({ where }: { where: { annotationId: string } }) =>
        forumThreads.find(
          (thread) => thread.annotationId === where.annotationId,
        ) ?? null,
    ),
    update: vi.fn(
      async ({
        data,
        where,
      }: {
        data: {
          resolvedAt?: Date | null;
          status?: ForumThreadRecord['status'];
          verifiedPostId?: string;
        };
        where: { id: string };
      }) => {
        const recordIndex = forumThreads.findIndex(
          (thread) => thread.id === where.id,
        );
        const verifiedPost = data.verifiedPostId
          ? (forumPosts.find((post) => post.id === data.verifiedPostId) ?? null)
          : forumThreads[recordIndex].verifiedPost;
        const next = {
          ...forumThreads[recordIndex],
          ...data,
          updatedAt: now,
          verifiedPost,
        };
        forumThreads[recordIndex] = next;
        return next;
      },
    ),
  };
  const forumPost = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          authorId: string;
          body: string;
          isVerified: boolean;
          threadId: string;
        };
      }) => {
        const record: ForumPostRecord = {
          id: '30303030-3030-4303-8303-303030303030',
          ...data,
          createdAt: now,
          isDeleted: false,
          updatedAt: now,
          author: {
            id: data.authorId,
            fullName: 'Test User',
            role: role ?? 'professor',
          },
        };
        forumPosts.push(record);
        const thread = forumThreads.find((item) => item.id === data.threadId);
        if (thread) thread.posts = [record];
        return { id: record.id };
      },
    ),
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: { id: string; isDeleted: boolean; threadId: string };
      }) =>
        forumPosts.find(
          (post) =>
            post.id === where.id &&
            post.threadId === where.threadId &&
            post.isDeleted === where.isDeleted,
        ) ?? null,
    ),
    update: vi.fn(
      async ({
        data,
        where,
      }: {
        data: { isVerified: boolean };
        where: { id: string };
      }) => {
        const recordIndex = forumPosts.findIndex(
          (post) => post.id === where.id,
        );
        const next = {
          ...forumPosts[recordIndex],
          ...data,
          updatedAt: now,
        };
        forumPosts[recordIndex] = next;
        return next;
      },
    ),
  };
  const courseDocumentsPrisma = {
    annotation,
    annotationTarget,
    course: courseDelegate,
    courseInstructor,
    document,
    enrollment,
    forumCategory,
    forumPost,
    forumThread,
  };
  const courseDocumentsPrismaWithTransaction = {
    ...courseDocumentsPrisma,
    $transaction: vi.fn(
      async <T>(callback: (transaction: typeof courseDocumentsPrisma) => T) =>
        callback(courseDocumentsPrisma),
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
    courseDocumentsMaxUploadBytes: options.maxUploadBytes,
    courseDocumentsPrisma: {
      ...courseDocumentsPrismaWithTransaction,
    } as unknown as Pick<
      PrismaClient,
      | '$transaction'
      | 'annotation'
      | 'annotationTarget'
      | 'course'
      | 'courseInstructor'
      | 'document'
      | 'enrollment'
      | 'forumCategory'
      | 'forumPost'
      | 'forumThread'
    >,
    courseDocumentsStorage: storageService,
    sessionService,
  });

  return {
    annotation,
    annotationTarget,
    app,
    courseDelegate,
    courseInstructor,
    document,
    forumCategory,
    forumPost,
    forumThread,
    storageService,
  };
}

function threadMatchesStatus(
  thread: ForumThreadRecord,
  status:
    | 'open'
    | 'verified'
    | { in: Array<'open' | 'instructor_answered'> }
    | { not: 'archived' }
    | undefined,
): boolean {
  if (status === undefined) return true;
  if (typeof status === 'string') return thread.status === status;
  if ('in' in status) return status.in.includes(thread.status);
  return thread.status !== status.not;
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
    const { app, document, storageService } = createTestApp('admin');
    const pdfBuffer = await buildValidPdfBuffer();

    const response = await request(app)
      .post(`/api/courses/${courseId}/documents`)
      .set('Cookie', authCookie())
      .field('title', 'Lecture 1')
      .attach('file', pdfBuffer, {
        contentType: 'application/pdf',
        filename: 'lecture-1.pdf',
      })
      .expect(201);

    const body = CourseDocumentResponseSchema.parse(response.body);
    expect(body.data).toMatchObject({
      title: 'Lecture 1',
      visibility: 'hidden_from_students',
      originalFilename: 'lecture-1.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: pdfBuffer.byteLength,
      pageCount: 1,
    });
    expect(document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courseId,
          createdById: adminId,
          fileSizeBytes: BigInt(pdfBuffer.byteLength),
          mimeType: 'application/pdf',
          title: 'Lecture 1',
          visibility: 'hidden_from_students',
        }),
      }),
    );
    expect(storageService.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'application/pdf',
        key: expect.stringContaining(`courses/${courseId}/documents/`),
      }),
    );
  });

  it('rejects uploads that are not real PDF files', async () => {
    const { app, document, storageService } = createTestApp('admin');

    const response = await request(app)
      .post(`/api/courses/${courseId}/documents`)
      .set('Cookie', authCookie())
      .field('title', 'Not a PDF')
      .attach('file', Buffer.from('just some text'), {
        contentType: 'application/pdf',
        filename: 'fake.pdf',
      })
      .expect(400);

    expect(response.body.error.code).toBe('DOCUMENT_FILE_INVALID');
    expect(document.create).not.toHaveBeenCalled();
    expect(storageService.putObject).not.toHaveBeenCalled();
  });

  it('rejects document creation without an uploaded file', async () => {
    const { app, document } = createTestApp('admin');

    const response = await request(app)
      .post(`/api/courses/${courseId}/documents`)
      .set('Cookie', authCookie())
      .field('title', 'Missing file')
      .expect(400);

    expect(response.body.error.code).toBe('DOCUMENT_FILE_REQUIRED');
    expect(document.create).not.toHaveBeenCalled();
  });

  it('rejects uploads larger than the configured limit', async () => {
    const { app, document } = createTestApp('admin', { maxUploadBytes: 10 });
    const pdfBuffer = await buildValidPdfBuffer();

    const response = await request(app)
      .post(`/api/courses/${courseId}/documents`)
      .set('Cookie', authCookie())
      .field('title', 'Too large')
      .attach('file', pdfBuffer, {
        contentType: 'application/pdf',
        filename: 'large.pdf',
      })
      .expect(413);

    expect(response.body.error.code).toBe('DOCUMENT_FILE_TOO_LARGE');
    expect(document.create).not.toHaveBeenCalled();
  });

  it('updates document metadata for an assigned professor', async () => {
    const { app, document } = createTestApp('professor');

    const response = await request(app)
      .patch(`/api/courses/${courseId}/documents/${documentId}`)
      .set('Cookie', authCookie())
      .send({
        description: 'Updated description',
        visibility: 'visible_to_students',
      })
      .expect(200);

    const body = CourseDocumentResponseSchema.parse(response.body);
    expect(body.data).toMatchObject({
      id: documentId,
      description: 'Updated description',
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

    expect(
      CourseDocumentResponseSchema.parse(visibleResponse.body).data.id,
    ).toBe(visibleDocumentId);

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

  it('streams document content for an assigned professor', async () => {
    const { app, storageService } = createTestApp('professor');

    const response = await request(app)
      .get(`/api/courses/${courseId}/documents/${documentId}/content`)
      .set('Cookie', authCookie())
      .expect(200);

    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toContain(
      'filename="syllabus.pdf"',
    );
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body.toString()).toBe(
      `content-of-${documentRecord.objectKey}`,
    );
    expect(storageService.getObject).toHaveBeenCalledWith(
      documentRecord.objectKey,
    );
  });

  it('blocks students from reading hidden document content', async () => {
    const { app } = createTestApp('student', { visibilityFixtures: true });

    const response = await request(app)
      .get(`/api/courses/${courseId}/documents/${documentId}/content`)
      .set('Cookie', authCookie())
      .expect(404);

    expect(response.body.error.code).toBe('DOCUMENT_NOT_FOUND');
  });

  it('allows students to read visible document content', async () => {
    const { app } = createTestApp('student', { visibilityFixtures: true });

    await request(app)
      .get(`/api/courses/${courseId}/documents/${visibleDocumentId}/content`)
      .set('Cookie', authCookie())
      .expect(200);
  });

  it('rejects unauthenticated annotation requests', async () => {
    const { app } = createTestApp(null, { visibilityFixtures: true });

    await request(app)
      .get(
        `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations`,
      )
      .expect(401);
  });

  it('lists public and own annotations for students', async () => {
    const { app, annotation } = createTestApp('student', {
      visibilityFixtures: true,
    });

    const response = await request(app)
      .get(
        `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations`,
      )
      .set('Cookie', authCookie())
      .expect(200);

    const body = CourseDocumentAnnotationsResponseSchema.parse(response.body);
    expect(body.data.map((item) => item.id)).toEqual([
      '12121212-1212-4121-8121-121212121212',
      publicAnnotation.id,
      '13131313-1313-4131-8131-131313131313',
    ]);
    expect(annotation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseId,
          documentId: visibleDocumentId,
          isDeleted: false,
        }),
      }),
    );
  });

  it('lists public and instructor-only annotations for professors', async () => {
    const { app } = createTestApp('professor', { visibilityFixtures: true });

    const response = await request(app)
      .get(
        `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations`,
      )
      .set('Cookie', authCookie())
      .expect(200);

    const body = CourseDocumentAnnotationsResponseSchema.parse(response.body);
    expect(body.data.map((item) => item.id)).toEqual([
      publicAnnotation.id,
      '13131313-1313-4131-8131-131313131313',
      '15151515-1515-4151-8151-151515151515',
    ]);
  });

  it('creates a page-level annotation target and annotation', async () => {
    const { annotation, annotationTarget, app, forumThread } = createTestApp(
      'student',
      {
        visibilityFixtures: true,
      },
    );

    const response = await request(app)
      .post(
        `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations`,
      )
      .set('Cookie', authCookie())
      .send({
        pageNumber: 2,
        type: 'note',
        visibility: 'private',
        body: '  Χρήσιμη σημείωση  ',
        selectedText: '  βασική έννοια  ',
      })
      .expect(201);

    const body = CourseDocumentAnnotationResponseSchema.parse(response.body);
    expect(body.data).toMatchObject({
      body: 'Χρήσιμη σημείωση',
      documentId: visibleDocumentId,
      type: 'note',
      visibility: 'private',
      target: {
        pageNumber: 2,
        selectedText: 'βασική έννοια',
      },
    });
    expect(annotationTarget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: visibleDocumentId,
          normalizedRects: [],
          pageNumber: 2,
          selectedText: 'βασική έννοια',
        }),
      }),
    );
    expect(annotation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authorId: studentId,
          body: 'Χρήσιμη σημείωση',
          courseId,
          documentId: visibleDocumentId,
          type: 'note',
          visibility: 'private',
        }),
      }),
    );
    expect(forumThread.create).not.toHaveBeenCalled();
  });

  it.each(['public', 'instructor_only'] as const)(
    'creates a contextual thread for %s question annotations',
    async (visibility) => {
      const { app, forumCategory, forumThread } = createTestApp('student', {
        visibilityFixtures: true,
      });

      const response = await request(app)
        .post(
          `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations`,
        )
        .set('Cookie', authCookie())
        .send({
          pageNumber: 2,
          type: 'question',
          visibility,
          body: '  Πώς συνδέεται αυτό;  ',
          selectedText: '  σημείο απορίας  ',
        })
        .expect(201);

      const body = CourseDocumentAnnotationResponseSchema.parse(response.body);
      expect(body.data).toMatchObject({
        body: 'Πώς συνδέεται αυτό;',
        type: 'question',
        visibility,
        target: {
          pageNumber: 2,
          selectedText: 'σημείο απορίας',
        },
      });
      expect(forumCategory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            courseId_name: {
              courseId,
              name: 'Συζητήσεις εγγράφων',
            },
          },
        }),
      );
      expect(forumThread.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            annotationId: body.data.id,
            authorId: studentId,
            categoryId: documentDiscussionCategoryId,
            courseId,
            documentId: visibleDocumentId,
            documentTitleSnapshot: 'Visible handout',
            pageNumberSnapshot: 2,
            selectedTextSnapshot: 'σημείο απορίας',
            targetId: body.data.target.id,
            title: 'Πώς συνδέεται αυτό;',
            visibility,
          }),
        }),
      );
    },
  );

  it.each([
    { type: 'question', visibility: 'private' },
    { type: 'note', visibility: 'public' },
  ] as const)(
    'does not create a contextual thread for $visibility $type annotations',
    async ({ type, visibility }) => {
      const { app, forumCategory, forumThread } = createTestApp('student', {
        visibilityFixtures: true,
      });

      await request(app)
        .post(
          `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations`,
        )
        .set('Cookie', authCookie())
        .send({
          pageNumber: 2,
          type,
          visibility,
          body: 'Δεν ανοίγει thread',
          selectedText: 'σημείο',
        })
        .expect(201);

      expect(forumCategory.upsert).not.toHaveBeenCalled();
      expect(forumThread.create).not.toHaveBeenCalled();
    },
  );

  it('updates an annotation for its creator', async () => {
    const { annotation, app } = createTestApp('student', {
      visibilityFixtures: true,
    });

    const response = await request(app)
      .patch(
        `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations/${publicAnnotation.id}`,
      )
      .set('Cookie', authCookie())
      .send({
        body: '  Ενημερωμένη σημείωση  ',
        type: 'important',
        visibility: 'private',
      })
      .expect(200);

    const body = CourseDocumentAnnotationResponseSchema.parse(response.body);
    expect(body.data).toMatchObject({
      id: publicAnnotation.id,
      body: 'Ενημερωμένη σημείωση',
      type: 'important',
      visibility: 'private',
    });
    expect(annotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: 'Ενημερωμένη σημείωση',
          type: 'important',
          visibility: 'private',
        }),
        where: { id: publicAnnotation.id },
      }),
    );
  });

  it('creates a contextual thread when an update completes the question criteria', async () => {
    const { app, forumCategory, forumThread } = createTestApp('student', {
      visibilityFixtures: true,
    });

    const response = await request(app)
      .patch(
        `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations/12121212-1212-4121-8121-121212121212`,
      )
      .set('Cookie', authCookie())
      .send({
        body: '  Ποια είναι η διαφορά εδώ;  ',
        type: 'question',
        visibility: 'public',
      })
      .expect(200);

    const body = CourseDocumentAnnotationResponseSchema.parse(response.body);
    expect(body.data).toMatchObject({
      id: '12121212-1212-4121-8121-121212121212',
      body: 'Ποια είναι η διαφορά εδώ;',
      type: 'question',
      visibility: 'public',
    });
    expect(forumThread.findUnique).toHaveBeenCalledWith({
      where: { annotationId: body.data.id },
    });
    expect(forumCategory.upsert).toHaveBeenCalled();
    expect(forumThread.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          annotationId: body.data.id,
          authorId: studentId,
          courseId,
          documentId: visibleDocumentId,
          documentTitleSnapshot: 'Visible handout',
          pageNumberSnapshot: 1,
          selectedTextSnapshot: 'προσωπικό σημείο',
          targetId: 'abababab-abab-4aba-8aba-abababababab',
          title: 'Ποια είναι η διαφορά εδώ;',
          visibility: 'public',
        }),
      }),
    );
  });

  it('does not create a duplicate contextual thread for an already-threaded question', async () => {
    const { app, forumCategory, forumThread } = createTestApp('student', {
      existingThreadForPublicAnnotation: true,
      visibilityFixtures: true,
    });

    await request(app)
      .patch(
        `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations/${publicAnnotation.id}`,
      )
      .set('Cookie', authCookie())
      .send({
        body: 'Ενημερωμένη ερώτηση με υπάρχον thread',
      })
      .expect(200);

    expect(forumThread.findUnique).toHaveBeenCalledWith({
      where: { annotationId: publicAnnotation.id },
    });
    expect(forumCategory.upsert).not.toHaveBeenCalled();
    expect(forumThread.create).not.toHaveBeenCalled();
  });

  it('blocks annotation updates from non-creators', async () => {
    const { annotation, app } = createTestApp('professor', {
      visibilityFixtures: true,
    });

    const response = await request(app)
      .patch(
        `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations/${publicAnnotation.id}`,
      )
      .set('Cookie', authCookie())
      .send({ body: 'Αλλαγή από άλλον χρήστη' })
      .expect(403);

    expect(response.body.error.code).toBe('ANNOTATION_FORBIDDEN');
    expect(annotation.update).not.toHaveBeenCalled();
  });

  it('soft-deletes an annotation for its creator', async () => {
    const { annotation, app } = createTestApp('student', {
      visibilityFixtures: true,
    });

    await request(app)
      .delete(
        `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations/${publicAnnotation.id}`,
      )
      .set('Cookie', authCookie())
      .expect(204);

    expect(annotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isDeleted: true },
        where: { id: publicAnnotation.id },
      }),
    );

    const listResponse = await request(app)
      .get(
        `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations`,
      )
      .set('Cookie', authCookie())
      .expect(200);

    const body = CourseDocumentAnnotationsResponseSchema.parse(
      listResponse.body,
    );
    expect(body.data.map((item) => item.id)).not.toContain(publicAnnotation.id);
  });

  it('blocks annotation deletes from non-creators', async () => {
    const { annotation, app } = createTestApp('professor', {
      visibilityFixtures: true,
    });

    const response = await request(app)
      .delete(
        `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations/${publicAnnotation.id}`,
      )
      .set('Cookie', authCookie())
      .expect(403);

    expect(response.body.error.code).toBe('ANNOTATION_FORBIDDEN');
    expect(annotation.update).not.toHaveBeenCalled();
  });

  it('rejects annotations outside the document page range', async () => {
    const { annotation, annotationTarget, app } = createTestApp('student', {
      visibilityFixtures: true,
    });

    const response = await request(app)
      .post(
        `/api/courses/${courseId}/documents/${visibleDocumentId}/annotations`,
      )
      .set('Cookie', authCookie())
      .send({
        pageNumber: 99,
        type: 'confusing',
        visibility: 'instructor_only',
      })
      .expect(400);

    expect(response.body.error.code).toBe('ANNOTATION_PAGE_OUT_OF_RANGE');
    expect(annotationTarget.create).not.toHaveBeenCalled();
    expect(annotation.create).not.toHaveBeenCalled();
  });

  it('hides hidden document annotations from students', async () => {
    const { app } = createTestApp('student', { visibilityFixtures: true });

    const response = await request(app)
      .get(`/api/courses/${courseId}/documents/${documentId}/annotations`)
      .set('Cookie', authCookie())
      .expect(404);

    expect(response.body.error.code).toBe('DOCUMENT_NOT_FOUND');
  });

  it('returns a 502 when stored content cannot be read', async () => {
    const { app, storageService } = createTestApp('professor');
    vi.mocked(storageService.getObject).mockRejectedValueOnce(
      new Error('storage unavailable'),
    );

    const response = await request(app)
      .get(`/api/courses/${courseId}/documents/${documentId}/content`)
      .set('Cookie', authCookie())
      .expect(502);

    expect(response.body.error.code).toBe('DOCUMENT_CONTENT_UNAVAILABLE');
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
