import { createHash, randomUUID } from 'node:crypto';

import { Router, type Request } from 'express';
import multer, { MulterError } from 'multer';
import { PDFDocument } from 'pdf-lib';
import type {
  AnnotationType,
  AnnotationVisibility,
  DocumentStatus,
  DocumentVisibility,
  ForumCategoryKind,
  ForumThreadStatus,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import {
  CourseDocumentAnnotationIdParamsSchema,
  CourseDocumentIdParamsSchema,
  CourseDocumentAnnotationResponseSchema,
  CourseDocumentAnnotationsResponseSchema,
  CourseDocumentResponseSchema,
  CourseDocumentsResponseSchema,
  CourseIdParamsSchema,
  CreateCourseDocumentAnnotationRequestSchema,
  CreateCourseDocumentRequestSchema,
  MAX_COURSE_DOCUMENT_UPLOAD_BYTES,
  UpdateCourseDocumentAnnotationRequestSchema,
  UpdateCourseDocumentMetadataRequestSchema,
  type CourseDocumentAnnotation,
  type CourseDocumentAnnotationResponse,
  type CourseDocumentAnnotationsResponse,
  type CourseDocumentMetadata,
  type CourseDocumentResponse,
  type CourseDocumentsResponse,
  type CreateCourseDocumentAnnotationRequest,
  type CreateCourseDocumentRequest,
  type ForumThreadAuthor,
  type ForumThreadListItem,
  type StudentDocumentActivitySummaryResponse,
  type UpdateCourseDocumentAnnotationRequest,
  type UpdateCourseDocumentMetadataRequest,
  StudentDocumentActivitySummaryResponseSchema,
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
import { HttpError } from '../lib/http-error.js';
import { prisma as defaultPrisma } from '../lib/prisma.js';
import { validateRequest } from '../lib/request-validation.js';
import { sendJson } from '../lib/send-json.js';
import {
  createStorageService,
  type StorageService,
} from '../storage/storage-service.js';

type CourseDocumentsPrismaClient = Pick<
  PrismaClient,
  | '$transaction'
  | 'annotation'
  | 'annotationTarget'
  | 'course'
  | 'courseInstructor'
  | 'document'
  | 'enrollment'
  | 'forumCategory'
  | 'forumThread'
>;

type CourseDocumentsTransactionClient = Pick<
  Prisma.TransactionClient,
  'annotation' | 'annotationTarget' | 'forumCategory' | 'forumThread'
>;

export interface CourseDocumentsRouteOptions {
  auditLogger?: AuditLogger;
  authorizationService?: AuthorizationService;
  maxUploadBytes?: number;
  prisma?: CourseDocumentsPrismaClient;
  sessionService?: SessionService;
  storageService?: StorageService;
}

const PDF_MAGIC_BYTES = Buffer.from('%PDF-', 'ascii');
const DOCUMENT_DISCUSSION_CATEGORY_NAME = 'Συζητήσεις εγγράφων';
const QUESTION_THREAD_TITLE_MAX_LENGTH = 120;

interface CourseDocumentRecord {
  checksumSha256?: string | null;
  courseId?: string;
  createdAt: Date;
  description: string | null;
  fileSizeBytes: bigint | number | null;
  id: string;
  mimeType: string | null;
  originalFilename: string | null;
  pageCount: number | null;
  status: DocumentStatus;
  title: string;
  updatedAt: Date;
  visibility: DocumentVisibility;
}

interface CourseDocumentAnnotationRecord {
  id: string;
  courseId: string;
  documentId: string;
  type: AnnotationType;
  visibility: AnnotationVisibility;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  target: {
    id: string;
    pageNumber: number;
    selectedText: string | null;
  };
  author: {
    id: string;
    fullName: string;
    role: UserRole;
  };
}

interface DocumentThreadSummaryRecord {
  id: string;
  courseId: string;
  documentId: string | null;
  annotationId: string | null;
  title: string;
  status: ForumThreadStatus;
  visibility: AnnotationVisibility;
  pageNumberSnapshot: number | null;
  selectedTextSnapshot: string | null;
  documentTitleSnapshot: string | null;
  verifiedPostId: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: { kind: ForumCategoryKind };
  author: {
    id: string;
    fullName: string;
    role: UserRole;
  };
  posts: { createdAt: Date }[];
  _count: { posts: number };
}

export function createCourseDocumentsRouter(
  options: CourseDocumentsRouteOptions = {},
): Router {
  const router = Router({ mergeParams: true });
  const prisma = options.prisma ?? defaultPrisma;
  const auditLogger = options.auditLogger ?? createAuditLogger();
  const authorization =
    options.authorizationService ??
    createAuthorizationService({ auditLogger, prisma });
  const storageService = options.storageService ?? createStorageService();
  const maxUploadBytes =
    options.maxUploadBytes ?? MAX_COURSE_DOCUMENT_UPLOAD_BYTES;
  const gateOptions: AuthorizationMiddlewareOptions = {
    auditLogger,
    sessionService: options.sessionService,
  };
  const upload = multer({
    limits: { fileSize: maxUploadBytes, files: 1 },
    storage: multer.memoryStorage(),
  });

  router.get(
    '/',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({ params: CourseIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      await authorization.assertCourseAccess(
        request.currentSession!.user,
        courseId,
        requestContext(request),
      );

      const payload: CourseDocumentsResponse = {
        data: await listCourseDocuments(
          prisma,
          courseId,
          request.currentSession!.user.role,
        ),
      };

      sendJson(response, 200, CourseDocumentsResponseSchema, payload);
    }),
  );

  router.post(
    '/',
    requireRole(['admin', 'professor'], gateOptions),
    parseDocumentUpload(upload),
    validateRequest({
      body: CreateCourseDocumentRequestSchema,
      params: CourseIdParamsSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      const input = request.body as CreateCourseDocumentRequest;
      const file = requireUploadedPdf(request);
      await authorization.assertCourseAccess(
        request.currentSession!.user,
        courseId,
        requestContext(request),
      );

      const document = await createCourseDocument(
        prisma,
        storageService,
        courseId,
        request.currentSession!.user.id,
        input,
        file,
      );

      await auditLogger.logAuditEvent({
        action: 'document.uploaded',
        actorId: request.currentSession!.user.id,
        entityId: document.id,
        entityType: 'document',
        metadata: { courseId, originalFilename: document.originalFilename },
      });

      const payload: CourseDocumentResponse = {
        data: toCourseDocumentMetadata(document),
      };

      sendJson(response, 201, CourseDocumentResponseSchema, payload);
    }),
  );

  router.get(
    '/activity',
    requireRole(['student'], gateOptions),
    validateRequest({ params: CourseIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      const actor = request.currentSession!.user;
      await authorization.assertCourseAccess(
        actor,
        courseId,
        requestContext(request),
      );

      const payload: StudentDocumentActivitySummaryResponse = {
        data: await getStudentDocumentActivitySummary(
          prisma,
          courseId,
          actor.id,
        ),
      };

      sendJson(
        response,
        200,
        StudentDocumentActivitySummaryResponseSchema,
        payload,
      );
    }),
  );

  router.get(
    '/:documentId',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({ params: CourseDocumentIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId, documentId } = request.params as {
        courseId: string;
        documentId: string;
      };
      await authorization.assertCourseAccess(
        request.currentSession!.user,
        courseId,
        requestContext(request),
      );

      const payload: CourseDocumentResponse = {
        data: toCourseDocumentMetadata(
          await getCourseDocumentOrThrow(
            prisma,
            courseId,
            documentId,
            request.currentSession!.user.role,
          ),
        ),
      };

      sendJson(response, 200, CourseDocumentResponseSchema, payload);
    }),
  );

  router.get(
    '/:documentId/annotations',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({ params: CourseDocumentIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId, documentId } = request.params as {
        courseId: string;
        documentId: string;
      };
      await getCourseDocumentOrThrow(
        prisma,
        courseId,
        documentId,
        request.currentSession!.user.role,
      );
      await authorization.assertDocumentAccess(
        request.currentSession!.user,
        documentId,
        requestContext(request),
      );

      const payload: CourseDocumentAnnotationsResponse = {
        data: await listCourseDocumentAnnotations(
          prisma,
          courseId,
          documentId,
          request.currentSession!.user.id,
          request.currentSession!.user.role,
        ),
      };

      sendJson(response, 200, CourseDocumentAnnotationsResponseSchema, payload);
    }),
  );

  router.post(
    '/:documentId/annotations',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({
      body: CreateCourseDocumentAnnotationRequestSchema,
      params: CourseDocumentIdParamsSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId, documentId } = request.params as {
        courseId: string;
        documentId: string;
      };
      const input = request.body as CreateCourseDocumentAnnotationRequest;
      const document = await getCourseDocumentOrThrow(
        prisma,
        courseId,
        documentId,
        request.currentSession!.user.role,
      );
      await authorization.assertDocumentAccess(
        request.currentSession!.user,
        documentId,
        requestContext(request),
      );
      validateAnnotationPage(input.pageNumber, document.pageCount);

      const annotation = await createCourseDocumentAnnotation(
        prisma,
        courseId,
        documentId,
        request.currentSession!.user.id,
        input,
        document,
      );

      const payload: CourseDocumentAnnotationResponse = {
        data: toCourseDocumentAnnotation(annotation),
      };

      sendJson(response, 201, CourseDocumentAnnotationResponseSchema, payload);
    }),
  );

  router.patch(
    '/:documentId/annotations/:annotationId',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({
      body: UpdateCourseDocumentAnnotationRequestSchema,
      params: CourseDocumentAnnotationIdParamsSchema,
    }),
    asyncHandler(async (request, response) => {
      const { annotationId, courseId, documentId } = request.params as {
        annotationId: string;
        courseId: string;
        documentId: string;
      };
      const input = request.body as UpdateCourseDocumentAnnotationRequest;
      const document = await getCourseDocumentOrThrow(
        prisma,
        courseId,
        documentId,
        request.currentSession!.user.role,
      );
      await authorization.assertDocumentAccess(
        request.currentSession!.user,
        documentId,
        requestContext(request),
      );

      const annotation = await getCourseDocumentAnnotationOrThrow(
        prisma,
        courseId,
        documentId,
        annotationId,
      );
      assertAnnotationOwner(annotation, request.currentSession!.user.id);

      const payload: CourseDocumentAnnotationResponse = {
        data: toCourseDocumentAnnotation(
          await updateCourseDocumentAnnotation(
            prisma,
            annotationId,
            request.currentSession!.user.id,
            input,
            document,
          ),
        ),
      };

      sendJson(response, 200, CourseDocumentAnnotationResponseSchema, payload);
    }),
  );

  router.delete(
    '/:documentId/annotations/:annotationId',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({ params: CourseDocumentAnnotationIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { annotationId, courseId, documentId } = request.params as {
        annotationId: string;
        courseId: string;
        documentId: string;
      };
      await getCourseDocumentOrThrow(
        prisma,
        courseId,
        documentId,
        request.currentSession!.user.role,
      );
      await authorization.assertDocumentAccess(
        request.currentSession!.user,
        documentId,
        requestContext(request),
      );

      const annotation = await getCourseDocumentAnnotationOrThrow(
        prisma,
        courseId,
        documentId,
        annotationId,
      );
      assertAnnotationOwner(annotation, request.currentSession!.user.id);
      await deleteCourseDocumentAnnotation(prisma, annotationId);

      response.status(204).send();
    }),
  );

  router.get(
    '/:documentId/content',
    requireRole(['admin', 'professor', 'student'], gateOptions),
    validateRequest({ params: CourseDocumentIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId, documentId } = request.params as {
        courseId: string;
        documentId: string;
      };
      await authorization.assertCourseAccess(
        request.currentSession!.user,
        courseId,
        requestContext(request),
      );

      const document = await getCourseDocumentContentOrThrow(
        prisma,
        courseId,
        documentId,
        request.currentSession!.user.role,
      );

      let object;
      try {
        object = await storageService.getObject(document.objectKey!);
      } catch (error) {
        console.error('Failed to read document content from storage', {
          documentId,
          error,
        });
        throw new HttpError(
          502,
          'Document content is currently unavailable.',
          undefined,
          'DOCUMENT_CONTENT_UNAVAILABLE',
        );
      }

      response.setHeader(
        'Content-Type',
        document.mimeType ?? 'application/pdf',
      );
      response.setHeader('Content-Length', String(object.body.byteLength));
      response.setHeader(
        'Content-Disposition',
        buildContentDisposition(document.originalFilename),
      );
      response.setHeader('Cache-Control', 'private, no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.status(200).send(Buffer.from(object.body));
    }),
  );

  router.patch(
    '/:documentId',
    requireRole(['admin', 'professor'], gateOptions),
    validateRequest({
      body: UpdateCourseDocumentMetadataRequestSchema,
      params: CourseDocumentIdParamsSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId, documentId } = request.params as {
        courseId: string;
        documentId: string;
      };
      const input = request.body as UpdateCourseDocumentMetadataRequest;
      await authorization.assertCourseAccess(
        request.currentSession!.user,
        courseId,
        requestContext(request),
      );
      await getCourseDocumentOrThrow(
        prisma,
        courseId,
        documentId,
        request.currentSession!.user.role,
      );

      const document = await updateCourseDocumentMetadata(
        prisma,
        documentId,
        request.currentSession!.user.id,
        input,
      );

      const payload: CourseDocumentResponse = {
        data: toCourseDocumentMetadata(document),
      };

      sendJson(response, 200, CourseDocumentResponseSchema, payload);
    }),
  );

  return router;
}

