import { Router } from 'express';
import { HealthResponseSchema, type HealthResponse } from '@web-app/contracts';

import { asyncHandler } from '../lib/async-handler.js';
import { sendJson } from '../lib/send-json.js';

export interface HealthRouteOptions {
  now?: () => Date;
  serviceName?: string;
  version?: string;
}

export function createHealthRouter(options: HealthRouteOptions = {}): Router {
  const router = Router();
  const now = options.now ?? (() => new Date());
  const serviceName = options.serviceName ?? 'api';

  router.get(
    '/',
    asyncHandler((_request, response) => {
      void _request;

      const payload: HealthResponse = {
        status: 'ok',
        service: serviceName,
        timestamp: now().toISOString(),
        version: options.version,
      };

      sendJson(response, 200, HealthResponseSchema, payload);
    }),
  );

  return router;
}
