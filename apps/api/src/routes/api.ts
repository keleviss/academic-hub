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
import {
  createCourseForumRouter,
  type CourseForumRouteOptions,
} from './course-forum.js';
import { createHealthRouter, type HealthRouteOptions } from './health.js';
import {
  createProfessorCoursesRouter,
  type ProfessorCoursesRouteOptions,
} from './professor-courses.js';
import {
  createProfessorDashboardRouter,
  type ProfessorDashboardRouteOptions,
} from './professor-dashboard.js';
import {
  createReadinessRouter,
  type ReadinessRouteOptions,
} from './readiness.js';
import {
  createStudentCoursesRouter,
  type StudentCoursesRouteOptions,
} from './student-courses.js';
import {
  createStudentDashboardRouter,
  type StudentDashboardRouteOptions,
} from './student-dashboard.js';

export type ApiRouterOptions = AuthRouteOptions &
  HealthRouteOptions &
  ReadinessRouteOptions & {
    courseDocumentsPrisma?: CourseDocumentsRouteOptions['prisma'];
    courseDocumentsMaxUploadBytes?: CourseDocumentsRouteOptions['maxUploadBytes'];
    courseDocumentsStorage?: CourseDocumentsRouteOptions['storageService'];
    courseForumPrisma?: CourseForumRouteOptions['prisma'];
    coursesPrisma?: AdminCoursesRouteOptions['prisma'];
    professorCoursesPrisma?: ProfessorCoursesRouteOptions['prisma'];
    professorDashboardPrisma?: ProfessorDashboardRouteOptions['prisma'];
    studentCoursesPrisma?: StudentCoursesRouteOptions['prisma'];
    studentDashboardPrisma?: StudentDashboardRouteOptions['prisma'];
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
    '/courses/:courseId/forum',
    createCourseForumRouter({
      auditLogger: options.auditLogger,
      prisma: options.courseForumPrisma,
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
  router.use(
    '/professor/courses',
    createProfessorCoursesRouter({
      auditLogger: options.auditLogger,
      prisma: options.professorCoursesPrisma,
      sessionService: options.sessionService,
    }),
  );
  router.use(
    '/professor/dashboard',
    createProfessorDashboardRouter({
      auditLogger: options.auditLogger,
      prisma: options.professorDashboardPrisma,
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
  router.use(
    '/student/dashboard',
    createStudentDashboardRouter({
      auditLogger: options.auditLogger,
      prisma: options.studentDashboardPrisma,
      sessionService: options.sessionService,
    }),
  );

  return router;
}