async function getStudentDocumentActivitySummary(
  prisma: CourseDocumentsPrismaClient,
  courseId: string,
  actorId: string,
) {
  const [annotations, openQuestions, verifiedAnswers] = await Promise.all([
    prisma.annotation.findMany({
      include: courseDocumentAnnotationInclude(),
      orderBy: [{ createdAt: 'desc' }],
      take: 6,
      where: {
        authorId: actorId,
        courseId,
        document: {
          is: {
            status: 'active',
            visibility: 'visible_to_students',
          },
        },
        isDeleted: false,
      },
    }),
    prisma.forumThread.findMany({
      include: documentThreadSummaryInclude(),
      orderBy: [{ updatedAt: 'desc' }],
      take: 5,
      where: {
        authorId: actorId,
        courseId,
        documentId: { not: null },
        document: {
          is: {
            status: 'active',
            visibility: 'visible_to_students',
          },
        },
        status: { in: ['open', 'instructor_answered'] },
        visibility: { in: ['public', 'instructor_only'] },
      },
    }),
    prisma.forumThread.findMany({
      include: documentThreadSummaryInclude(),
      orderBy: [{ updatedAt: 'desc' }],
      take: 5,
      where: {
        authorId: actorId,
        courseId,
        documentId: { not: null },
        document: {
          is: {
            status: 'active',
            visibility: 'visible_to_students',
          },
        },
        status: 'verified',
        visibility: { in: ['public', 'instructor_only'] },
      },
    }),
  ]);

  return {
    annotations: (annotations as CourseDocumentAnnotationRecord[]).map(
      toCourseDocumentAnnotation,
    ),
    openQuestions: (openQuestions as DocumentThreadSummaryRecord[]).map(
      toForumThreadListItem,
    ),
    verifiedAnswers: (verifiedAnswers as DocumentThreadSummaryRecord[]).map(
      toForumThreadListItem,
    ),
  };
}

