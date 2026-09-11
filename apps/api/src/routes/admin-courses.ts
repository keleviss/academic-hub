import { Router } from 'express';
import type {
  CourseInstructorRole,
  DocumentStatus,
  DocumentVisibility,
  EnrollmentStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import {
  CourseDetailResponseSchema,
  CourseIdParamsSchema,
  CourseListQuerySchema,
  CourseListResponseSchema,
  type CourseDetail,
  type CourseDetailResponse,
  type CourseDocumentMetadata,
  type CourseEnrollment,
  type CourseInstructor,
  type CourseListItem,
  type CourseListQuery,
  type CourseListResponse,
} from '@web-app/contracts';

import { type AuditLogger } from '../auth/audit-log.js';
import {
  requireRole,
  type AuthorizationMiddlewareOptions,
} from '../auth/authorization-middleware.js';
import { type SessionService } from '../auth/session.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/http-error.js';
import { prisma as defaultPrisma } from '../lib/prisma.js';
import { sendJson } from '../lib/send-json.js';
import { validateRequest } from '../lib/request-validation.js';

type AdminCoursesPrismaClient = Pick<PrismaClient, 'course'>;

export interface AdminCoursesRouteOptions {
  auditLogger?: AuditLogger;
  prisma?: AdminCoursesPrismaClient;
  sessionService?: SessionService;
}

interface CourseBaseRecord {
  id: string;
  code: string;
  title: string;
  description: string | null;
  semester: number;
  ectsCredits: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CourseListRecord extends CourseBaseRecord {
  _count: {
    documents: number;
    enrollments: number;
    instructors: number;
  };
  instructors: Array<{
    instructor: {
      fullName: string;
      id: string;
    };
  }>;
}

interface CourseDetailRecord extends CourseListRecord {
  documents: Array<{
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
  }>;
  enrollments: Array<{
    createdAt: Date;
    id: string;
    status: EnrollmentStatus;
    student: {
      email: string;
      fullName: string;
      id: string;
    };
    updatedAt: Date;
  }>;
  instructors: Array<{
    createdAt: Date;
    id: string;
    instructor: {
      email: string;
      fullName: string;
      id: string;
    };
    instructorRole: CourseInstructorRole;
  }>;
}

export function createAdminCoursesRouter(
  options: AdminCoursesRouteOptions = {},
): Router {
  const router = Router();
  const prisma = options.prisma ?? defaultPrisma;
  const gateOptions: AuthorizationMiddlewareOptions = {
    auditLogger: options.auditLogger,
    sessionService: options.sessionService,
  };

  router.get(
    '/',
    requireRole(['admin'], gateOptions),
    validateRequest({ query: CourseListQuerySchema }),
    asyncHandler(async (request, response) => {
      const query = request.query as unknown as CourseListQuery;
      const where = buildCourseListWhere(query);
      const skip = (query.page - 1) * query.pageSize;

      const [data, totalItems, totalCourses, activeCourses, unassignedCourses] =
        await Promise.all([
          prisma.course.findMany({
            include: courseListInclude(),
            orderBy: { code: 'asc' },
            skip,
            take: query.pageSize,
            where,
          }),
          prisma.course.count({ where }),
          prisma.course.count(),
          prisma.course.count({ where: { isActive: true } }),
          prisma.course.count({ where: { instructors: { none: {} } } }),
        ]);

      const payload: CourseListResponse = {
        data: (data as CourseListRecord[]).map(toCourseListItem),
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / query.pageSize),
        },
        summary: {
          activeCourses,
          totalCourses,
          unassignedCourses,
        },
      };

      sendJson(response, 200, CourseListResponseSchema, payload);
    }),
  );

  router.get(
    '/:courseId',
    requireRole(['admin'], gateOptions),
    validateRequest({ params: CourseIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      const course = await prisma.course.findUnique({
        include: courseDetailInclude(),
        where: { id: courseId },
      });

      if (!course) {
        throw new HttpError(
          404,
          'Course not found',
          { courseId },
          'COURSE_NOT_FOUND',
        );
      }

      const payload: CourseDetailResponse = {
        data: toCourseDetail(course as CourseDetailRecord),
      };

      sendJson(response, 200, CourseDetailResponseSchema, payload);
    }),
  );

  return router;
}

function buildCourseListWhere(query: CourseListQuery): Prisma.CourseWhereInput {
  const conditions: Prisma.CourseWhereInput[] = [];

  if (query.status === 'active') {
    conditions.push({ isActive: true });
  }

  if (query.status === 'inactive') {
    conditions.push({ isActive: false });
  }

  if (query.semester !== undefined) {
    conditions.push({ semester: query.semester });
  }

  if (query.search) {
    conditions.push({
      OR: [
        { code: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

function courseListInclude() {
  return {
    _count: {
      select: {
        documents: true,
        enrollments: true,
        instructors: true,
      },
    },
    instructors: {
      include: {
        instructor: {
          select: {
            fullName: true,
            id: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 1,
    },
  } satisfies Prisma.CourseInclude;
}

function courseDetailInclude() {
  return {
    ...courseListInclude(),
    documents: {
      orderBy: { createdAt: 'asc' },
      select: {
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
      },
    },
    enrollments: {
      include: {
        student: {
          select: {
            email: true,
            fullName: true,
            id: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    },
    instructors: {
      include: {
        instructor: {
          select: {
            email: true,
            fullName: true,
            id: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    },
  } satisfies Prisma.CourseInclude;
}

function toCourseListItem(course: CourseListRecord): CourseListItem {
  const primaryInstructor = course.instructors[0]?.instructor ?? null;

  return {
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description,
    semester: course.semester,
    ectsCredits: course.ectsCredits,
    isActive: course.isActive,
    counts: {
      documentCount: course._count.documents,
      instructorCount: course._count.instructors,
      studentCount: course._count.enrollments,
    },
    primaryInstructor,
  };
}

function toCourseDetail(course: CourseDetailRecord): CourseDetail {
  return {
    ...toCourseListItem(course),
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
    documents: course.documents.map(toCourseDocumentMetadata),
    enrollments: course.enrollments.map(toCourseEnrollment),
    instructors: course.instructors.map(toCourseInstructor),
  };
}

function toCourseInstructor(
  assignment: CourseDetailRecord['instructors'][0],
): CourseInstructor {
  return {
    id: assignment.id,
    userId: assignment.instructor.id,
    fullName: assignment.instructor.fullName,
    email: assignment.instructor.email,
    role: assignment.instructorRole,
    assignedAt: assignment.createdAt.toISOString(),
  };
}

function toCourseEnrollment(
  enrollment: CourseDetailRecord['enrollments'][0],
): CourseEnrollment {
  return {
    id: enrollment.id,
    studentId: enrollment.student.id,
    fullName: enrollment.student.fullName,
    email: enrollment.student.email,
    status: enrollment.status,
    enrolledAt: enrollment.createdAt.toISOString(),
    updatedAt: enrollment.updatedAt.toISOString(),
  };
}

function toCourseDocumentMetadata(
  document: CourseDetailRecord['documents'][0],
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
