import { describe, expect, it } from 'vitest';

import { CurrentSessionSchema } from './auth.js';
import { ApiErrorResponseSchema, PaginationQuerySchema } from './common.js';
import { HealthResponseSchema } from './health.js';

describe('shared API schemas', () => {
  it('parses a safe current session response', () => {
    const session = CurrentSessionSchema.parse({
      authenticated: true,
      csrfToken: 'csrf-token',
      user: {
        id: '6f1c4b80-0421-4fcb-9d49-71c1dd44b675',
        email: 'student@example.edu',
        fullName: 'Example Student',
        role: 'student',
        isActive: true,
      },
    });

    expect(session.user?.role).toBe('student');
  });

  it('parses common health and error responses', () => {
    expect(
      HealthResponseSchema.parse({
        status: 'ok',
        service: 'api',
        timestamp: '2026-08-25T00:00:00.000Z',
      }).status,
    ).toBe('ok');

    expect(
      ApiErrorResponseSchema.parse({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body.',
        },
      }).error.code,
    ).toBe('VALIDATION_ERROR');
  });

  it('normalizes pagination query defaults', () => {
    expect(PaginationQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
    });
  });
});
