import { randomUUID } from 'node:crypto';

import type { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  ForumThreadResponseSchema,
  ForumThreadsResponseSchema,
} from '@web-app/contracts';

import { createApp } from '../app.js';
import type { AuditLogger } from '../auth/audit-log.js';
import type { SessionService } from '../auth/session.js';
import { env } from '../config/env.js';

const courseId = '11111111-1111-4111-8111-111111111111';
const professorId = '22222222-2222-4222-8222-222222222222';
const studentId = '33333333-3333-4333-8333-333333333333';
const otherStudentId = '44444444-4444-4444-8444-444444444444';
const documentId = '55555555-5555-4555-8555-555555555555';
const now = new Date('2026-09-12T09:00:00.000Z');

interface CategoryRecord {
  id: string;
  courseId: string;
  name: string;
  kind: 'general' | 'document_discussion' | 'archived_document_discussion';
  description: string | null;
  orderIndex: number;
  isVisible: boolean;
}

interface PostRecord {
  id: string;
  threadId: string;
  authorId: string;
  authorRole: UserRole;
  body: string;
  isVerified: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ThreadRecord {
  id: string;
  courseId: string;
  categoryId: string;
  documentId: string | null;
  annotationId: string | null;
  authorId: string;
  authorRole: UserRole;
  title: string;
  status: 'open' | 'instructor_answered' | 'verified' | 'resolved' | 'archived';
  visibility: 'public' | 'instructor_only';
  pageNumberSnapshot: number | null;
  selectedTextSnapshot: string | null;
  documentTitleSnapshot: string | null;
  verifiedPostId: string | null;
  resolvedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function userRef(id: string, role: UserRole) {
  return { id, fullName: `${role}-${id.slice(0, 4)}`, role };
}

function matchesStatus(
  thread: ThreadRecord,
  status: unknown,
): boolean {
  if (status === undefined) return true;
  if (typeof status === 'string') return thread.status === status;
  const clause = status as { not?: string; in?: string[] };
  if (clause.not !== undefined) return thread.status !== clause.not;
  if (clause.in !== undefined) return clause.in.includes(thread.status);
  return true;
}

function matchesDocumentId(thread: ThreadRecord, documentIdClause: unknown): boolean {
  if (documentIdClause === undefined) return true;
  if (documentIdClause === null) return thread.documentId === null;
  const clause = documentIdClause as { not?: string | null };
  if (clause && typeof clause === 'object' && 'not' in clause) {
    return clause.not === null
      ? thread.documentId !== null
      : thread.documentId !== clause.not;
  }
  return thread.documentId === documentIdClause;
}

function matchesOr(
  thread: ThreadRecord,
  or: { visibility: string; authorId?: string }[] | undefined,
): boolean {
  if (or === undefined) return true;
  return or.some(
    (condition) =>
      thread.visibility === condition.visibility &&
      (condition.authorId === undefined || thread.authorId === condition.authorId),
  );
}

function matchesThreadWhere(
  thread: ThreadRecord,
  where: Record<string, unknown>,
): boolean {
  return (
    (where.courseId === undefined || thread.courseId === where.courseId) &&
    (where.id === undefined || thread.id === where.id) &&
    (where.authorId === undefined || thread.authorId === where.authorId) &&
    matchesStatus(thread, where.status) &&
    matchesDocumentId(thread, where.documentId) &&
    matchesOr(
      thread,
      where.OR as { visibility: string; authorId?: string }[] | undefined,
    )
  );
}

function createTestApp() {
  const auditLogger: AuditLogger = {
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
  };

  const categories: CategoryRecord[] = [];
  const threads: ThreadRecord[] = [];
  const posts: PostRecord[] = [];

  const courseDelegate = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === courseId
        ? { id: courseId, isActive: true }
        : null,
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
        where.courseId_instructorId.courseId === courseId &&
        where.courseId_instructorId.instructorId === professorId
          ? { id: 'assignment-1' }
          : null,
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
        where.courseId_studentId.courseId === courseId &&
        (where.courseId_studentId.studentId === studentId ||
          where.courseId_studentId.studentId === otherStudentId)
          ? { status: 'active' }
          : null,
    ),
  };

