import { Router, type Request } from 'express';
import type {
  DocumentStatus,
  DocumentVisibility,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import {
  CourseDocumentIdParamsSchema,
  CourseDocumentResponseSchema,
  CourseDocumentsResponseSchema,
  CourseIdParamsSchema,
  CreateCourseDocumentRequestSchema,
  UpdateCourseDocumentMetadataRequestSchema,
  type CourseDocumentMetadata,
  type CourseDocumentResponse,
  type CourseDocumentsResponse,
  type CreateCourseDocumentRequest,
  type UpdateCourseDocumentMetadataRequest,
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

type CourseDocumentsPrismaClient = Pick<
  PrismaClient,
  'course' | 'courseInstructor' | 'document' | 'enrollment'
>;

export interface CourseDocumentsRouteOptions {
  auditLogger?: AuditLogger;
  authorizationService?: AuthorizationService;
  prisma?: CourseDocumentsPrismaClient;
  sessionService?: SessionService;
}

interface CourseDocumentRecord {
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

export function createCourseDocumentsRouter(
  options: CourseDocumentsRouteOptions = {},
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
    validateRequest({
      body: CreateCourseDocumentRequestSchema,
      params: CourseIdParamsSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      const input = request.body as CreateCourseDocumentRequest;
      await authorization.assertCourseAccess(
        request.currentSession!.user,
        courseId,
        requestContext(request),
      );

      const document = await createCourseDocument(
        prisma,
        courseId,
        request.currentSession!.user.id,
        input,
      );

      const payload: CourseDocumentResponse = {
        data: toCourseDocumentMetadata(document),
      };

      sendJson(response, 201, CourseDocumentResponseSchema, payload);
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

async function createCourseDocument(
  prisma: CourseDocumentsPrismaClient,
  courseId: string,
  actorId: string,
  input: CreateCourseDocumentRequest,
): Promise<CourseDocumentRecord> {
  return (await prisma.document.create({
    data: {
      courseId,
      createdById: actorId,
      description: input.description ?? null,
      fileSizeBytes:
        input.fileSizeBytes === undefined || input.fileSizeBytes === null
          ? null
          : BigInt(input.fileSizeBytes),
      mimeType: input.mimeType ?? null,
      originalFilename: input.originalFilename ?? null,
      pageCount: input.pageCount ?? null,
      title: input.title,
      updatedById: actorId,
      visibility: input.visibility,
    },
    select: courseDocumentSelect(),
  })) as CourseDocumentRecord;
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
  if (Object.prototype.hasOwnProperty.call(input, 'originalFilename')) {
    data.originalFilename = input.originalFilename ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'mimeType')) {
    data.mimeType = input.mimeType ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'fileSizeBytes')) {
    data.fileSizeBytes =
      input.fileSizeBytes === null || input.fileSizeBytes === undefined
        ? null
        : BigInt(input.fileSizeBytes);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'pageCount')) {
    data.pageCount = input.pageCount ?? null;
  }

  return data;
}

function courseDocumentSelect() {
  return {
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

function documentNotFound(courseId: string, documentId: string): HttpError {
  return new HttpError(
    404,
    'Document not found',
    { courseId, documentId },
    'DOCUMENT_NOT_FOUND',
  );
}

function requestContext(request: Request) {
  return {
    method: request.method,
    route: request.originalUrl,
  };
}
