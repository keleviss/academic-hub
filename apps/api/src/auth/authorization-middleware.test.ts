import { createHmac } from 'node:crypto';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { asyncHandler } from '../lib/async-handler.js';
import { errorHandler } from '../middleware/error-handler.js';
import {
  optionalAuth,
  attachCurrentSession,
  requireAuth,
  requireRole,
  createAuthorizationService,
} from './index.js';
import { createSessionService } from './session.js';

const userId = '33333333-3333-4333-8333-333333333333';
const courseId = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-09-07T12:00:00Z');
const cookieName = 'test_session';
const token = 'a'.repeat(43);
const secret = 'test-session-secret-with-enough-length-0000';

function fixture(
  options: {
    role?: UserRole;
    revoked?: boolean;
    expired?: boolean;
    active?: boolean;
  } = {},
) {
  const user = {
    id: userId,
    email: 'user@example.edu',
    fullName: 'Test User',
    role: options.role ?? 'student',
    isActive: options.active ?? true,
  };
  const session = {
    id: createHmac('sha256', secret).update(token).digest('base64url'),
    user,
    revokedAt: options.revoked ? now : null,
    expiresAt: new Date(now.getTime() + (options.expired ? 0 : 60_000)),
  };
  const sessionPrisma = {
    session: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === session.id ? session : null,
      ),
    },
  };
  const sessionService = createSessionService({
    prisma: sessionPrisma as unknown as Pick<PrismaClient, 'session'>,
    now: () => now,
    env: { SESSION_SECRET: secret, SESSION_COOKIE_MAX_AGE_SECONDS: 60 },
  });
  const lookup = vi.spyOn(sessionService, 'getSession');
  const auditLogger = { logAuditEvent: vi.fn().mockResolvedValue(undefined) };
  const gateOptions = { sessionService, auditLogger, cookieName };
  const app = express();
  app.use(cookieParser());
  app.get('/optional', optionalAuth(sessionService, cookieName), (req, res) =>
    res.json({ authenticated: !!req.currentSession }),
  );
  app.get('/protected', requireAuth(gateOptions), (req, res) =>
    res.json({ userId: req.currentSession!.user.id }),
  );
  app.get('/professor', requireRole(['professor'], gateOptions), (_req, res) =>
    res.sendStatus(204),
  );
  app.get(
    '/admin-or-professor',
    requireRole(['admin', 'professor'], gateOptions),
    (_req, res) => res.sendStatus(204),
  );
  app.get('/empty', requireRole([], gateOptions), (_req, res) =>
    res.sendStatus(204),
  );
  app.get(
    '/composed',
    optionalAuth(sessionService, cookieName),
    optionalAuth(sessionService, cookieName),
    requireAuth(gateOptions),
    requireRole(['student'], gateOptions),
    (_req, res) => res.sendStatus(204),
  );

  const coursePrisma = { course: { findUnique: vi.fn(async () => null) } };
  const authorization = createAuthorizationService({
    prisma: coursePrisma as unknown as Pick<
      PrismaClient,
      'course' | 'courseInstructor' | 'enrollment' | 'document'
    >,
    auditLogger,
  });
  app.get(
    '/courses/:courseId',
    requireAuth(gateOptions),
    asyncHandler(async (req, res) => {
      await authorization.assertCourseAccess(
        req.currentSession!.user,
        req.params.courseId as string,
      );
      res.sendStatus(204);
    }),
  );
  app.use(errorHandler);
  return { app, lookup, auditLogger, sessionPrisma, coursePrisma };
}

const cookie = `${cookieName}=${token}`;
const unauthenticated = {
  error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
};
const forbidden = { error: { code: 'FORBIDDEN', message: 'Access denied' } };