async function listCourseDocuments(
  prisma: CourseDocumentsPrismaClient,
  courseId: string,
  role: UserRole,
): Promise<CourseDocumentMetadata[]> {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: 'asc' },
    select: courseDocumentSelect(),
    where: courseDocumentWhere(courseId, role),
  });

  return (documents as CourseDocumentRecord[]).map(toCourseDocumentMetadata);
}

async function listCourseDocumentAnnotations(
  prisma: CourseDocumentsPrismaClient,
  courseId: string,
  documentId: string,
  actorId: string,
  role: UserRole,
): Promise<CourseDocumentAnnotation[]> {
  const annotations = await prisma.annotation.findMany({
    include: courseDocumentAnnotationInclude(),
    orderBy: [{ createdAt: 'desc' }],
    where: {
      courseId,
      documentId,
      isDeleted: false,
      OR: annotationVisibilityWhere(actorId, role),
    },
  });

  return (annotations as CourseDocumentAnnotationRecord[])
    .sort(
      (first, second) =>
        first.target.pageNumber - second.target.pageNumber ||
        second.createdAt.getTime() - first.createdAt.getTime(),
    )
    .map(toCourseDocumentAnnotation);
}

async function createCourseDocumentAnnotation(
  prisma: CourseDocumentsPrismaClient,
  courseId: string,
  documentId: string,
  actorId: string,
  input: CreateCourseDocumentAnnotationRequest,
  document: CourseDocumentRecord,
): Promise<CourseDocumentAnnotationRecord> {
  const normalizedBody = input.body?.trim() || null;
  const selectedText = input.selectedText?.trim() || null;

  return await prisma.$transaction(async (transaction) => {
    const target = await transaction.annotationTarget.create({
      data: {
        documentId,
        documentTitleSnapshot: document.title,
        documentFilenameSnapshot: document.originalFilename,
        documentChecksumSnapshot: document.checksumSha256 ?? null,
        normalizedRects: [],
        pageNumber: input.pageNumber,
        selectedText,
        textQuoteExact: selectedText,
      },
      select: {
        id: true,
        pageNumber: true,
        selectedText: true,
      },
    });

    const annotation = (await transaction.annotation.create({
      data: {
        authorId: actorId,
        body: normalizedBody,
        courseId,
        documentId,
        targetId: target.id,
        type: input.type,
        visibility: input.visibility,
      },
      include: courseDocumentAnnotationInclude(),
    })) as CourseDocumentAnnotationRecord;

    if (shouldCreateQuestionThread(input.type, input.visibility)) {
      await createQuestionThread(transaction, {
        actorId,
        annotation,
        courseId,
        document,
        documentId,
        normalizedBody,
        selectedText,
      });
    }

    return annotation;
  });
}

