import { Router } from 'express';

import { createHealthRouter, type HealthRouteOptions } from './health.js';

export type ApiRouterOptions = HealthRouteOptions;

export function createApiRouter(options: ApiRouterOptions = {}): Router {
  const router = Router();

  router.use('/health', createHealthRouter(options));

  return router;
}
