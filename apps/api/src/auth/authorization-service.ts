import type { Course, Document, PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { HttpError } from '../lib/http-error.js';
import { prisma as defaultPrisma } from '../lib/prisma.js';
import { RequestValidationError } from '../lib/request-validation.js';
import { createAuditLogger, type AuditLogger } from './audit-log.js';
import {
  denyAccess,
  type AuthorizationRequestContext,
} from './authorization-denial.js';
import type { CurrentSessionUser } from './session.js';

type AuthorizationPrismaClient = Pick<
  PrismaClient,
  'course' | 'courseInstructor' | 'enrollment' | 'document'
>;

type AssertAccess<T> = (
  user: CurrentSessionUser,
  resourceId: string,
  context?: AuthorizationRequestContext,
) => Promise<T>;

export interface AuthorizationService {
  assertProfessorCourseAccess: AssertAccess<Course>;
  assertStudentCourseAccess: AssertAccess<Course>;
  assertCourseAccess: AssertAccess<Course>;
  assertDocumentAccess: AssertAccess<Document>;
}

export interface AuthorizationServiceOptions {
  prisma?: AuthorizationPrismaClient;
  auditLogger?: AuditLogger;
}

const resourceIdSchema = z.uuid();

function validateResourceId(id: string, name: 'courseId' | 'documentId'): void {
  const result = resourceIdSchema.safeParse(id);
  if (!result.success) {
    throw new RequestValidationError(
      result.error.issues.map((issue) => ({
        source: 'params',
        path: [name],
        code: issue.code,
        message: issue.message,
      })),
    );
  }
}

// Call with a user obtained from the session service, never from a request body.
export function createAuthorizationService(
  options: AuthorizationServiceOptions = {},
): AuthorizationService {
  const prisma = options.prisma ?? defaultPrisma;
  const auditLogger = options.auditLogger ?? createAuditLogger();

  async function courseDenialReason(
    user: CurrentSessionUser,
    course: Course,
    requiredRole?: 'professor' | 'student',
  ): Promise<string | null> {
    if (!user.isActive) return 'inactive_user';
    if (requiredRole && user.role !== requiredRole) return 'role_not_allowed';
    switch (user.role) {
      case 'admin':
        return null;
      case 'professor': {
        const assignment = await prisma.courseInstructor.findUnique({
          where: {
            courseId_instructorId: {
              courseId: course.id,
              instructorId: user.id,
            },
          },
        });
        return assignment ? null : 'professor_not_assigned';
      }
      case 'student': {
        if (!course.isActive) return 'inactive_course';
        const enrollment = await prisma.enrollment.findUnique({
          where: {
            courseId_studentId: { courseId: course.id, studentId: user.id },
          },
        });
        return enrollment?.status === 'active' ? null : 'no_active_enrollment';
      }
      default:
        return 'role_not_allowed';
    }
  }

  function courseAssertion(
    requiredRole?: 'professor' | 'student',
  ): AssertAccess<Course> {
    return async (user, courseId, context) => {
      validateResourceId(courseId, 'courseId');
      const course = await prisma.course.findUnique({
        where: { id: courseId },
      });
      if (!course)
        throw new HttpError(404, 'Resource not found', undefined, 'NOT_FOUND');
      const reason = await courseDenialReason(user, course, requiredRole);
      if (reason) {
        return denyAccess(auditLogger, {
          actorId: user.id,
          entityType: 'course',
          entityId: courseId,
          reason,
          context,
        });
      }
      return course;
    };
  }

  return {
    assertProfessorCourseAccess: courseAssertion('professor'),
    assertStudentCourseAccess: courseAssertion('student'),
    assertCourseAccess: courseAssertion(),
    async assertDocumentAccess(user, documentId, context) {
      validateResourceId(documentId, 'documentId');
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });
      if (!document)
        throw new HttpError(404, 'Resource not found', undefined, 'NOT_FOUND');
      const course = await prisma.course.findUnique({
        where: { id: document.courseId },
      });
      if (!course)
        throw new HttpError(404, 'Resource not found', undefined, 'NOT_FOUND');
      const reason =
        (await courseDenialReason(user, course)) ??
        (document.status !== 'active' ? 'document_not_active' : null) ??
        (user.role === 'student' &&
        document.visibility !== 'visible_to_students'
          ? 'document_hidden'
          : null);
      if (reason) {
        return denyAccess(auditLogger, {
          actorId: user.id,
          entityType: 'document',
          entityId: documentId,
          reason,
          context,
        });
      }
      return document;
    },
  };
}