async function createQuestionThread(
  prisma: CourseDocumentsTransactionClient,
  input: {
    actorId: string;
    annotation: CourseDocumentAnnotationRecord;
    courseId: string;
    document: CourseDocumentRecord;
    documentId: string;
    normalizedBody: string | null;
    selectedText: string | null;
  },
): Promise<void> {
  const category = await prisma.forumCategory.upsert({
    create: {
      courseId: input.courseId,
      description:
        'Νήματα που δημιουργούνται από δημόσιες ή μόνο προς διδάσκοντες ερωτήσεις σε έγγραφα.',
      kind: 'document_discussion',
      name: DOCUMENT_DISCUSSION_CATEGORY_NAME,
      orderIndex: 1,
    },
    update: {
      isVisible: true,
      kind: 'document_discussion',
    },
    where: {
      courseId_name: {
        courseId: input.courseId,
        name: DOCUMENT_DISCUSSION_CATEGORY_NAME,
      },
    },
  });

  await prisma.forumThread.create({
    data: {
      annotationId: input.annotation.id,
      authorId: input.actorId,
      categoryId: category.id,
      courseId: input.courseId,
      documentId: input.documentId,
      documentTitleSnapshot: input.document.title,
      pageNumberSnapshot: input.annotation.target.pageNumber,
      selectedTextSnapshot: input.selectedText,
      targetId: input.annotation.target.id,
      title: buildQuestionThreadTitle(input),
      visibility: input.annotation.visibility,
    },
  });
}

