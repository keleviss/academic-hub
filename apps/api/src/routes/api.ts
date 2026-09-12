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
  createReadinessRouter,
  type ReadinessRouteOptions,
} from './readiness.js';

export type ApiRouterOptions = AuthRouteOptions &
  HealthRouteOptions &
  ReadinessRouteOptions & {
    courseDocumentsPrisma?: CourseDocumentsRouteOptions['prisma'];
    coursesPrisma?: AdminCoursesRouteOptions['prisma'];
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
      prisma: options.courseDocumentsPrisma,
      sessionService: options.sessionService,
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

  return router;
}
