import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';

import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createApiRouter } from './routes/api.js';
import type { AdminCoursesRouteOptions } from './routes/admin-courses.js';
import type { AuthRouteOptions } from './routes/auth.js';
import type { CourseDocumentsRouteOptions } from './routes/course-documents.js';
import type { ProfessorCoursesRouteOptions } from './routes/professor-courses.js';
import type { ReadinessRouteOptions } from './routes/readiness.js';
import type { StudentCoursesRouteOptions } from './routes/student-courses.js';

export interface CreateAppOptions {
  auditLogger?: AuthRouteOptions['auditLogger'];
  authPrisma?: AuthRouteOptions['prisma'];
  courseDocumentsMaxUploadBytes?: CourseDocumentsRouteOptions['maxUploadBytes'];
  courseDocumentsPrisma?: CourseDocumentsRouteOptions['prisma'];
  courseDocumentsStorage?: CourseDocumentsRouteOptions['storageService'];
  corsOrigin?: boolean | string | string[];
  coursesPrisma?: AdminCoursesRouteOptions['prisma'];
  databaseCheck?: ReadinessRouteOptions['databaseCheck'];
  professorCoursesPrisma?: ProfessorCoursesRouteOptions['prisma'];
  serviceName?: string;
  sessionService?: AuthRouteOptions['sessionService'];
  storageCheck?: ReadinessRouteOptions['storageCheck'];
  studentCoursesPrisma?: StudentCoursesRouteOptions['prisma'];
  version?: string;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      credentials: true,
      origin: options.corsOrigin ?? true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use(
    '/api',
    createApiRouter({
      auditLogger: options.auditLogger,
      courseDocumentsMaxUploadBytes: options.courseDocumentsMaxUploadBytes,
      courseDocumentsPrisma: options.courseDocumentsPrisma,
      courseDocumentsStorage: options.courseDocumentsStorage,
      coursesPrisma: options.coursesPrisma,
      databaseCheck: options.databaseCheck,
      prisma: options.authPrisma,
      professorCoursesPrisma: options.professorCoursesPrisma,
      serviceName: options.serviceName,
      sessionService: options.sessionService,
      storageCheck: options.storageCheck,
      studentCoursesPrisma: options.studentCoursesPrisma,
      version: options.version,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