function shouldCreateQuestionThread(
  type: AnnotationType,
  visibility: AnnotationVisibility,
): boolean {
  return type === 'question' && visibility !== 'private';
}

function buildQuestionThreadTitle(input: {
  normalizedBody: string | null;
  selectedText: string | null;
}): string {
  const title =
    input.normalizedBody ??
    (input.selectedText ? `Ερώτηση για: ${input.selectedText}` : 'Νέα ερώτηση');

  return truncateThreadTitle(title);
}

function truncateThreadTitle(title: string): string {
  if (title.length <= QUESTION_THREAD_TITLE_MAX_LENGTH) {
    return title;
  }

  return `${title.slice(0, QUESTION_THREAD_TITLE_MAX_LENGTH - 3)}...`;
}

async function getCourseDocumentAnnotationOrThrow(
  prisma: CourseDocumentsPrismaClient,
  courseId: string,
  documentId: string,
  annotationId: string,
): Promise<CourseDocumentAnnotationRecord> {
  const annotation = await prisma.annotation.findFirst({
    include: courseDocumentAnnotationInclude(),
    where: {
      courseId,
      documentId,
      id: annotationId,
      isDeleted: false,
    },
  });

  if (!annotation) {
    throw annotationNotFound(courseId, documentId, annotationId);
  }

  return annotation as CourseDocumentAnnotationRecord;
}

