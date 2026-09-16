import { Router, type Request } from 'express';
import type {
  ForumCategoryKind,
  ForumThreadStatus,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import {
  CourseIdParamsSchema,
  CreateForumPostRequestSchema,
  CreateForumThreadRequestSchema,
  ForumPostIdParamsSchema,
  ForumThreadIdParamsSchema,
  ForumThreadListQuerySchema,
  ForumThreadResponseSchema,
  ForumThreadsResponseSchema,
  UpdateForumPostRequestSchema,
  UpdateForumThreadRequestSchema,
  type CreateForumPostRequest,
  type CreateForumThreadRequest,
  type ForumPost,
  type ForumThreadAuthor,
  type ForumThreadDetail,
  type ForumThreadFilter,
  type ForumThreadListItem,
  type ForumThreadListQuery,
  type ForumThreadResponse,
  type ForumThreadsResponse,
  type UpdateForumPostRequest,
  type UpdateForumThreadRequest,
} from '@web-app/contracts';

import { createAuditLogger, type AuditLogger } from '../auth/audit-log.js';
import {
  createAuthorizationService,
  type AuthorizationService,
} from '../auth/authorization-service.js';
import {
  requireRole,
  type AuthorizationMiddlewareOptions,
} from '../auth/authorization-middleware.js';
import { type SessionService } from '../auth/session.js';
import { asyncHandler } from '../lib/async-handler.js';
import {
  forumThreadVisibilityWhere,
  isCourseInstructor,
  recomputeThreadStatus,
} from '../lib/forum-authorization.js';
import { HttpError } from '../lib/http-error.js';
import { prisma as defaultPrisma } from '../lib/prisma.js';
import { validateRequest } from '../lib/request-validation.js';
import { sendJson } from '../lib/send-json.js';

type CourseForumPrismaClient = Pick<
  PrismaClient,
  | '$transaction'
  | 'course'
  | 'courseInstructor'
  | 'document'
  | 'enrollment'
  | 'forumCategory'
  | 'forumThread'
  | 'forumPost'
>;

export interface CourseForumRouteOptions {
  auditLogger?: AuditLogger;
  authorizationService?: AuthorizationService;
  prisma?: CourseForumPrismaClient;
  sessionService?: SessionService;
}

const GENERAL_CATEGORY_NAME = 'Γενικές ερωτήσεις μαθήματος';

interface ForumThreadAuthorRecord {
  id: string;
  fullName: string;
  role: UserRole;
}

interface ForumPostRecord {
  id: string;
  threadId: string;
  body: string;
  isVerified: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: ForumThreadAuthorRecord;
}

interface ForumThreadListRecord {
  id: string;
  courseId: string;
  documentId: string | null;
  annotationId: string | null;
  title: string;
  status: ForumThreadStatus;
  visibility: string;
  pageNumberSnapshot: number | null;
  selectedTextSnapshot: string | null;
  documentTitleSnapshot: string | null;
  verifiedPostId: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: { kind: ForumCategoryKind };
  author: ForumThreadAuthorRecord;
  posts: { createdAt: Date }[];
  _count: { posts: number };
}

interface ForumThreadDetailRecord extends Omit<ForumThreadListRecord, 'posts'> {
  annotation: { body: string | null } | null;
  posts: ForumPostRecord[];
}

interface ForumThreadCoreRecord {
  id: string;
  courseId: string;
  authorId: string;
  visibility: string;
  status: ForumThreadStatus;
  verifiedPostId: string | null;
}

interface ForumPostCoreRecord {
  id: string;
  threadId: string;
  authorId: string;
  isDeleted: boolean;
  author: { role: UserRole };
}

export function createCourseForumRouter(
  options: CourseForumRouteOptions = {},
): Router {
  const router = Router({ mergeParams: true });
  const prisma = options.prisma ?? defaultPrisma;
  const auditLogger = options.auditLogger ?? createAuditLogger();
  const authorization =
    options.authorizationService ??
    createAuthorizationService({ auditLogger, prisma });
  const gateOptions: AuthorizationMiddlewareOptions = {
    auditLogger,
    sessionService: options.sessionService,
  };

  router.get(
    '/threads',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({
      params: CourseIdParamsSchema,
      query: ForumThreadListQuerySchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      const { filter, documentId } =
        request.query as unknown as ForumThreadListQuery;
      const actor = request.currentSession!.user;
      await authorization.assertCourseAccess(
        actor,
        courseId,
        requestContext(request),
      );

      const payload: ForumThreadsResponse = {
        data: await listForumThreads(
          prisma,
          courseId,
          actor.id,
          actor.role,
          filter,
          documentId,
        ),
      };

      sendJson(response, 200, ForumThreadsResponseSchema, payload);
    }),
  );

  router.post(
    '/threads',
    requireRole(['professor', 'student'], gateOptions),
    validateRequest({
      body: CreateForumThreadRequestSchema,
      params: CourseIdParamsSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      const input = request.body as CreateForumThreadRequest;
      const actor = request.currentSession!.user;
      await authorization.assertCourseAccess(
        actor,
        courseId,
        requestContext(request),
      );

      const threadId = await createGeneralForumThread(
        prisma,
        courseId,
        actor.id,
        input,
      );

      const payload: ForumThreadResponse = {
        data: await getForumThreadDetailOrThrow(
          prisma,
          courseId,
          threadId,
          actor.id,
          actor.role,
        ),
      };

      sendJson(response, 201, ForumThreadResponseSchema, payload);
    }),
  );

  router.get(
    '/threads/:threadId',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({ params: ForumThreadIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId, threadId } = request.params as {
        courseId: string;
        threadId: string;
      };
      const actor = request.currentSession!.user;
      await authorization.assertCourseAccess(
        actor,
        courseId,
        requestContext(request),
      );

      const payload: ForumThreadResponse = {
        data: await getForumThreadDetailOrThrow(
          prisma,
          courseId,
          threadId,
          actor.id,
          actor.role,
        ),
      };

      sendJson(response, 200, ForumThreadResponseSchema, payload);
    }),
  );

  router.patch(
    '/threads/:threadId',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({
      body: UpdateForumThreadRequestSchema,
      params: ForumThreadIdParamsSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId, threadId } = request.params as {
        courseId: string;
        threadId: string;
      };
      const input = request.body as UpdateForumThreadRequest;
      const actor = request.currentSession!.user;
      await authorization.assertCourseAccess(
        actor,
        courseId,
        requestContext(request),
      );

      const thread = await getForumThreadCoreOrThrow(
        prisma,
        courseId,
        threadId,
        actor.id,
        actor.role,
      );
      await assertThreadEditRights(prisma, thread, actor.id, actor.role);

      await prisma.forumThread.update({
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.visibility !== undefined
            ? { visibility: input.visibility }
            : {}),
        },
        where: { id: threadId },
      });

      const payload: ForumThreadResponse = {
        data: await getForumThreadDetailOrThrow(
          prisma,
          courseId,
          threadId,
          actor.id,
          actor.role,
        ),
      };

      sendJson(response, 200, ForumThreadResponseSchema, payload);
    }),
  );

  router.delete(
    '/threads/:threadId',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({ params: ForumThreadIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId, threadId } = request.params as {
        courseId: string;
        threadId: string;
      };
      const actor = request.currentSession!.user;
      await authorization.assertCourseAccess(
        actor,
        courseId,
        requestContext(request),
      );

      const thread = await getForumThreadCoreOrThrow(
        prisma,
        courseId,
        threadId,
        actor.id,
        actor.role,
      );
      await assertThreadEditRights(prisma, thread, actor.id, actor.role);

      await prisma.forumThread.update({
        data: { archivedAt: new Date(), status: 'archived' },
        where: { id: threadId },
      });

      response.status(204).send();
    }),
  );

  router.post(
    '/threads/:threadId/posts',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({
      body: CreateForumPostRequestSchema,
      params: ForumThreadIdParamsSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId, threadId } = request.params as {
        courseId: string;
        threadId: string;
      };
      const input = request.body as CreateForumPostRequest;
      const actor = request.currentSession!.user;
      await authorization.assertCourseAccess(
        actor,
        courseId,
        requestContext(request),
      );

      const thread = await getForumThreadCoreOrThrow(
        prisma,
        courseId,
        threadId,
        actor.id,
        actor.role,
      );

      await prisma.$transaction(async (transaction) => {
        await transaction.forumPost.create({
          data: {
            authorId: actor.id,
            body: input.body.trim(),
            threadId,
          },
        });

        if (
          (actor.role === 'admin' || actor.role === 'professor') &&
          thread.status === 'open'
        ) {
          await transaction.forumThread.update({
            data: { status: 'instructor_answered' },
            where: { id: threadId },
          });
        }
      });

      const payload: ForumThreadResponse = {
        data: await getForumThreadDetailOrThrow(
          prisma,
          courseId,
          threadId,
          actor.id,
          actor.role,
        ),
      };

      sendJson(response, 201, ForumThreadResponseSchema, payload);
    }),
  );

  router.patch(
    '/threads/:threadId/posts/:postId',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({
      body: UpdateForumPostRequestSchema,
      params: ForumPostIdParamsSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId, threadId, postId } = request.params as {
        courseId: string;
        threadId: string;
        postId: string;
      };
      const input = request.body as UpdateForumPostRequest;
      const actor = request.currentSession!.user;
      await authorization.assertCourseAccess(
        actor,
        courseId,
        requestContext(request),
      );
      await getForumThreadCoreOrThrow(
        prisma,
        courseId,
        threadId,
        actor.id,
        actor.role,
      );
      const post = await getForumPostOrThrow(prisma, threadId, postId);
      assertPostOwner(post, actor.id);

      await prisma.forumPost.update({
        data: { body: input.body.trim() },
        where: { id: postId },
      });

      const payload: ForumThreadResponse = {
        data: await getForumThreadDetailOrThrow(
          prisma,
          courseId,
          threadId,
          actor.id,
          actor.role,
        ),
      };

      sendJson(response, 200, ForumThreadResponseSchema, payload);
    }),
  );

  router.delete(
    '/threads/:threadId/posts/:postId',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({ params: ForumPostIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId, threadId, postId } = request.params as {
        courseId: string;
        threadId: string;
        postId: string;
      };
      const actor = request.currentSession!.user;
      await authorization.assertCourseAccess(
        actor,
        courseId,
        requestContext(request),
      );
      const thread = await getForumThreadCoreOrThrow(
        prisma,
        courseId,
        threadId,
        actor.id,
        actor.role,
      );
      const post = await getForumPostOrThrow(prisma, threadId, postId);
      assertPostOwner(post, actor.id);

      await prisma.$transaction(async (transaction) => {
        await transaction.forumPost.update({
          data: { isDeleted: true },
          where: { id: postId },
        });

        if (thread.verifiedPostId === postId) {
          await transaction.forumThread.update({
            data: { verifiedPostId: null },
            where: { id: threadId },
          });
          await recomputeThreadStatus(transaction, threadId);
        }
      });

      response.status(204).send();
    }),
  );

  router.patch(
    '/threads/:threadId/posts/:postId/verify',
    requireRole(['admin', 'professor'], gateOptions),
    validateRequest({ params: ForumPostIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId, threadId, postId } = request.params as {
        courseId: string;
        threadId: string;
        postId: string;
      };
      const actor = request.currentSession!.user;
      await authorization.assertCourseAccess(
        actor,
        courseId,
        requestContext(request),
      );
      await getForumThreadCoreOrThrow(
        prisma,
        courseId,
        threadId,
        actor.id,
        actor.role,
      );
      if (!(await isCourseInstructor(prisma, actor.id, actor.role, courseId))) {
        throw forumThreadForbidden(threadId);
      }

      const post = await getForumPostOrThrow(prisma, threadId, postId);
      if (!['admin', 'professor'].includes(post.author.role)) {
        throw forumPostNotFound(threadId, postId);
      }

      await prisma.$transaction(async (transaction) => {
        await transaction.forumPost.update({
          data: { isVerified: true },
          where: { id: postId },
        });
        await transaction.forumThread.update({
          data: { status: 'verified', verifiedPostId: postId },
          where: { id: threadId },
        });
      });

      const payload: ForumThreadResponse = {
        data: await getForumThreadDetailOrThrow(
          prisma,
          courseId,
          threadId,
          actor.id,
          actor.role,
        ),
      };

      sendJson(response, 200, ForumThreadResponseSchema, payload);
    }),
  );

  router.patch(
    '/threads/:threadId/resolve',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({ params: ForumThreadIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId, threadId } = request.params as {
        courseId: string;
        threadId: string;
      };
      const actor = request.currentSession!.user;
      await authorization.assertCourseAccess(
        actor,
        courseId,
        requestContext(request),
      );

      const thread = await getForumThreadCoreOrThrow(
        prisma,
        courseId,
        threadId,
        actor.id,
        actor.role,
      );
      await assertThreadEditRights(prisma, thread, actor.id, actor.role);

      await prisma.forumThread.update({
        data: { resolvedAt: new Date(), status: 'resolved' },
        where: { id: threadId },
      });

      const payload: ForumThreadResponse = {
        data: await getForumThreadDetailOrThrow(
          prisma,
          courseId,
          threadId,
          actor.id,
          actor.role,
        ),
      };

      sendJson(response, 200, ForumThreadResponseSchema, payload);
    }),
  );

  router.patch(
    '/threads/:threadId/reopen',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({ params: ForumThreadIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId, threadId } = request.params as {
        courseId: string;
        threadId: string;
      };
      const actor = request.currentSession!.user;
      await authorization.assertCourseAccess(
        actor,
        courseId,
        requestContext(request),
      );

      const thread = await getForumThreadCoreOrThrow(
        prisma,
        courseId,
        threadId,
        actor.id,
        actor.role,
      );
      await assertThreadEditRights(prisma, thread, actor.id, actor.role);

      if (thread.status !== 'resolved') {
        throw new HttpError(
          409,
          'Only a resolved discussion can be reopened.',
          { threadId },
          'FORUM_THREAD_NOT_RESOLVED',
        );
      }

      await prisma.$transaction(async (transaction) => {
        await transaction.forumThread.update({
          data: { resolvedAt: null },
          where: { id: threadId },
        });
        await recomputeThreadStatus(transaction, threadId);
      });

      const payload: ForumThreadResponse = {
        data: await getForumThreadDetailOrThrow(
          prisma,
          courseId,
          threadId,
          actor.id,
          actor.role,
        ),
      };

      sendJson(response, 200, ForumThreadResponseSchema, payload);
    }),
  );

  return router;
}

