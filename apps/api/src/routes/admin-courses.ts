import { Router } from 'express';
import type {
  CourseInstructorRole,
  DocumentStatus,
  DocumentVisibility,
  EnrollmentStatus,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import {
  AssignCourseInstructorRequestSchema,
  CourseCreateRequestSchema,
  CourseDetailResponseSchema,
  CourseEnrollmentsResponseSchema,
  CourseIdParamsSchema,
  CourseInstructorsResponseSchema,
  CourseListQuerySchema,
  CourseListResponseSchema,
  CourseMemberIdParamsSchema,
  CourseMutationResponseSchema,
  CourseUpdateRequestSchema,
  EnrollStudentRequestSchema,
  UpdateEnrollmentStatusRequestSchema,
  type AssignCourseInstructorRequest,
  type CourseCreateRequest,
  type CourseDetail,
  type CourseDetailResponse,
  type CourseDocumentMetadata,
  type CourseEnrollment,
  type CourseEnrollmentsResponse,
  type CourseInstructor,
  type CourseInstructorsResponse,
  type CourseListItem,
  type CourseListQuery,
  type CourseListResponse,
  type CourseMutationResponse,
  type CourseUpdateRequest,
  type EnrollStudentRequest,
  type UpdateEnrollmentStatusRequest,
} from '@web-app/contracts';

import { createAuditLogger, type AuditLogger } from '../auth/audit-log.js';
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

type AdminCoursesPrismaClient = Pick<
  PrismaClient,
  'course' | 'courseInstructor' | 'enrollment' | 'user'
>;

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

interface CourseInstructorAssignmentRecord {
  createdAt: Date;
  id: string;
  instructor: {
    email: string;
    fullName: string;
    id: string;
  };
  instructorRole: CourseInstructorRole;
}

interface ProfessorCandidateRecord {
  id: string;
  isActive: boolean;
  role: UserRole;
}

type StudentCandidateRecord = ProfessorCandidateRecord;

type CourseEnrollmentRecord = CourseDetailRecord['enrollments'][0];

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
  instructors: CourseInstructorAssignmentRecord[];
}