async function updateCourseDocumentAnnotation(
  prisma: CourseDocumentsPrismaClient,
  annotationId: string,
  actorId: string,
  input: UpdateCourseDocumentAnnotationRequest,
  document: CourseDocumentRecord,
): Promise<CourseDocumentAnnotationRecord> {
  return await prisma.$transaction(async (transaction) => {
    const annotation = (await transaction.annotation.update({
      data: normalizeCourseDocumentAnnotationUpdateData(input),
      include: courseDocumentAnnotationInclude(),
      where: { id: annotationId },
    })) as CourseDocumentAnnotationRecord;

    if (shouldCreateQuestionThread(annotation.type, annotation.visibility)) {
      const existingThread = await transaction.forumThread.findUnique({
        where: { annotationId: annotation.id },
      });

      if (!existingThread) {
        await createQuestionThread(transaction, {
          actorId,
          annotation,
          courseId: annotation.courseId,
          document,
          documentId: annotation.documentId,
          normalizedBody: annotation.body,
          selectedText: annotation.target.selectedText,
        });
      }
    }

    return annotation;
  });
}

async function deleteCourseDocumentAnnotation(
  prisma: CourseDocumentsPrismaClient,
  annotationId: string,
): Promise<void> {
  await prisma.annotation.update({
    data: { isDeleted: true },
    where: { id: annotationId },
  });
}

function normalizeCourseDocumentAnnotationUpdateData(
  input: UpdateCourseDocumentAnnotationRequest,
): Prisma.AnnotationUpdateInput {
  const data: Prisma.AnnotationUpdateInput = {};

  if (input.type !== undefined) data.type = input.type;
  if (input.visibility !== undefined) data.visibility = input.visibility;
  if (Object.prototype.hasOwnProperty.call(input, 'body')) {
    data.body = input.body?.trim() || null;
  }

  return data;
}

function assertAnnotationOwner(
  annotation: CourseDocumentAnnotationRecord,
  actorId: string,
): void {
  if (annotation.author.id !== actorId) {
    throw new HttpError(
      403,
      'Only the annotation creator can modify this annotation.',
      { annotationId: annotation.id },
      'ANNOTATION_FORBIDDEN',
    );
  }
}

function annotationVisibilityWhere(
  actorId: string,
  role: UserRole,
): Prisma.AnnotationWhereInput[] {
  return [
    { visibility: 'public' },
    { authorId: actorId, visibility: 'private' },
    ...(role === 'admin' || role === 'professor'
      ? [{ visibility: 'instructor_only' as const }]
      : [{ authorId: actorId, visibility: 'instructor_only' as const }]),
  ];
}

function validateAnnotationPage(
  pageNumber: number,
  pageCount: number | null,
): void {
  if (pageCount !== null && pageNumber > pageCount) {
    throw new HttpError(
      400,
      'Annotation page is outside the document page range.',
      { pageCount, pageNumber },
      'ANNOTATION_PAGE_OUT_OF_RANGE',
    );
  }
}

async function createCourseDocument(
  prisma: CourseDocumentsPrismaClient,
  storageService: StorageService,
  courseId: string,
  actorId: string,
  input: CreateCourseDocumentRequest,
  file: Express.Multer.File,
): Promise<CourseDocumentRecord> {
  const documentId = randomUUID();
  const objectKey = `courses/${courseId}/documents/${documentId}.pdf`;
  const pageCount = await readPdfPageCount(file.buffer);
  const checksumSha256 = createHash('sha256').update(file.buffer).digest('hex');

  await storageService.putObject({
    body: file.buffer,
    contentLength: file.size,
    contentType: 'application/pdf',
    key: objectKey,
  });

  try {
    return (await prisma.document.create({
      data: {
        id: documentId,
        checksumSha256,
        courseId,
        createdById: actorId,
        description: input.description ?? null,
        fileSizeBytes: BigInt(file.size),
        mimeType: 'application/pdf',
        objectKey,
        originalFilename: sanitizeOriginalFilename(file.originalname),
        pageCount,
        title: input.title,
        updatedById: actorId,
        visibility: input.visibility,
      },
      select: courseDocumentSelect(),
    })) as CourseDocumentRecord;
  } catch (error) {
    // Avoid leaving an orphaned object in storage if the metadata write fails.
    await storageService.deleteObject(objectKey).catch(() => undefined);
    throw error;
  }
}

