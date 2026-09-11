import { Router } from 'express';

import { createAuthRouter, type AuthRouteOptions } from './auth.js';
import { createHealthRouter, type HealthRouteOptions } from './health.js';
import {
  createReadinessRouter,
  type ReadinessRouteOptions,
} from './readiness.js';

export type ApiRouterOptions = AuthRouteOptions &
  HealthRouteOptions &
  ReadinessRouteOptions;

export function createApiRouter(options: ApiRouterOptions = {}): Router {
  const router = Router();

  router.use('/auth', createAuthRouter(options));
  router.use('/health', createHealthRouter(options));
  router.use('/readiness', createReadinessRouter(options));

  return router;
}