async function listForumThreads(
  prisma: CourseForumPrismaClient,
  courseId: string,
  actorId: string,
  role: UserRole,
  filter: ForumThreadFilter,
  documentId: string | undefined,
): Promise<ForumThreadListItem[]> {
  const threads = await prisma.forumThread.findMany({
    include: forumThreadListInclude(),
    orderBy: [{ updatedAt: 'desc' }],
    where: {
      courseId,
      status: { not: 'archived' },
      OR: forumThreadVisibilityWhere(actorId, role),
      ...(documentId ? { documentId } : {}),
      ...forumThreadFilterWhere(filter),
    },
  });

  return (threads as ForumThreadListRecord[]).map(toForumThreadListItem);
}

function forumThreadFilterWhere(
  filter: ForumThreadFilter,
): Prisma.ForumThreadWhereInput {
  switch (filter) {
    case 'general':
      return { documentId: null };
    case 'document':
      return { documentId: { not: null } };
    case 'unanswered':
      return { status: 'open' };
    case 'resolved':
      return { status: 'resolved' };
    case 'all':
    default:
      return {};
  }
}

async function createGeneralForumThread(
  prisma: CourseForumPrismaClient,
  courseId: string,
  actorId: string,
  input: CreateForumThreadRequest,
): Promise<string> {
  return await prisma.$transaction(async (transaction) => {
    const category = await transaction.forumCategory.upsert({
      create: {
        courseId,
        description:
          'Γενικές συζητήσεις μαθήματος, χωρίς σύνδεση με συγκεκριμένο έγγραφο.',
        kind: 'general',
        name: GENERAL_CATEGORY_NAME,
        orderIndex: 0,
      },
      update: { isVisible: true, kind: 'general' },
      where: {
        courseId_name: { courseId, name: GENERAL_CATEGORY_NAME },
      },
    });

    const thread = await transaction.forumThread.create({
      data: {
        authorId: actorId,
        categoryId: category.id,
        courseId,
        status: 'open',
        title: input.title.trim(),
        visibility: input.visibility,
      },
      select: { id: true },
    });

    await transaction.forumPost.create({
      data: {
        authorId: actorId,
        body: input.body.trim(),
        threadId: thread.id,
      },
    });

    return thread.id;
  });
}

