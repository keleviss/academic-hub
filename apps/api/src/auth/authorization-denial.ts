import { HttpError } from '../lib/http-error.js';
import type { AuditLogger } from './audit-log.js';

export interface AuthorizationRequestContext {
  method: string;
  route: string;
}

export interface AuthorizationDenial {
  actorId?: string;
  entityType: 'route' | 'course' | 'document';
  entityId?: string;
  reason: string;
  context?: AuthorizationRequestContext;
}

export async function denyAccess(
  auditLogger: AuditLogger,
  denial: AuthorizationDenial,
  status: 401 | 403 = 403,
): Promise<never> {
  try {
    await auditLogger.logAuditEvent({
      action: 'auth.denied',
      actorId: denial.actorId ?? null,
      entityType: denial.entityType,
      entityId: denial.entityId ?? null,
      metadata: {
        reason: denial.reason,
        ...(denial.context && {
          method: denial.context.method,
          route: denial.context.route.split(/[?#]/, 1)[0],
        }),
      },
    });
  } catch {
    // Also contain failures from injected loggers; denial must remain fail-closed.
    console.error('Failed to record authorization denial');
  }

  throw new HttpError(
    status,
    status === 401 ? 'Authentication required' : 'Access denied',
    undefined,
    status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN',
  );
}
