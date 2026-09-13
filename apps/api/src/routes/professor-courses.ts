import { Router, type Request } from 'express';
import type { CourseInstructorRole, PrismaClient } from '@prisma/client';
import {
  CourseIdParamsSchema,
  ProfessorCourseDetailResponseSchema,
  ProfessorCourseListResponseSchema,
  type CourseInstructor,
  type ProfessorCourseDetail,
  type ProfessorCourseDetailResponse,
  type ProfessorCourseListItem,
  type ProfessorCourseListResponse,
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
import { prisma as defaultPrisma } from '../lib/prisma.js';
import { validateRequest } from '../lib/request-validation.js';
import { sendJson } from '../lib/send-json.js';

type ProfessorCoursesPrismaClient = Pick<
  PrismaClient,
  'course' | 'courseInstructor' | 'document' | 'enrollment'
>;

export interface ProfessorCoursesRouteOptions {
  auditLogger?: AuditLogger;
  authorizationService?: AuthorizationService;
  prisma?: ProfessorCoursesPrismaClient;
  sessionService?: SessionService;
}

interface CourseRecord {
  code: string;
  description: string | null;
  ectsCredits: number;
  id: string;
  isActive: boolean;
  semester: number;
  title: string;
}

interface DocumentCounts {
  documentCount: number;
  visibleDocumentCount: number;
}

export function createProfessorCoursesRouter(
  options: ProfessorCoursesRouteOptions = {},
): Router {
  const router = Router();
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
    requireRole(['professor'], gateOptions),
    asyncHandler(async (request, response) => {
      const assignments = await prisma.courseInstructor.findMany({
        include: { course: true },
        orderBy: { course: { code: 'asc' } },
        where: { instructorId: request.currentSession!.user.id },
      });

      const data = await Promise.all(
        assignments.map(async (assignment) => {
          const counts = await documentCountsFor(prisma, assignment.courseId);
          return toProfessorCourseListItem(
            assignment.course as CourseRecord,
            assignment.instructorRole,
            counts,
          );
        }),
      );

      const payload: ProfessorCourseListResponse = {
        data,
        summary: { assignedCourseCount: data.length },
      };

      sendJson(response, 200, ProfessorCourseListResponseSchema, payload);
    }),
  );

  router.get(
    '/:courseId',
    requireRole(['professor'], gateOptions),
    validateRequest({ params: CourseIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      const user = request.currentSession!.user;
      const course = await authorization.assertProfessorCourseAccess(
        user,
        courseId,
        requestContext(request),
      );

      const [instructorRecords, counts, studentCount] = await Promise.all([
        prisma.courseInstructor.findMany({
          include: { instructor: true },
          orderBy: { createdAt: 'asc' },
          where: { courseId },
        }),
        documentCountsFor(prisma, courseId),
        prisma.enrollment.count({ where: { courseId } }),
      ]);

      const instructors = instructorRecords.map(toCourseInstructor);
      // assertProfessorCourseAccess already confirmed this assignment exists.
      const own = instructorRecords.find(
        (record) => record.instructorId === user.id,
      )!;

      const payload: ProfessorCourseDetailResponse = {
        data: {
          ...toProfessorCourseListItem(
            course as CourseRecord,
            own.instructorRole,
            counts,
          ),
          instructors,
          studentCount,
        },
      };

      sendJson(response, 200, ProfessorCourseDetailResponseSchema, payload);
    }),
  );

  return router;
}

async function documentCountsFor(
  prisma: ProfessorCoursesPrismaClient,
  courseId: string,
): Promise<DocumentCounts> {
  const [documentCount, visibleDocumentCount] = await Promise.all([
    prisma.document.count({ where: { courseId, status: 'active' } }),
    prisma.document.count({
      where: {
        courseId,
        status: 'active',
        visibility: 'visible_to_students',
      },
    }),
  ]);

  return { documentCount, visibleDocumentCount };
}

function toProfessorCourseListItem(
  course: CourseRecord,
  instructorRole: CourseInstructorRole,
  counts: DocumentCounts,
): ProfessorCourseListItem {
  return {
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description,
    semester: course.semester,
    ectsCredits: course.ectsCredits,
    isActive: course.isActive,
    instructorRole,
    counts,
  };
}

function toCourseInstructor(record: {
  createdAt: Date;
  id: string;
  instructor: { email: string; fullName: string; id: string };
  instructorRole: CourseInstructorRole;
}): CourseInstructor {
  return {
    id: record.id,
    userId: record.instructor.id,
    fullName: record.instructor.fullName,
    email: record.instructor.email,
    role: record.instructorRole,
    assignedAt: record.createdAt.toISOString(),
  };
}

function requestContext(request: Request) {
  return {
    method: request.method,
    route: request.originalUrl,
  };
}