async function getForumThreadDetailOrThrow(
  prisma: CourseForumPrismaClient,
  courseId: string,
  threadId: string,
  actorId: string,
  role: UserRole,
): Promise<ForumThreadDetail> {
  const thread = await prisma.forumThread.findFirst({
    include: forumThreadDetailInclude(),
    where: {
      courseId,
      id: threadId,
      status: { not: 'archived' },
      OR: forumThreadVisibilityWhere(actorId, role),
    },
  });

  if (!thread) throw forumThreadNotFound(courseId, threadId);
  return toForumThreadDetail(thread as ForumThreadDetailRecord);
}

async function getForumThreadCoreOrThrow(
  prisma: CourseForumPrismaClient,
  courseId: string,
  threadId: string,
  actorId: string,
  role: UserRole,
): Promise<ForumThreadCoreRecord> {
  const thread = await prisma.forumThread.findFirst({
    select: {
      authorId: true,
      courseId: true,
      id: true,
      status: true,
      verifiedPostId: true,
      visibility: true,
    },
    where: {
      courseId,
      id: threadId,
      status: { not: 'archived' },
      OR: forumThreadVisibilityWhere(actorId, role),
    },
  });

  if (!thread) throw forumThreadNotFound(courseId, threadId);
  return thread;
}

async function getForumPostOrThrow(
  prisma: CourseForumPrismaClient,
  threadId: string,
  postId: string,
): Promise<ForumPostCoreRecord> {
  const post = await prisma.forumPost.findFirst({
    include: { author: { select: { role: true } } },
    where: { id: postId, isDeleted: false, threadId },
  });

  if (!post) throw forumPostNotFound(threadId, postId);
  return post;
}

