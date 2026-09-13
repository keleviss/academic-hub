import { Router, type Request } from 'express';
import type { PrismaClient } from '@prisma/client';
import {
  CourseIdParamsSchema,
  StudentCourseDetailResponseSchema,
  StudentCourseListResponseSchema,
  type CourseInstructor,
  type StudentCourseDetailResponse,
  type StudentCourseListItem,
  type StudentCourseListResponse,
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

type StudentCoursesPrismaClient = Pick<
  PrismaClient,
  'course' | 'courseInstructor' | 'document' | 'enrollment'
>;

export interface StudentCoursesRouteOptions {
  auditLogger?: AuditLogger;
  authorizationService?: AuthorizationService;
  prisma?: StudentCoursesPrismaClient;
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

export function createStudentCoursesRouter(
  options: StudentCoursesRouteOptions = {},
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
    requireRole(['student'], gateOptions),
    asyncHandler(async (request, response) => {
      const enrollments = await prisma.enrollment.findMany({
        include: { course: true },
        orderBy: { course: { code: 'asc' } },
        where: {
          studentId: request.currentSession!.user.id,
          status: 'active',
          course: { isActive: true },
        },
      });

      const data = await Promise.all(
        enrollments.map(async (enrollment) => {
          const documentCount = await visibleDocumentCountFor(
            prisma,
            enrollment.courseId,
          );
          return toStudentCourseListItem(
            enrollment.course as CourseRecord,
            documentCount,
          );
        }),
      );

      const payload: StudentCourseListResponse = {
        data,
        summary: { enrolledCourseCount: data.length },
      };

      sendJson(response, 200, StudentCourseListResponseSchema, payload);
    }),
  );

  router.get(
    '/:courseId',
    requireRole(['student'], gateOptions),
    validateRequest({ params: CourseIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      const user = request.currentSession!.user;
      const course = await authorization.assertStudentCourseAccess(
        user,
        courseId,
        requestContext(request),
      );

      const [instructorRecords, documentCount] = await Promise.all([
        prisma.courseInstructor.findMany({
          include: { instructor: true },
          orderBy: { createdAt: 'asc' },
          where: { courseId },
        }),
        visibleDocumentCountFor(prisma, courseId),
      ]);

      const instructors = instructorRecords.map(toCourseInstructor);

      const payload: StudentCourseDetailResponse = {
        data: {
          ...toStudentCourseListItem(course as CourseRecord, documentCount),
          instructors,
        },
      };

      sendJson(response, 200, StudentCourseDetailResponseSchema, payload);
    }),
  );

  return router;
}

async function visibleDocumentCountFor(
  prisma: StudentCoursesPrismaClient,
  courseId: string,
): Promise<number> {
  return prisma.document.count({
    where: { courseId, status: 'active', visibility: 'visible_to_students' },
  });
}

function toStudentCourseListItem(
  course: CourseRecord,
  documentCount: number,
): StudentCourseListItem {
  return {
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description,
    semester: course.semester,
    ectsCredits: course.ectsCredits,
    isActive: course.isActive,
    counts: { documentCount },
  };
}

function toCourseInstructor(record: {
  createdAt: Date;
  id: string;
  instructor: { email: string; fullName: string; id: string };
  instructorRole: 'owner' | 'assistant';
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