  const document = { findUnique: vi.fn(async () => null) };

  function withRelations(thread: ThreadRecord) {
    const category = categories.find((item) => item.id === thread.categoryId)!;
    const threadPosts = posts
      .filter((post) => post.threadId === thread.id && !post.isDeleted)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return {
      ...thread,
      category: { kind: category.kind },
      author: userRef(thread.authorId, thread.authorRole),
      annotation: null,
      posts: threadPosts.map((post) => ({
        id: post.id,
        threadId: post.threadId,
        body: post.body,
        isVerified: post.isVerified,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: userRef(post.authorId, post.authorRole),
      })),
      _count: { posts: threadPosts.length },
    };
  }

  const forumCategory = {
    upsert: vi.fn(
      async ({
        create,
        where,
      }: {
        create: Omit<CategoryRecord, 'id'>;
        update: Partial<CategoryRecord>;
        where: { courseId_name: { courseId: string; name: string } };
      }) => {
        const existing = categories.find(
          (category) =>
            category.courseId === where.courseId_name.courseId &&
            category.name === where.courseId_name.name,
        );
        if (existing) return existing;
        const record: CategoryRecord = { id: randomUUID(), ...create };
        categories.push(record);
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
          authorId: string;
          categoryId: string;
          courseId: string;
          status: ThreadRecord['status'];
          title: string;
          visibility: ThreadRecord['visibility'];
        };
      }) => {
        const record: ThreadRecord = {
          id: randomUUID(),
          courseId: data.courseId,
          categoryId: data.categoryId,
          documentId: null,
          annotationId: null,
          authorId: data.authorId,
          authorRole: data.authorId === professorId ? 'professor' : 'student',
          title: data.title,
          status: data.status,
          visibility: data.visibility,
          pageNumberSnapshot: null,
          selectedTextSnapshot: null,
          documentTitleSnapshot: null,
          verifiedPostId: null,
          resolvedAt: null,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        threads.push(record);
        return { id: record.id };
      },
    ),
    findFirst: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) => {
        const thread = threads.find((item) => matchesThreadWhere(item, where));
        return thread ? withRelations(thread) : null;
      },
    ),
    findMany: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        threads
          .filter((thread) => matchesThreadWhere(thread, where))
          .map(withRelations),
    ),
    findUniqueOrThrow: vi.fn(
      async ({ where }: { where: { id: string } }) => {
        const thread = threads.find((item) => item.id === where.id);
        if (!thread) throw new Error('not found');
        return { verifiedPostId: thread.verifiedPostId };
      },
    ),
    update: vi.fn(
      async ({
        data,
        where,
      }: {
        data: Partial<ThreadRecord>;
        where: { id: string };
      }) => {
        const index = threads.findIndex((item) => item.id === where.id);
        threads[index] = { ...threads[index], ...data, updatedAt: now };
        return threads[index];
      },
    ),
  };

  const forumPost = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: { authorId: string; body: string; threadId: string };
      }) => {
        const record: PostRecord = {
          id: randomUUID(),
          threadId: data.threadId,
          authorId: data.authorId,
          authorRole: data.authorId === professorId ? 'professor' : 'student',
          body: data.body,
          isVerified: false,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        };
        posts.push(record);
        return record;
      },
    ),
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: {
          id?: string;
          isDeleted: boolean;
          threadId: string;
          author?: { role: { in: UserRole[] } };
        };
      }) => {
        const post = posts.find(
          (item) =>
            (where.id === undefined || item.id === where.id) &&
            item.threadId === where.threadId &&
            item.isDeleted === where.isDeleted &&
            (where.author === undefined ||
              where.author.role.in.includes(item.authorRole)),
        );
        return post ? { ...post, author: { role: post.authorRole } } : null;
      },
    ),
    update: vi.fn(
      async ({
        data,
        where,
      }: {
        data: Partial<PostRecord>;
        where: { id: string };
      }) => {
        const index = posts.findIndex((item) => item.id === where.id);
        posts[index] = { ...posts[index], ...data, updatedAt: now };
        return posts[index];
      },
    ),
  };

  const delegates = {
    course: courseDelegate,
    courseInstructor,
    document,
    enrollment,
    forumCategory,
    forumPost,
    forumThread,
  };
  const prismaWithTransaction = {
    ...delegates,
    $transaction: vi.fn(async <T>(callback: (tx: typeof delegates) => T) =>
      callback(delegates),
    ),
  };

  function sessionServiceFor(role: UserRole, userId: string): SessionService {
    return {
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
  }

  function appAs(role: UserRole, userId: string) {
    return createApp({
      auditLogger,
      courseForumPrisma: prismaWithTransaction as unknown as Pick<
        PrismaClient,
        | '$transaction'
        | 'course'
        | 'courseInstructor'
        | 'document'
        | 'enrollment'
        | 'forumCategory'
        | 'forumThread'
        | 'forumPost'
      >,
      sessionService: sessionServiceFor(role, userId),
    });
  }

  // Seed a pre-existing document-linked thread (as course-documents.ts's
  // annotation flow would create it) to exercise the `document`/`documentId`
  // filters without depending on that other router.
  const documentCategory: CategoryRecord = {
    id: randomUUID(),
    courseId,
    name: 'Συζητήσεις εγγράφων',
    kind: 'document_discussion',
    description: null,
    orderIndex: 1,
    isVisible: true,
  };
  categories.push(documentCategory);
  const documentThread: ThreadRecord = {
    id: randomUUID(),
    courseId,
    categoryId: documentCategory.id,
    documentId,
    annotationId: randomUUID(),
    authorId: studentId,
    authorRole: 'student',
    title: 'Ερώτηση πάνω στο έγγραφο',
    status: 'open',
    visibility: 'public',
    pageNumberSnapshot: 3,
    selectedTextSnapshot: 'κείμενο',
    documentTitleSnapshot: 'Έγγραφο μαθήματος',
    verifiedPostId: null,
    resolvedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  threads.push(documentThread);

  return { appAs, documentThread, threads };
}

function authCookie(): string {
  return `${env.SESSION_COOKIE_NAME}=test-token`;
}

async function createGeneralThread(
  appAs: ReturnType<typeof createTestApp>['appAs'],
  authorRole: UserRole,
  authorId: string,
  visibility: 'public' | 'instructor_only' = 'public',
): Promise<string> {
  const response = await request(appAs(authorRole, authorId))
    .post(`/api/courses/${courseId}/forum/threads`)
    .set('Cookie', authCookie())
    .send({ title: 'Νέα συζήτηση', body: 'Αρχικό μήνυμα', visibility })
    .expect(201);

  return ForumThreadResponseSchema.parse(response.body).data.id;
}

describe('course forum routes', () => {
  it('creates a general thread with an opening post', async () => {
    const { appAs } = createTestApp();

    const response = await request(appAs('student', studentId))
      .post(`/api/courses/${courseId}/forum/threads`)
      .set('Cookie', authCookie())
      .send({
        title: 'Πώς οργανώνουμε ομαδική μελέτη;',
        body: 'Θέλει κανείς να συναντηθούμε;',
        visibility: 'public',
      })
      .expect(201);

    const body = ForumThreadResponseSchema.parse(response.body);
    expect(body.data).toMatchObject({
      status: 'open',
      title: 'Πώς οργανώνουμε ομαδική μελέτη;',
      documentId: null,
      annotationId: null,
      openingBody: null,
    });
    expect(body.data.posts).toHaveLength(1);
    expect(body.data.posts[0]).toMatchObject({
      body: 'Θέλει κανείς να συναντηθούμε;',
    });
  });

  it('rejects thread creation from an unenrolled/unassigned actor', async () => {
    const { appAs } = createTestApp();

    await request(appAs('student', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))
      .post(`/api/courses/${courseId}/forum/threads`)
      .set('Cookie', authCookie())
      .send({ title: 'Τίτλος', body: 'Σώμα', visibility: 'public' })
      .expect(403);
  });

  it('filters the thread list by general/document/unanswered/resolved', async () => {
    const { appAs, documentThread } = createTestApp();
    const app = appAs('professor', professorId);
    const generalThreadId = await createGeneralThread(appAs, 'student', studentId);

    const general = ForumThreadsResponseSchema.parse(
      (
        await request(app)
          .get(`/api/courses/${courseId}/forum/threads?filter=general`)
          .set('Cookie', authCookie())
          .expect(200)
      ).body,
    );
    expect(general.data.map((thread) => thread.id)).toEqual([generalThreadId]);

    const documentFiltered = ForumThreadsResponseSchema.parse(
      (
        await request(app)
          .get(`/api/courses/${courseId}/forum/threads?filter=document`)
          .set('Cookie', authCookie())
          .expect(200)
      ).body,
    );
    expect(documentFiltered.data.map((thread) => thread.id)).toEqual([
      documentThread.id,
    ]);

    const byDocumentId = ForumThreadsResponseSchema.parse(
      (
        await request(app)
          .get(
            `/api/courses/${courseId}/forum/threads?filter=all&documentId=${documentId}`,
          )
          .set('Cookie', authCookie())
          .expect(200)
      ).body,
    );
    expect(byDocumentId.data.map((thread) => thread.id)).toEqual([
      documentThread.id,
    ]);

    const unanswered = ForumThreadsResponseSchema.parse(
      (
        await request(app)
          .get(`/api/courses/${courseId}/forum/threads?filter=unanswered`)
          .set('Cookie', authCookie())
          .expect(200)
      ).body,
    );
    expect(unanswered.data.map((thread) => thread.id).sort()).toEqual(
      [generalThreadId, documentThread.id].sort(),
    );
  });

  it('hides an instructor-only thread from students who are not its creator', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(
      appAs,
      'student',
      studentId,
      'instructor_only',
    );

    await request(appAs('student', otherStudentId))
      .get(`/api/courses/${courseId}/forum/threads/${threadId}`)
      .set('Cookie', authCookie())
      .expect(404);

    await request(appAs('student', studentId))
      .get(`/api/courses/${courseId}/forum/threads/${threadId}`)
      .set('Cookie', authCookie())
      .expect(200);

    await request(appAs('professor', professorId))
      .get(`/api/courses/${courseId}/forum/threads/${threadId}`)
      .set('Cookie', authCookie())
      .expect(200);
  });

  it('lets any course member reply to a public thread', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(appAs, 'student', studentId);

    const response = await request(appAs('student', otherStudentId))
      .post(`/api/courses/${courseId}/forum/threads/${threadId}/posts`)
      .set('Cookie', authCookie())
      .send({ body: 'Κι εγώ θέλω να συμμετέχω!' })
      .expect(201);

    const body = ForumThreadResponseSchema.parse(response.body);
    expect(body.data.status).toBe('open');
    expect(body.data.posts).toHaveLength(2);
  });

  it('auto-transitions an open thread to instructor_answered on a professor reply', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(appAs, 'student', studentId);

    const response = await request(appAs('professor', professorId))
      .post(`/api/courses/${courseId}/forum/threads/${threadId}/posts`)
      .set('Cookie', authCookie())
      .send({ body: 'Ορίστε η απάντηση του διδάσκοντα.' })
      .expect(201);

    expect(ForumThreadResponseSchema.parse(response.body).data.status).toBe(
      'instructor_answered',
    );
  });

  it('does not change status when a student replies', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(appAs, 'student', studentId);

    const response = await request(appAs('student', otherStudentId))
      .post(`/api/courses/${courseId}/forum/threads/${threadId}/posts`)
      .set('Cookie', authCookie())
      .send({ body: 'Απάντηση φοιτητή' })
      .expect(201);

    expect(ForumThreadResponseSchema.parse(response.body).data.status).toBe(
      'open',
    );
  });

  it('rejects a reply to an instructor-only thread from an unrelated student', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(
      appAs,
      'student',
      studentId,
      'instructor_only',
    );

    await request(appAs('student', otherStudentId))
      .post(`/api/courses/${courseId}/forum/threads/${threadId}/posts`)
      .set('Cookie', authCookie())
      .send({ body: 'Δεν θα έπρεπε να φαίνεται' })
      .expect(404);
  });

  it('only lets the thread creator or an instructor edit or delete the thread', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(appAs, 'student', studentId);

    await request(appAs('student', otherStudentId))
      .patch(`/api/courses/${courseId}/forum/threads/${threadId}`)
      .set('Cookie', authCookie())
      .send({ title: 'Νέος τίτλος' })
      .expect(403);

    await request(appAs('professor', professorId))
      .patch(`/api/courses/${courseId}/forum/threads/${threadId}`)
      .set('Cookie', authCookie())
      .send({ title: 'Νέος τίτλος από τον διδάσκοντα' })
      .expect(200);

    await request(appAs('professor', professorId))
      .delete(`/api/courses/${courseId}/forum/threads/${threadId}`)
      .set('Cookie', authCookie())
      .expect(204);

    await request(appAs('student', studentId))
      .get(`/api/courses/${courseId}/forum/threads/${threadId}`)
      .set('Cookie', authCookie())
      .expect(404);
  });

  it('rejects verification of a student-authored reply', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(appAs, 'student', studentId);
    const replyResponse = await request(appAs('student', otherStudentId))
      .post(`/api/courses/${courseId}/forum/threads/${threadId}/posts`)
      .set('Cookie', authCookie())
      .send({ body: 'Απάντηση φοιτητή' })
      .expect(201);
    const studentPostId =
      ForumThreadResponseSchema.parse(replyResponse.body).data.posts.at(-1)!.id;

    await request(appAs('professor', professorId))
      .patch(
        `/api/courses/${courseId}/forum/threads/${threadId}/posts/${studentPostId}/verify`,
      )
      .set('Cookie', authCookie())
      .expect(404);
  });

  it('rejects verification attempts from students', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(appAs, 'student', studentId);

    await request(appAs('student', studentId))
      .patch(
        `/api/courses/${courseId}/forum/threads/${threadId}/posts/${randomUUID()}/verify`,
      )
      .set('Cookie', authCookie())
      .expect(403);
  });

  it('verifies an instructor reply and resolves/reopens through the full state machine', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(appAs, 'student', studentId);

    const answerResponse = await request(appAs('professor', professorId))
      .post(`/api/courses/${courseId}/forum/threads/${threadId}/posts`)
      .set('Cookie', authCookie())
      .send({ body: 'Η επίσημη απάντηση.' })
      .expect(201);
    const answerBody = ForumThreadResponseSchema.parse(answerResponse.body);
    expect(answerBody.data.status).toBe('instructor_answered');
    const answerPostId = answerBody.data.posts.at(-1)!.id;

    const verifyResponse = await request(appAs('professor', professorId))
      .patch(
        `/api/courses/${courseId}/forum/threads/${threadId}/posts/${answerPostId}/verify`,
      )
      .set('Cookie', authCookie())
      .expect(200);
    expect(ForumThreadResponseSchema.parse(verifyResponse.body).data).toMatchObject(
      { status: 'verified', verifiedPostId: answerPostId },
    );

    await request(appAs('student', studentId))
      .patch(`/api/courses/${courseId}/forum/threads/${threadId}/resolve`)
      .set('Cookie', authCookie())
      .expect(200);

    const reopenResponse = await request(appAs('student', studentId))
      .patch(`/api/courses/${courseId}/forum/threads/${threadId}/reopen`)
      .set('Cookie', authCookie())
      .expect(200);
    expect(ForumThreadResponseSchema.parse(reopenResponse.body).data.status).toBe(
      'verified',
    );
  });

  it('reopens to instructor_answered when no verified post exists', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(appAs, 'student', studentId);

    await request(appAs('professor', professorId))
      .post(`/api/courses/${courseId}/forum/threads/${threadId}/posts`)
      .set('Cookie', authCookie())
      .send({ body: 'Απάντηση χωρίς επαλήθευση' })
      .expect(201);
    await request(appAs('professor', professorId))
      .patch(`/api/courses/${courseId}/forum/threads/${threadId}/resolve`)
      .set('Cookie', authCookie())
      .expect(200);

    const reopenResponse = await request(appAs('professor', professorId))
      .patch(`/api/courses/${courseId}/forum/threads/${threadId}/reopen`)
      .set('Cookie', authCookie())
      .expect(200);
    expect(ForumThreadResponseSchema.parse(reopenResponse.body).data.status).toBe(
      'instructor_answered',
    );
  });

  it('reopens to open when no instructor post ever existed', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(appAs, 'student', studentId);

    await request(appAs('student', studentId))
      .patch(`/api/courses/${courseId}/forum/threads/${threadId}/resolve`)
      .set('Cookie', authCookie())
      .expect(200);

    const reopenResponse = await request(appAs('student', studentId))
      .patch(`/api/courses/${courseId}/forum/threads/${threadId}/reopen`)
      .set('Cookie', authCookie())
      .expect(200);
    expect(ForumThreadResponseSchema.parse(reopenResponse.body).data.status).toBe(
      'open',
    );
  });

  it('rejects reopening a thread that is not resolved', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(appAs, 'student', studentId);

    await request(appAs('student', studentId))
      .patch(`/api/courses/${courseId}/forum/threads/${threadId}/reopen`)
      .set('Cookie', authCookie())
      .expect(409);
  });

  it('clears verification and recomputes status when the verified post is deleted', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(appAs, 'student', studentId);

    const answerResponse = await request(appAs('professor', professorId))
      .post(`/api/courses/${courseId}/forum/threads/${threadId}/posts`)
      .set('Cookie', authCookie())
      .send({ body: 'Απάντηση προς επαλήθευση' })
      .expect(201);
    const answerPostId = ForumThreadResponseSchema.parse(answerResponse.body).data
      .posts.at(-1)!.id;

    await request(appAs('professor', professorId))
      .patch(
        `/api/courses/${courseId}/forum/threads/${threadId}/posts/${answerPostId}/verify`,
      )
      .set('Cookie', authCookie())
      .expect(200);

    await request(appAs('professor', professorId))
      .delete(
        `/api/courses/${courseId}/forum/threads/${threadId}/posts/${answerPostId}`,
      )
      .set('Cookie', authCookie())
      .expect(204);

    const response = await request(appAs('student', studentId))
      .get(`/api/courses/${courseId}/forum/threads/${threadId}`)
      .set('Cookie', authCookie())
      .expect(200);
    expect(ForumThreadResponseSchema.parse(response.body).data).toMatchObject({
      status: 'open',
      verifiedPostId: null,
    });
  });

  it('only lets a reply author edit or delete their own reply', async () => {
    const { appAs } = createTestApp();
    const threadId = await createGeneralThread(appAs, 'student', studentId);
    const replyResponse = await request(appAs('student', otherStudentId))
      .post(`/api/courses/${courseId}/forum/threads/${threadId}/posts`)
      .set('Cookie', authCookie())
      .send({ body: 'Αρχικό σχόλιο' })
      .expect(201);
    const postId =
      ForumThreadResponseSchema.parse(replyResponse.body).data.posts.at(-1)!.id;

    await request(appAs('student', studentId))
      .patch(
        `/api/courses/${courseId}/forum/threads/${threadId}/posts/${postId}`,
      )
      .set('Cookie', authCookie())
      .send({ body: 'Δεν είναι δικό μου' })
      .expect(403);

    await request(appAs('student', otherStudentId))
      .patch(
        `/api/courses/${courseId}/forum/threads/${threadId}/posts/${postId}`,
      )
      .set('Cookie', authCookie())
      .send({ body: 'Επεξεργασμένο σχόλιο' })
      .expect(200);
  });
});
