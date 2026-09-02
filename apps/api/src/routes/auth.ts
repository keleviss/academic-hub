import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import {
  CsrfResponseSchema,
  CurrentSessionSchema,
  LoginRequestSchema,
  type CsrfResponse,
  type CurrentSession,
  type LoginRequest,
} from '@web-app/contracts';

import { env } from '../config/env.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/http-error.js';
import { prisma as defaultPrisma } from '../lib/prisma.js';
import { sendJson } from '../lib/send-json.js';
import { validateRequest } from '../lib/request-validation.js';
import { type AuditLogger, createAuditLogger } from '../auth/audit-log.js';
import {
  computeCsrfToken,
  generateCsrfNonce,
  requireCsrf,
  setCsrfCookie,
} from '../auth/csrf.js';
import { attachCurrentSession } from '../auth/current-session-middleware.js';
import {
  clearSessionCookie,
  setSessionCookie,
} from '../auth/session-cookie.js';
import { createSessionService, type SessionService } from '../auth/session.js';
import { verifyPassword } from '../auth/password.js';

type AuthPrismaClient = Pick<PrismaClient, 'user'>;

export interface AuthRouteOptions {
  auditLogger?: AuditLogger;
  prisma?: AuthPrismaClient;
  sessionService?: SessionService;
}

export function createAuthRouter(options: AuthRouteOptions = {}): Router {
  const router = Router();
  const prisma = options.prisma ?? defaultPrisma;
  const sessionService = options.sessionService ?? createSessionService();
  const auditLogger = options.auditLogger ?? createAuditLogger();

  router.get(
    '/csrf',
    asyncHandler((_request, response) => {
      void _request;

      const nonce = generateCsrfNonce();
      setCsrfCookie(response, nonce);

      const payload: CsrfResponse = {
        csrfToken: computeCsrfToken(nonce, env.CSRF_SECRET),
      };

      sendJson(response, 200, CsrfResponseSchema, payload);
    }),
  );

  router.post(
    '/login',
    requireCsrf(),
    validateRequest({ body: LoginRequestSchema }),
    asyncHandler(async (request, response) => {
      const { email, password } = request.body as LoginRequest;

      const user = await prisma.user.findUnique({ where: { email } });
      const passwordValid =
        !!user && (await verifyPassword(user.passwordHash, password));

      if (!user || !user.isActive || !passwordValid) {
        await auditLogger.logAuditEvent({
          action: 'auth.denied',
          actorId: user?.id ?? null,
          entityId: user?.id ?? null,
          entityType: 'user',
          metadata: {
            email,
            reason: !user
              ? 'unknown_email'
              : !user.isActive
                ? 'inactive_user'
                : 'bad_password',
          },
        });

        throw new HttpError(
          401,
          'Invalid email or password',
          undefined,
          'INVALID_CREDENTIALS',
        );
      }

      const session = await sessionService.createSession(user.id, {
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      });

      setSessionCookie(response, session.token);

      await auditLogger.logAuditEvent({
        action: 'auth.login',
        actorId: user.id,
        entityId: user.id,
        entityType: 'user',
      });

      const payload: CurrentSession = {
        authenticated: true,
        user: session.user,
      };

      sendJson(response, 200, CurrentSessionSchema, payload);
    }),
  );

  router.post(
    '/logout',
    requireCsrf(),
    attachCurrentSession(sessionService),
    asyncHandler(async (request, response) => {
      const token = request.cookies?.[env.SESSION_COOKIE_NAME] as
        | string
        | undefined;
      const actorId = request.currentSession?.user.id ?? null;

      await sessionService.revokeSession(token);
      clearSessionCookie(response);

      if (actorId) {
        await auditLogger.logAuditEvent({
          action: 'auth.logout',
          actorId,
          entityId: actorId,
          entityType: 'user',
        });
      }

      const payload: CurrentSession = { authenticated: false, user: null };

      sendJson(response, 200, CurrentSessionSchema, payload);
    }),
  );

  router.get(
    '/session',
    attachCurrentSession(sessionService),
    asyncHandler((request, response) => {
      const session = request.currentSession;
      const payload: CurrentSession = session
        ? { authenticated: true, user: session.user }
        : { authenticated: false, user: null };

      sendJson(response, 200, CurrentSessionSchema, payload);
    }),
  );

  return router;
}