export function createAdminCoursesRouter(
  options: AdminCoursesRouteOptions = {},
): Router {
  const router = Router();
  const prisma = options.prisma ?? defaultPrisma;
  const auditLogger = options.auditLogger ?? createAuditLogger();
  const gateOptions: AuthorizationMiddlewareOptions = {
    auditLogger,
    sessionService: options.sessionService,
  };

  router.post(
    '/',
    requireRole(['admin'], gateOptions),
    validateRequest({ body: CourseCreateRequestSchema }),
    asyncHandler(async (request, response) => {
      const input = request.body as CourseCreateRequest;
      const course = await createCourse(prisma, input);

      await auditLogger.logAuditEvent({
        action: 'course.created',
        actorId: request.currentSession!.user.id,
        entityId: course.id,
        entityType: 'course',
        metadata: { code: course.code },
      });

      const payload: CourseMutationResponse = {
        data: toCourseDetail(course),
      };

      sendJson(response, 201, CourseMutationResponseSchema, payload);
    }),
  );

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
    '/:courseId/instructors',
    requireRole(['admin'], gateOptions),
    validateRequest({ params: CourseIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      await assertCourseExists(prisma, courseId);

      const payload: CourseInstructorsResponse = {
        data: await listCourseInstructors(prisma, courseId),
      };

      sendJson(response, 200, CourseInstructorsResponseSchema, payload);
    }),
  );

  router.post(
    '/:courseId/instructors',
    requireRole(['admin'], gateOptions),
    validateRequest({
      body: AssignCourseInstructorRequestSchema,
      params: CourseIdParamsSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      const input = request.body as AssignCourseInstructorRequest;

      await assertCourseExists(prisma, courseId);
      await assertActiveProfessor(prisma, input.instructorId);
      await assertCourseInstructorNotAssigned(
        prisma,
        courseId,
        input.instructorId,
      );
      await createCourseInstructor(prisma, courseId, input);

      const payload: CourseInstructorsResponse = {
        data: await listCourseInstructors(prisma, courseId),
      };

      sendJson(response, 201, CourseInstructorsResponseSchema, payload);
    }),
  );

  router.delete(
    '/:courseId/instructors/:userId',
    requireRole(['admin'], gateOptions),
    validateRequest({ params: CourseMemberIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId, userId } = request.params as {
        courseId: string;
        userId: string;
      };

      await assertCourseExists(prisma, courseId);
      await deleteCourseInstructor(prisma, courseId, userId);

      const payload: CourseInstructorsResponse = {
        data: await listCourseInstructors(prisma, courseId),
      };

      sendJson(response, 200, CourseInstructorsResponseSchema, payload);
    }),
  );

  router.get(
    '/:courseId/enrollments',
    requireRole(['admin'], gateOptions),
    validateRequest({ params: CourseIdParamsSchema }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      await assertCourseExists(prisma, courseId);

      const payload: CourseEnrollmentsResponse = {
        data: await listCourseEnrollments(prisma, courseId),
      };

      sendJson(response, 200, CourseEnrollmentsResponseSchema, payload);
    }),
  );

  router.post(
    '/:courseId/enrollments',
    requireRole(['admin'], gateOptions),
    validateRequest({
      body: EnrollStudentRequestSchema,
      params: CourseIdParamsSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      const input = request.body as EnrollStudentRequest;

      await assertCourseExists(prisma, courseId);
      await assertActiveStudent(prisma, input.studentId);
      const { created, enrollment } = await enrollStudent(
        prisma,
        courseId,
        input,
      );

      await auditLogger.logAuditEvent({
        action: 'enrollment.changed',
        actorId: request.currentSession!.user.id,
        entityId: enrollment.id,
        entityType: 'enrollment',
        metadata: {
          courseId,
          status: enrollment.status,
          studentId: input.studentId,
        },
      });

      const payload: CourseEnrollmentsResponse = {
        data: await listCourseEnrollments(prisma, courseId),
      };

      sendJson(
        response,
        created ? 201 : 200,
        CourseEnrollmentsResponseSchema,
        payload,
      );
    }),
  );

  router.patch(
    '/:courseId/enrollments/:userId',
    requireRole(['admin'], gateOptions),
    validateRequest({
      body: UpdateEnrollmentStatusRequestSchema,
      params: CourseMemberIdParamsSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId, userId } = request.params as {
        courseId: string;
        userId: string;
      };
      const input = request.body as UpdateEnrollmentStatusRequest;

      await assertCourseExists(prisma, courseId);
      const previous = await assertEnrollmentExists(prisma, courseId, userId);

      await prisma.enrollment.update({
        data: { status: input.status },
        where: { courseId_studentId: { courseId, studentId: userId } },
      });

      await auditLogger.logAuditEvent({
        action: 'enrollment.changed',
        actorId: request.currentSession!.user.id,
        entityId: previous.id,
        entityType: 'enrollment',
        metadata: {
          courseId,
          previousStatus: previous.status,
          status: input.status,
          studentId: userId,
        },
      });

      const payload: CourseEnrollmentsResponse = {
        data: await listCourseEnrollments(prisma, courseId),
      };

      sendJson(response, 200, CourseEnrollmentsResponseSchema, payload);
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

  router.patch(
    '/:courseId',
    requireRole(['admin'], gateOptions),
    validateRequest({
      body: CourseUpdateRequestSchema,
      params: CourseIdParamsSchema,
    }),
    asyncHandler(async (request, response) => {
      const { courseId } = request.params as { courseId: string };
      const input = request.body as CourseUpdateRequest;
      const previous = await prisma.course.findUnique({
        select: { code: true, id: true, isActive: true },
        where: { id: courseId },
      });

      if (!previous) {
        throw courseNotFound(courseId);
      }

      const course = await updateCourse(prisma, courseId, input);
      const action =
        input.isActive === false && previous.isActive
          ? 'course.deactivated'
          : 'course.updated';

      await auditLogger.logAuditEvent({
        action,
        actorId: request.currentSession!.user.id,
        entityId: course.id,
        entityType: 'course',
        metadata: {
          changedFields: Object.keys(input),
          code: course.code,
          previousCode: previous.code,
        },
      });

      const payload: CourseMutationResponse = {
        data: toCourseDetail(course),
      };

      sendJson(response, 200, CourseMutationResponseSchema, payload);
    }),
  );

  return router;
}

async function assertCourseExists(
  prisma: AdminCoursesPrismaClient,
  courseId: string,
): Promise<void> {
  const course = await prisma.course.findUnique({
    select: { id: true },
    where: { id: courseId },
  });

  if (!course) {
    throw courseNotFound(courseId);
  }
}

async function assertActiveProfessor(
  prisma: AdminCoursesPrismaClient,
  instructorId: string,
): Promise<void> {
  const user = (await prisma.user.findUnique({
    select: { id: true, isActive: true, role: true },
    where: { id: instructorId },
  })) as ProfessorCandidateRecord | null;

  if (!user) {
    throw new HttpError(
      404,
      'Professor not found',
      { instructorId },
      'PROFESSOR_NOT_FOUND',
    );
  }

  if (!user.isActive) {
    throw new HttpError(
      409,
      'Professor is inactive',
      { instructorId },
      'PROFESSOR_INACTIVE',
    );
  }

  if (user.role !== 'professor') {
    throw new HttpError(
      409,
      'User is not a professor',
      { instructorId, role: user.role },
      'USER_IS_NOT_PROFESSOR',
    );
  }
}

async function assertActiveStudent(
  prisma: AdminCoursesPrismaClient,
  studentId: string,
): Promise<void> {
  const user = (await prisma.user.findUnique({
    select: { id: true, isActive: true, role: true },
    where: { id: studentId },
  })) as StudentCandidateRecord | null;

  if (!user) {
    throw new HttpError(
      404,
      'Student not found',
      { studentId },
      'STUDENT_NOT_FOUND',
    );
  }

  if (!user.isActive) {
    throw new HttpError(
      409,
      'Student is inactive',
      { studentId },
      'STUDENT_INACTIVE',
    );
  }

  if (user.role !== 'student') {
    throw new HttpError(
      409,
      'User is not a student',
      { studentId, role: user.role },
      'USER_IS_NOT_STUDENT',
    );
  }
}

async function assertEnrollmentExists(
  prisma: AdminCoursesPrismaClient,
  courseId: string,
  studentId: string,
): Promise<{ id: string; status: EnrollmentStatus }> {
  const enrollment = await prisma.enrollment.findUnique({
    select: { id: true, status: true },
    where: {
      courseId_studentId: {
        courseId,
        studentId,
      },
    },
  });

  if (!enrollment) {
    throw enrollmentNotFound(courseId, studentId);
  }

  return enrollment;
}

async function enrollStudent(
  prisma: AdminCoursesPrismaClient,
  courseId: string,
  input: EnrollStudentRequest,
): Promise<{ created: boolean; enrollment: { id: string; status: EnrollmentStatus } }> {
  const existing = await prisma.enrollment.findUnique({
    select: { id: true, status: true },
    where: {
      courseId_studentId: {
        courseId,
        studentId: input.studentId,
      },
    },
  });

  if (existing) {
    if (existing.status === 'active') {
      throw studentAlreadyEnrolled(courseId, input.studentId);
    }

    // Re-enrolling an inactive or completed student reactivates the existing row instead of creating a duplicate.
    const reactivated = await prisma.enrollment.update({
      data: { status: input.status },
      select: { id: true, status: true },
      where: {
        courseId_studentId: {
          courseId,
          studentId: input.studentId,
        },
      },
    });

    return { created: false, enrollment: reactivated };
  }

  try {
    const created = await prisma.enrollment.create({
      data: {
        courseId,
        status: input.status,
        studentId: input.studentId,
      },
      select: { id: true, status: true },
    });

    return { created: true, enrollment: created };
  } catch (error) {
    if (isPrismaWriteError(error) && error.code === 'P2002') {
      throw studentAlreadyEnrolled(courseId, input.studentId);
    }

    throw error instanceof Error ? error : new Error('Enrollment failed');
  }
}

async function assertCourseInstructorNotAssigned(
  prisma: AdminCoursesPrismaClient,
  courseId: string,
  instructorId: string,
): Promise<void> {
  const assignment = await prisma.courseInstructor.findUnique({
    select: { id: true },
    where: {
      courseId_instructorId: {
        courseId,
        instructorId,
      },
    },
  });

  if (assignment) {
    throw courseInstructorAlreadyAssigned(courseId, instructorId);
  }
}

async function createCourseInstructor(
  prisma: AdminCoursesPrismaClient,
  courseId: string,
  input: AssignCourseInstructorRequest,
): Promise<void> {
  try {
    await prisma.courseInstructor.create({
      data: {
        courseId,
        instructorId: input.instructorId,
        instructorRole: input.role,
      },
    });
  } catch (error) {
    if (isPrismaWriteError(error) && error.code === 'P2002') {
      throw courseInstructorAlreadyAssigned(courseId, input.instructorId);
    }

    throw error instanceof Error
      ? error
      : new Error('Course instructor assignment failed');
  }
}

async function deleteCourseInstructor(
  prisma: AdminCoursesPrismaClient,
  courseId: string,
  instructorId: string,
): Promise<void> {
  const assignment = await prisma.courseInstructor.findUnique({
    select: { id: true },
    where: {
      courseId_instructorId: {
        courseId,
        instructorId,
      },
    },
  });

  if (!assignment) {
    throw courseInstructorAssignmentNotFound(courseId, instructorId);
  }

  try {
    await prisma.courseInstructor.delete({
      where: {
        courseId_instructorId: {
          courseId,
          instructorId,
        },
      },
    });
  } catch (error) {
    if (isPrismaWriteError(error) && error.code === 'P2025') {
      throw courseInstructorAssignmentNotFound(courseId, instructorId);
    }

    throw error instanceof Error
      ? error
      : new Error('Course instructor removal failed');
  }
}

async function listCourseInstructors(
  prisma: AdminCoursesPrismaClient,
  courseId: string,
): Promise<CourseInstructor[]> {
  const assignments = await prisma.courseInstructor.findMany({
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
    where: { courseId },
  });

  return (assignments as CourseInstructorAssignmentRecord[]).map(
    toCourseInstructor,
  );
}

async function listCourseEnrollments(
  prisma: AdminCoursesPrismaClient,
  courseId: string,
): Promise<CourseEnrollment[]> {
  const enrollments = await prisma.enrollment.findMany({
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
    where: { courseId },
  });

  return (enrollments as CourseEnrollmentRecord[]).map(toCourseEnrollment);
}

async function createCourse(
  prisma: AdminCoursesPrismaClient,
  input: CourseCreateRequest,
): Promise<CourseDetailRecord> {
  try {
    return (await prisma.course.create({
      data: normalizeCourseCreateData(input),
      include: courseDetailInclude(),
    })) as CourseDetailRecord;
  } catch (error) {
    throw mapCourseWriteError(error);
  }
}

async function updateCourse(
  prisma: AdminCoursesPrismaClient,
  courseId: string,
  input: CourseUpdateRequest,
): Promise<CourseDetailRecord> {
  try {
    return (await prisma.course.update({
      data: normalizeCourseUpdateData(input),
      include: courseDetailInclude(),
      where: { id: courseId },
    })) as CourseDetailRecord;
  } catch (error) {
    throw mapCourseWriteError(error, courseId);
  }
}

function normalizeCourseCreateData(
  input: CourseCreateRequest,
): Prisma.CourseCreateInput {
  return {
    code: input.code,
    title: input.title,
    description: input.description ?? null,
    semester: input.semester,
    ectsCredits: input.ectsCredits,
  };
}

function normalizeCourseUpdateData(
  input: CourseUpdateRequest,
): Prisma.CourseUpdateInput {
  const data: Prisma.CourseUpdateInput = {};

  if (input.code !== undefined) data.code = input.code;
  if (input.title !== undefined) data.title = input.title;
  if (input.semester !== undefined) data.semester = input.semester;
  if (input.ectsCredits !== undefined) data.ectsCredits = input.ectsCredits;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (Object.prototype.hasOwnProperty.call(input, 'description')) {
    data.description = input.description ?? null;
  }

  return data;
}

function mapCourseWriteError(error: unknown, courseId?: string): Error {
  if (isPrismaWriteError(error)) {
    if (error.code === 'P2002') {
      return new HttpError(
        409,
        'Course code already exists',
        { target: error.meta?.target },
        'COURSE_CODE_ALREADY_EXISTS',
      );
    }

    if (error.code === 'P2025' && courseId) {
      return courseNotFound(courseId);
    }
  }

  return error instanceof Error ? error : new Error('Course write failed');
}

function isPrismaWriteError(
  error: unknown,
): error is { code: string; meta?: { target?: unknown } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

function courseNotFound(courseId: string): HttpError {
  return new HttpError(
    404,
    'Course not found',
    { courseId },
    'COURSE_NOT_FOUND',
  );
}

function courseInstructorAlreadyAssigned(
  courseId: string,
  instructorId: string,
): HttpError {
  return new HttpError(
    409,
    'Course instructor already assigned',
    { courseId, instructorId },
    'COURSE_INSTRUCTOR_ALREADY_ASSIGNED',
  );
}

function courseInstructorAssignmentNotFound(
  courseId: string,
  instructorId: string,
): HttpError {
  return new HttpError(
    404,
    'Course instructor assignment not found',
    { courseId, instructorId },
    'COURSE_INSTRUCTOR_ASSIGNMENT_NOT_FOUND',
  );
}

function studentAlreadyEnrolled(
  courseId: string,
  studentId: string,
): HttpError {
  return new HttpError(
    409,
    'Student already enrolled',
    { courseId, studentId },
    'STUDENT_ALREADY_ENROLLED',
  );
}

function enrollmentNotFound(courseId: string, studentId: string): HttpError {
  return new HttpError(
    404,
    'Enrollment not found',
    { courseId, studentId },
    'ENROLLMENT_NOT_FOUND',
  );
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
  assignment: CourseInstructorAssignmentRecord,
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