function parseDocumentUpload(
  upload: ReturnType<typeof multer>,
): ReturnType<typeof asyncHandler> {
  const middleware = upload.single('file');
  return asyncHandler(
    (request, response, next) =>
      new Promise<void>((resolve) => {
        middleware(request, response, (error: unknown) => {
          if (error) {
            next(translateUploadError(error));
          } else {
            next();
          }
          resolve();
        });
      }),
  );
}

function translateUploadError(error: unknown): HttpError {
  if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return new HttpError(
      413,
      'The uploaded file exceeds the maximum allowed size.',
      undefined,
      'DOCUMENT_FILE_TOO_LARGE',
    );
  }

  if (error instanceof MulterError) {
    return new HttpError(
      400,
      'The uploaded file could not be processed.',
      undefined,
      'DOCUMENT_FILE_INVALID',
    );
  }

  return new HttpError(
    400,
    'The uploaded file could not be processed.',
    undefined,
    'DOCUMENT_FILE_INVALID',
  );
}

function requireUploadedPdf(request: Request): Express.Multer.File {
  const file = request.file;

  if (!file) {
    throw new HttpError(
      400,
      'A PDF file is required.',
      undefined,
      'DOCUMENT_FILE_REQUIRED',
    );
  }

  if (
    file.mimetype !== 'application/pdf' ||
    !file.buffer.subarray(0, PDF_MAGIC_BYTES.length).equals(PDF_MAGIC_BYTES)
  ) {
    throw new HttpError(
      400,
      'The uploaded file must be a PDF document.',
      undefined,
      'DOCUMENT_FILE_INVALID',
    );
  }

  return file;
}

async function readPdfPageCount(buffer: Buffer): Promise<number> {
  try {
    const pdfDocument = await PDFDocument.load(buffer, {
      updateMetadata: false,
    });
    return pdfDocument.getPageCount();
  } catch {
    throw new HttpError(
      400,
      'The uploaded file is not a valid PDF document.',
      undefined,
      'DOCUMENT_FILE_INVALID',
    );
  }
}

function sanitizeOriginalFilename(originalname: string): string {
  const basename = originalname.split(/[/\\]/).pop() ?? originalname;
  return basename.trim().slice(0, 255) || 'document.pdf';
}

async function getCourseDocumentOrThrow(
  prisma: CourseDocumentsPrismaClient,
  courseId: string,
  documentId: string,
  role: UserRole,
): Promise<CourseDocumentRecord> {
  const document = await prisma.document.findFirst({
    select: courseDocumentSelect(),
    where: courseDocumentWhere(courseId, role, documentId),
  });

  if (!document) {
    throw documentNotFound(courseId, documentId);
  }

  return document as CourseDocumentRecord;
}

function courseDocumentWhere(
  courseId: string,
  role: UserRole,
  documentId?: string,
): Prisma.DocumentWhereInput {
  return {
    courseId,
    ...(documentId ? { id: documentId } : {}),
    ...(role === 'student'
      ? {
          status: 'active',
          visibility: 'visible_to_students',
        }
      : {}),
  };
}

interface CourseDocumentContentRecord {
  mimeType: string | null;
  objectKey: string | null;
  originalFilename: string | null;
}

async function getCourseDocumentContentOrThrow(
  prisma: CourseDocumentsPrismaClient,
  courseId: string,
  documentId: string,
  role: UserRole,
): Promise<CourseDocumentContentRecord> {
  const document = (await prisma.document.findFirst({
    select: { mimeType: true, objectKey: true, originalFilename: true },
    where: courseDocumentWhere(courseId, role, documentId),
  })) as CourseDocumentContentRecord | null;

  if (!document || !document.objectKey) {
    throw documentNotFound(courseId, documentId);
  }

  return document;
}

