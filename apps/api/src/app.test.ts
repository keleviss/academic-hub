import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import {
  HealthResponseSchema,
  ReadinessResponseSchema,
} from '@web-app/contracts';

import { createApp } from './app.js';

describe('api app', () => {
  it('returns the shared health response contract', async () => {
    const app = createApp({
      serviceName: 'api-test',
      version: '0.0.0-test',
    });

    const response = await request(app).get('/api/health').expect(200);
    const health = HealthResponseSchema.parse(response.body);

    expect(health).toMatchObject({
      status: 'ok',
      service: 'api-test',
      version: '0.0.0-test',
    });
    expect(new Date(health.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('returns ready when database and storage are available', async () => {
    const databaseCheck = vi.fn().mockResolvedValue({ status: 'ok' });
    const storageCheck = vi.fn().mockResolvedValue({ status: 'ok' });
    const app = createApp({ databaseCheck, storageCheck });

    const response = await request(app).get('/api/readiness').expect(200);
    const readiness = ReadinessResponseSchema.parse(response.body);

    expect(readiness).toMatchObject({
      checks: {
        database: { status: 'ok' },
        storage: { status: 'ok' },
      },
      status: 'ok',
    });
    expect(databaseCheck).toHaveBeenCalledOnce();
    expect(storageCheck).toHaveBeenCalledOnce();
  });

  it('returns a safe 503 when the database is unavailable', async () => {
    const app = createApp({
      databaseCheck: async () => ({
        reason: 'database_unavailable',
        status: 'degraded',
      }),
      storageCheck: async () => ({ status: 'ok' }),
    });

    const response = await request(app).get('/api/readiness').expect(503);
    const readiness = ReadinessResponseSchema.parse(response.body);

    expect(readiness).toMatchObject({
      checks: {
        database: {
          reason: 'database_unavailable',
          status: 'degraded',
        },
        storage: { status: 'ok' },
      },
      status: 'degraded',
    });
    expect(JSON.stringify(response.body)).not.toContain('password rejected');
  });

  it('returns a safe 503 when storage is unavailable', async () => {
    const app = createApp({
      databaseCheck: async () => ({ status: 'ok' }),
      storageCheck: async () => ({
        reason: 'storage_unavailable',
        status: 'degraded',
      }),
    });

    const response = await request(app).get('/api/readiness').expect(503);
    const readiness = ReadinessResponseSchema.parse(response.body);

    expect(readiness).toMatchObject({
      checks: {
        database: { status: 'ok' },
        storage: {
          reason: 'storage_unavailable',
          status: 'degraded',
        },
      },
      status: 'degraded',
    });
  });

  it('reports both dependency failures together', async () => {
    const app = createApp({
      databaseCheck: async () => ({
        reason: 'database_unavailable',
        status: 'degraded',
      }),
      storageCheck: async () => ({
        reason: 'bucket_missing',
        status: 'degraded',
      }),
    });

    const response = await request(app).get('/api/readiness').expect(503);

    expect(ReadinessResponseSchema.parse(response.body)).toMatchObject({
      checks: {
        database: {
          reason: 'database_unavailable',
          status: 'degraded',
        },
        storage: {
          reason: 'bucket_missing',
          status: 'degraded',
        },
      },
      status: 'degraded',
    });
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const app = createApp();

    const response = await request(app).get('/api/missing').expect(404);

    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route GET /api/missing not found',
      },
    });
  });
});
