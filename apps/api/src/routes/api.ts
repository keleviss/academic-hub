import { Router } from 'express';

import {
  createAdminCoursesRouter,
  type AdminCoursesRouteOptions,
} from './admin-courses.js';
import { createAuthRouter, type AuthRouteOptions } from './auth.js';
import { createHealthRouter, type HealthRouteOptions } from './health.js';
import {
  createReadinessRouter,
  type ReadinessRouteOptions,
} from './readiness.js';

export type ApiRouterOptions = AuthRouteOptions &
  HealthRouteOptions &
  ReadinessRouteOptions & {
    coursesPrisma?: AdminCoursesRouteOptions['prisma'];
  };

export function createApiRouter(options: ApiRouterOptions = {}): Router {
  const router = Router();

  router.use(
    '/admin/courses',
    createAdminCoursesRouter({
      auditLogger: options.auditLogger,
      prisma: options.coursesPrisma,
      sessionService: options.sessionService,
    }),
  );
  router.use('/auth', createAuthRouter(options));
  router.use('/health', createHealthRouter(options));
  router.use('/readiness', createReadinessRouter(options));

  return router;
}