describe('optional authentication and session gates', () => {
  it('preserves the attachCurrentSession export', () => {
    expect(optionalAuth).toBe(attachCurrentSession);
  });

  it('allows anonymous optional authentication and attaches valid users', async () => {
    const f = fixture();
    expect((await request(f.app).get('/optional').expect(200)).body).toEqual({
      authenticated: false,
    });
    expect(
      (await request(f.app).get('/optional').set('Cookie', cookie).expect(200))
        .body,
    ).toEqual({ authenticated: true });
    expect(
      (await request(f.app).get('/protected').set('Cookie', cookie).expect(200))
        .body,
    ).toEqual({ userId });
  });

  for (const state of [
    'missing',
    'malformed',
    'unknown',
    'expired',
    'revoked',
    'inactive',
  ] as const) {
    it(`treats ${state} session as anonymous and returns consistent 401 at gates`, async () => {
      const f = fixture({
        expired: state === 'expired',
        revoked: state === 'revoked',
        active: state !== 'inactive',
      });
      const headers =
        state === 'missing'
          ? {}
          : {
              Cookie: `${cookieName}=${state === 'malformed' ? 'bad' : state === 'unknown' ? 'b'.repeat(43) : token}`,
            };
      const optional = await request(f.app)
        .get('/optional')
        .set(headers)
        .expect(200);
      expect(optional.body).toEqual({ authenticated: false });
      for (const path of ['/protected', '/professor']) {
        const response = await request(f.app)
          .get(path)
          .set(headers)
          .expect(401);
        expect(response.body).toEqual(unauthenticated);
      }
    });
  }

  it('reuses the session lookup across composed middleware', async () => {
    const f = fixture();
    await request(f.app).get('/composed').set('Cookie', cookie).expect(204);
    expect(f.lookup).toHaveBeenCalledTimes(1);
  });

  it('reuses null and does not retry anonymous session lookups', async () => {
    const f = fixture();
    await request(f.app).get('/composed').expect(401);
    expect(f.lookup).toHaveBeenCalledTimes(1);
    expect(f.auditLogger.logAuditEvent).toHaveBeenCalledTimes(1);
  });

  it('does not cache authentication across separate requests', async () => {
    const f = fixture();
    await request(f.app).get('/protected').set('Cookie', cookie).expect(200);
    f.sessionPrisma.session.findUnique.mockResolvedValue(null);
    await request(f.app).get('/protected').set('Cookie', cookie).expect(401);
    expect(f.lookup).toHaveBeenCalledTimes(2);
  });
});

describe('role gates and audit errors', () => {
  it('allows a professor and does not implicitly allow admin', async () => {
    await request(fixture({ role: 'professor' }).app)
      .get('/professor')
      .set('Cookie', cookie)
      .expect(204);
    const admin = fixture({ role: 'admin' });
    expect(
      (
        await request(admin.app)
          .get('/professor')
          .set('Cookie', cookie)
          .expect(403)
      ).body,
    ).toEqual(forbidden);
    await request(admin.app)
      .get('/admin-or-professor')
      .set('Cookie', cookie)
      .expect(204);
  });

  it('rejects wrong roles and empty role lists', async () => {
    const f = fixture();
    expect(
      (await request(f.app).get('/professor').set('Cookie', cookie).expect(403))
        .body,
    ).toEqual(forbidden);
    await request(f.app).get('/empty').set('Cookie', cookie).expect(403);
  });

  it('excludes query strings, tokens and cookies from denial audits', async () => {
    const f = fixture();
    await request(f.app)
      .get('/professor?token=secret')
      .set('Cookie', cookie)
      .expect(403);
    expect(f.auditLogger.logAuditEvent).toHaveBeenCalledExactlyOnceWith({
      action: 'auth.denied',
      actorId: userId,
      entityType: 'route',
      entityId: null,
      metadata: {
        reason: 'role_not_allowed',
        method: 'GET',
        route: '/professor',
      },
    });
  });

  it('preserves 401 and 403 if the injected audit logger throws', async () => {
    const f = fixture();
    f.auditLogger.logAuditEvent.mockRejectedValue(
      new Error('audit database unavailable'),
    );
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await request(f.app).get('/protected').expect(401)).body).toEqual(
        unauthenticated,
      );
      expect(
        (
          await request(f.app)
            .get('/professor')
            .set('Cookie', cookie)
            .expect(403)
        ).body,
      ).toEqual(forbidden);
    } finally {
      log.mockRestore();
    }
  });

  it.each(['/optional', '/protected', '/professor'])(
    'returns 500 on session DB failure at %s',
    async (path) => {
      const f = fixture();
      f.sessionPrisma.session.findUnique.mockRejectedValue(
        new Error('private database details'),
      );
      expect(
        (await request(f.app).get(path).set('Cookie', cookie).expect(500)).body,
      ).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Unexpected server error',
        },
      });
      expect(f.auditLogger.logAuditEvent).not.toHaveBeenCalled();
    },
  );

  it('uses consistent 400/404/500 resource error envelopes', async () => {
    const f = fixture({ role: 'admin' });
    const invalid = await request(f.app)
      .get('/courses/not-a-uuid')
      .set('Cookie', cookie)
      .expect(400);
    expect(invalid.body.error).toMatchObject({
      code: 'REQUEST_VALIDATION_ERROR',
      details: {
        issues: [
          {
            source: 'params',
            path: ['courseId'],
            code: 'invalid_format',
            message: expect.any(String),
          },
        ],
      },
    });
    expect(f.coursePrisma.course.findUnique).not.toHaveBeenCalled();
    expect(
      (
        await request(f.app)
          .get(`/courses/${courseId}`)
          .set('Cookie', cookie)
          .expect(404)
      ).body,
    ).toEqual({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
    f.coursePrisma.course.findUnique.mockRejectedValue(
      new Error('private database details'),
    );
    expect(
      (
        await request(f.app)
          .get(`/courses/${courseId}`)
          .set('Cookie', cookie)
          .expect(500)
      ).body,
    ).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected server error',
      },
    });
  });
});
