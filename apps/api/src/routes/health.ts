import { Router } from 'express';
import { HealthResponseSchema, type HealthResponse } from '@web-app/contracts';

export interface HealthRouteOptions {
  now?: () => Date;
  serviceName?: string;
  version?: string;
}

export function createHealthRouter(options: HealthRouteOptions = {}): Router {
  const router = Router();
  const now = options.now ?? (() => new Date());
  const serviceName = options.serviceName ?? 'api';

  router.get('/', (_request, response, next) => {
    void _request;

    try {
      const payload: HealthResponse = {
        status: 'ok',
        service: serviceName,
        timestamp: now().toISOString(),
        version: options.version,
      };

      response.status(200).json(HealthResponseSchema.parse(payload));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