async function assertThreadEditRights(
  prisma: CourseForumPrismaClient,
  thread: ForumThreadCoreRecord,
  actorId: string,
  role: UserRole,
): Promise<void> {
  if (thread.authorId === actorId) return;
  if (await isCourseInstructor(prisma, actorId, role, thread.courseId)) return;
  throw forumThreadForbidden(thread.id);
}

function assertPostOwner(post: ForumPostCoreRecord, actorId: string): void {
  if (post.authorId !== actorId) {
    throw new HttpError(
      403,
      'Only the reply author can modify this reply.',
      { postId: post.id },
      'FORUM_POST_FORBIDDEN',
    );
  }
}

function forumThreadListInclude() {
  return {
    author: { select: { fullName: true, id: true, role: true } },
    category: { select: { kind: true } },
    posts: {
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
      take: 1,
      where: { isDeleted: false },
    },
    _count: { select: { posts: { where: { isDeleted: false } } } },
  } satisfies Prisma.ForumThreadInclude;
}

function forumThreadDetailInclude() {
  return {
    annotation: { select: { body: true } },
    author: { select: { fullName: true, id: true, role: true } },
    category: { select: { kind: true } },
    posts: {
      include: { author: { select: { fullName: true, id: true, role: true } } },
      orderBy: { createdAt: 'asc' },
      where: { isDeleted: false },
    },
    _count: { select: { posts: { where: { isDeleted: false } } } },
  } satisfies Prisma.ForumThreadInclude;
}

