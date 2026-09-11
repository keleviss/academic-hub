import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';

import { env } from '../config/env.js';
import { asyncHandler } from '../lib/async-handler.js';
import { createAuditLogger, type AuditLogger } from './audit-log.js';
import { denyAccess } from './authorization-denial.js';
import { resolveCurrentSession } from './current-session-middleware.js';
import { createSessionService, type SessionService } from './session.js';

export interface AuthorizationMiddlewareOptions {
  sessionService?: SessionService;
  auditLogger?: AuditLogger;
  cookieName?: string;
}

export function requireAuth(
  options: AuthorizationMiddlewareOptions = {},
): RequestHandler {
  return createGate(undefined, options);
}

export function requireRole(
  roles: readonly UserRole[],
  options: AuthorizationMiddlewareOptions = {},
): RequestHandler {
  return createGate([...roles], options);
}

function createGate(
  roles: readonly UserRole[] | undefined,
  options: AuthorizationMiddlewareOptions,
): RequestHandler {
  const sessionService = options.sessionService ?? createSessionService();
  const auditLogger = options.auditLogger ?? createAuditLogger();
  const cookieName = options.cookieName ?? env.SESSION_COOKIE_NAME;

  return asyncHandler(async (request, _response, next) => {
    const session = await resolveCurrentSession(
      request,
      sessionService,
      cookieName,
    );
    const context = {
      method: request.method,
      route: `${request.baseUrl}${typeof request.route?.path === 'string' ? request.route.path : request.path}`,
    };
    if (!session) {
      await denyAccess(
        auditLogger,
        {
          entityType: 'route',
          reason: 'unauthenticated',
          context,
        },
        401,
      );
      return;
    }
    if (roles && !roles.includes(session.user.role)) {
      await denyAccess(auditLogger, {
        actorId: session.user.id,
        entityType: 'route',
        reason: 'role_not_allowed',
        context,
      });
      return;
    }
    next();
  });
}
