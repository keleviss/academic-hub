import { Router } from 'express';

import {
  createAdminCoursesRouter,
  type AdminCoursesRouteOptions,
} from './admin-courses.js';
import { createAuthRouter, type AuthRouteOptions } from './auth.js';
import {
  createCourseDocumentsRouter,
  type CourseDocumentsRouteOptions,
} from './course-documents.js';
import { createHealthRouter, type HealthRouteOptions } from './health.js';
import {
  createProfessorCoursesRouter,
  type ProfessorCoursesRouteOptions,
} from './professor-courses.js';
import {
  createReadinessRouter,
  type ReadinessRouteOptions,
} from './readiness.js';
import {
  createStudentCoursesRouter,
  type StudentCoursesRouteOptions,
} from './student-courses.js';

export type ApiRouterOptions = AuthRouteOptions &
  HealthRouteOptions &
  ReadinessRouteOptions & {
    courseDocumentsPrisma?: CourseDocumentsRouteOptions['prisma'];
    courseDocumentsMaxUploadBytes?: CourseDocumentsRouteOptions['maxUploadBytes'];
    courseDocumentsStorage?: CourseDocumentsRouteOptions['storageService'];
    coursesPrisma?: AdminCoursesRouteOptions['prisma'];
    professorCoursesPrisma?: ProfessorCoursesRouteOptions['prisma'];
    studentCoursesPrisma?: StudentCoursesRouteOptions['prisma'];
  };

export function createApiRouter(options: ApiRouterOptions = {}): Router {
  const router = Router();

  router.use('/auth', createAuthRouter(options));
  router.use('/health', createHealthRouter(options));
  router.use('/readiness', createReadinessRouter(options));
  router.use(
    '/courses/:courseId/documents',
    createCourseDocumentsRouter({
      auditLogger: options.auditLogger,
      maxUploadBytes: options.courseDocumentsMaxUploadBytes,
      prisma: options.courseDocumentsPrisma,
      sessionService: options.sessionService,
      storageService: options.courseDocumentsStorage,
    }),
  );
  router.use(
    '/admin/courses',
    createAdminCoursesRouter({
      auditLogger: options.auditLogger,
      prisma: options.coursesPrisma,
      sessionService: options.sessionService,
    }),
  );
  router.use(
    '/professor/courses',
    createProfessorCoursesRouter({
      auditLogger: options.auditLogger,
      prisma: options.professorCoursesPrisma,
      sessionService: options.sessionService,
    }),
  );
  router.use(
    '/student/courses',
    createStudentCoursesRouter({
      auditLogger: options.auditLogger,
      prisma: options.studentCoursesPrisma,
      sessionService: options.sessionService,
    }),
  );

  return router;
}
