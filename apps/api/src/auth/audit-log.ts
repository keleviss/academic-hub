import type {
  AuditAction as PrismaAuditAction,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import type { AuditAction } from '@web-app/contracts';

import { prisma as defaultPrisma } from '../lib/prisma.js';

type AuditPrismaClient = Pick<PrismaClient, 'auditLog'>;

// Contracts use dot-separated action names; the Prisma enum uses underscores (@map'd to the dot form in the DB).
const AUDIT_ACTION_TO_PRISMA: Record<AuditAction, PrismaAuditAction> = {
  'auth.denied': 'auth_denied',
  'auth.login': 'auth_login',
  'auth.logout': 'auth_logout',
  'course.created': 'course_created',
  'document.deleted': 'document_deleted',
  'document.replaced': 'document_replaced',
  'document.uploaded': 'document_uploaded',
  'enrollment.changed': 'enrollment_changed',
  'role.changed': 'role_changed',
  'thread.category_changed': 'thread_category_changed',
  'user.created': 'user_created',
};

export interface AuditEventInput {
  action: AuditAction;
  actorId?: string | null;
  entityId?: string | null;
  entityType: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogger {
  logAuditEvent(input: AuditEventInput): Promise<void>;
}

export function createAuditLogger(
  prisma: AuditPrismaClient = defaultPrisma,
): AuditLogger {
  return {
    async logAuditEvent(input: AuditEventInput): Promise<void> {
      try {
        await prisma.auditLog.create({
          data: {
            action: AUDIT_ACTION_TO_PRISMA[input.action],
            actorId: input.actorId ?? null,
            entityId: input.entityId ?? null,
            entityType: input.entityType,
            metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        // Best-effort logging: never let audit failures break an auth request.
        console.error('Failed to write audit log event', {
          action: input.action,
          error,
        });
      }
    },
  };
}
