import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';

import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createApiRouter } from './routes/api.js';
import type { ReadinessRouteOptions } from './routes/readiness.js';

export interface CreateAppOptions {
  corsOrigin?: boolean | string | string[];
  databaseCheck?: ReadinessRouteOptions['databaseCheck'];
  serviceName?: string;
  storageCheck?: ReadinessRouteOptions['storageCheck'];
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
      databaseCheck: options.databaseCheck,
      serviceName: options.serviceName,
      storageCheck: options.storageCheck,
      version: options.version,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
