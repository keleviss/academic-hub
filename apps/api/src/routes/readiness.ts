import { Router } from 'express';

import {
  ReadinessResponseSchema,
  type DatabaseReadinessCheck,
  type ReadinessResponse,
  type StorageReadinessCheck,
} from '@web-app/contracts';

import { checkDatabaseReadiness } from '../lib/database-readiness.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { sendJson } from '../lib/send-json.js';
import { createStorageService } from '../storage/storage-service.js';

export interface ReadinessRouteOptions {
  databaseCheck?: () => Promise<DatabaseReadinessCheck>;
  now?: () => Date;
  serviceName?: string;
  storageCheck?: () => Promise<StorageReadinessCheck>;
  version?: string;
}

export function createReadinessRouter(
  options: ReadinessRouteOptions = {},
): Router {
  const router = Router();
  const databaseCheck =
    options.databaseCheck ?? (() => checkDatabaseReadiness(prisma));
  const storageCheck =
    options.storageCheck ??
    (() => createStorageService().checkBucketReadiness());
  const now = options.now ?? (() => new Date());
  const serviceName = options.serviceName ?? 'api';

  router.get(
    '/',
    asyncHandler(async (_request, response) => {
      void _request;

      const [database, storage] = await Promise.all([
        databaseCheck(),
        storageCheck(),
      ]);
      const status =
        database.status === 'ok' && storage.status === 'ok'
          ? 'ok'
          : 'degraded';
      const payload: ReadinessResponse = {
        checks: { database, storage },
        service: serviceName,
        status,
        timestamp: now().toISOString(),
        version: options.version,
      };

      sendJson(
        response,
        status === 'ok' ? 200 : 503,
        ReadinessResponseSchema,
        payload,
      );
    }),
  );

  return router;
}