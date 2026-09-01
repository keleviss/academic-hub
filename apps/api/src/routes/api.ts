import { Router } from 'express';

import { createHealthRouter, type HealthRouteOptions } from './health.js';
import {
  createReadinessRouter,
  type ReadinessRouteOptions,
} from './readiness.js';

export type ApiRouterOptions = HealthRouteOptions & ReadinessRouteOptions;

export function createApiRouter(options: ApiRouterOptions = {}): Router {
  const router = Router();

  router.use('/health', createHealthRouter(options));
  router.use('/readiness', createReadinessRouter(options));

  return router;
}