function toForumThreadAuthor(
  author: ForumThreadAuthorRecord,
): ForumThreadAuthor {
  return { id: author.id, fullName: author.fullName, role: author.role };
}

function toForumPost(post: ForumPostRecord): ForumPost {
  return {
    id: post.id,
    threadId: post.threadId,
    author: toForumThreadAuthor(post.author),
    body: post.body,
    isVerified: post.isVerified,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

function toForumThreadListItem(
  thread: ForumThreadListRecord,
): ForumThreadListItem {
  const lastPost = thread.posts[0];

  return {
    id: thread.id,
    courseId: thread.courseId,
    categoryKind: thread.category.kind,
    documentId: thread.documentId,
    annotationId: thread.annotationId,
    title: thread.title,
    status: thread.status,
    visibility: thread.visibility as 'public' | 'instructor_only',
    pageNumber: thread.pageNumberSnapshot,
    selectedText: thread.selectedTextSnapshot,
    documentTitle: thread.documentTitleSnapshot,
    author: toForumThreadAuthor(thread.author),
    postCount: thread._count.posts,
    verifiedPostId: thread.verifiedPostId,
    lastPostAt: lastPost ? lastPost.createdAt.toISOString() : null,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
  };
}

function toForumThreadDetail(thread: ForumThreadDetailRecord): ForumThreadDetail {
  return {
    ...toForumThreadListItem({
      ...thread,
      posts: thread.posts.map((post) => ({ createdAt: post.createdAt })),
    }),
    openingBody: thread.annotation?.body ?? null,
    posts: thread.posts.map(toForumPost),
  };
}

function forumThreadNotFound(courseId: string, threadId: string): HttpError {
  return new HttpError(
    404,
    'Discussion not found',
    { courseId, threadId },
    'FORUM_THREAD_NOT_FOUND',
  );
}

function forumThreadForbidden(threadId: string): HttpError {
  return new HttpError(
    403,
    'Only the discussion creator or an instructor can perform this action.',
    { threadId },
    'FORUM_THREAD_FORBIDDEN',
  );
}

function forumPostNotFound(threadId: string, postId: string): HttpError {
  return new HttpError(
    404,
    'Reply not found',
    { postId, threadId },
    'FORUM_POST_NOT_FOUND',
  );
}

function requestContext(request: Request) {
  return {
    method: request.method,
    route: request.originalUrl,
  };
}
