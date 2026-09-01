import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ApiErrorResponseSchema } from '@web-app/contracts';

import { errorHandler } from '../middleware/error-handler.js';
import { asyncHandler } from './async-handler.js';
import { validateRequest } from './request-validation.js';

const paramsSchema = z.object({
  widgetId: z.coerce.number().int().positive(),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
});

const bodySchema = z.object({
  title: z.string().min(3),
});

function createValidationTestApp(): express.Express {
  const app = express();

  app.use(express.json());
  app.post(
    '/widgets/:widgetId',
    validateRequest({
      body: bodySchema,
      params: paramsSchema,
      query: querySchema,
    }),
    asyncHandler((request, response) => {
      const body = request.body as z.infer<typeof bodySchema>;
      const params = request.params as unknown as z.infer<typeof paramsSchema>;
      const query = request.query as unknown as z.infer<typeof querySchema>;

      response.status(200).json({
        page: query.page,
        title: body.title,
        widgetId: params.widgetId,
      });
    }),
  );
  app.use(errorHandler);

  return app;
}

describe('validateRequest', () => {
  it('passes parsed body, params, and query data to the next handler', async () => {
    const app = createValidationTestApp();

    const response = await request(app)
      .post('/widgets/42?page=2')
      .send({ title: 'Week one notes' })
      .expect(200);

    expect(response.body).toEqual({
      page: 2,
      title: 'Week one notes',
      widgetId: 42,
    });
  });

  it('returns the shared API error shape for invalid request data', async () => {
    const app = createValidationTestApp();

    const response = await request(app)
      .post('/widgets/not-a-number?page=0')
      .send({ title: 'no' })
      .expect(400);
    const apiError = ApiErrorResponseSchema.parse(response.body);

    expect(apiError.error.code).toBe('REQUEST_VALIDATION_ERROR');
    expect(apiError.error.message).toBe('Request validation failed');
    expect(apiError.error.details).toEqual({
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: expect.any(String),
          message: expect.any(String),
          path: ['widgetId'],
          source: 'params',
        }),
        expect.objectContaining({
          code: expect.any(String),
          message: expect.any(String),
          path: ['page'],
          source: 'query',
        }),
        expect.objectContaining({
          code: expect.any(String),
          message: expect.any(String),
          path: ['title'],
          source: 'body',
        }),
      ]),
    });
  });
});