// Provides both an ASCII-safe fallback and an RFC 5987 UTF-8 value for non-ASCII filenames.
function buildContentDisposition(originalFilename: string | null): string {
  const safeName = (originalFilename ?? 'document.pdf').replace(/[\r\n"]/g, '');
  const asciiFallback =
    safeName.replace(/[^\x20-\x7E]/g, '_') || 'document.pdf';
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

async function updateCourseDocumentMetadata(
  prisma: CourseDocumentsPrismaClient,
  documentId: string,
  actorId: string,
  input: UpdateCourseDocumentMetadataRequest,
): Promise<CourseDocumentRecord> {
  return (await prisma.document.update({
    data: normalizeCourseDocumentUpdateData(input, actorId),
    select: courseDocumentSelect(),
    where: { id: documentId },
  })) as CourseDocumentRecord;
}

function normalizeCourseDocumentUpdateData(
  input: UpdateCourseDocumentMetadataRequest,
  actorId: string,
): Prisma.DocumentUncheckedUpdateInput {
  const data: Prisma.DocumentUncheckedUpdateInput = {
    updatedById: actorId,
  };

  if (input.title !== undefined) data.title = input.title;
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === 'deleted') data.deletedAt = new Date();
    if (input.status === 'replaced') data.replacedAt = new Date();
  }
  if (input.visibility !== undefined) data.visibility = input.visibility;
  if (Object.prototype.hasOwnProperty.call(input, 'description')) {
    data.description = input.description ?? null;
  }

  return data;
}

function courseDocumentSelect() {
  return {
    checksumSha256: true,
    courseId: true,
    createdAt: true,
    description: true,
    fileSizeBytes: true,
    id: true,
    mimeType: true,
    originalFilename: true,
    pageCount: true,
    status: true,
    title: true,
    updatedAt: true,
    visibility: true,
  } satisfies Prisma.DocumentSelect;
}

function courseDocumentAnnotationInclude() {
  return {
    author: {
      select: {
        fullName: true,
        id: true,
        role: true,
      },
    },
    target: {
      select: {
        id: true,
        pageNumber: true,
        selectedText: true,
      },
    },
  } satisfies Prisma.AnnotationInclude;
}

function documentThreadSummaryInclude() {
  return {
    author: {
      select: {
        fullName: true,
        id: true,
        role: true,
      },
    },
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

function toCourseDocumentMetadata(
  document: CourseDocumentRecord,
): CourseDocumentMetadata {
  return {
    id: document.id,
    title: document.title,
    description: document.description,
    status: document.status,
    visibility: document.visibility,
    originalFilename: document.originalFilename,
    mimeType: document.mimeType,
    fileSizeBytes:
      document.fileSizeBytes === null ? null : Number(document.fileSizeBytes),
    pageCount: document.pageCount,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function toCourseDocumentAnnotation(
  annotation: CourseDocumentAnnotationRecord,
): CourseDocumentAnnotation {
  return {
    id: annotation.id,
    courseId: annotation.courseId,
    documentId: annotation.documentId,
    target: {
      id: annotation.target.id,
      pageNumber: annotation.target.pageNumber,
      selectedText: annotation.target.selectedText,
    },
    author: {
      id: annotation.author.id,
      fullName: annotation.author.fullName,
      role: annotation.author.role,
    },
    type: annotation.type,
    visibility: annotation.visibility,
    body: annotation.body,
    createdAt: annotation.createdAt.toISOString(),
    updatedAt: annotation.updatedAt.toISOString(),
  };
}

function toForumThreadListItem(
  thread: DocumentThreadSummaryRecord,
): ForumThreadListItem {
  const lastPost = thread.posts[0];
  const author: ForumThreadAuthor = {
    id: thread.author.id,
    fullName: thread.author.fullName,
    role: thread.author.role,
  };

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
    author,
    postCount: thread._count.posts,
    verifiedPostId: thread.verifiedPostId,
    lastPostAt: lastPost ? lastPost.createdAt.toISOString() : null,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
  };
}

function documentNotFound(courseId: string, documentId: string): HttpError {
  return new HttpError(
    404,
    'Document not found',
    { courseId, documentId },
    'DOCUMENT_NOT_FOUND',
  );
}

function annotationNotFound(
  courseId: string,
  documentId: string,
  annotationId: string,
): HttpError {
  return new HttpError(
    404,
    'Annotation not found',
    { annotationId, courseId, documentId },
    'ANNOTATION_NOT_FOUND',
  );
}

function requestContext(request: Request) {
  return {
    method: request.method,
    route: request.originalUrl,
  };
}
