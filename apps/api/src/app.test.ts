import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { HealthResponseSchema } from '@web-app/contracts';

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
