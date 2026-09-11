import { createHmac, randomBytes } from 'node:crypto';
import type { PrismaClient, UserRole } from '@prisma/client';

import { env, type Env } from '../config/env.js';
import { prisma as defaultPrisma } from '../lib/prisma.js';

const SESSION_TOKEN_BYTE_LENGTH = 32;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type SessionPrismaClient = Pick<PrismaClient, 'session'>;

export interface SessionRequestMetadata {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CurrentSessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface ActiveSession {
  id: string;
  expiresAt: Date;
  user: CurrentSessionUser;
}

export interface CreatedSession extends ActiveSession {
  token: string;
}

export interface SessionService {
  createSession: (
    userId: string,
    requestMetadata?: SessionRequestMetadata,
  ) => Promise<CreatedSession>;
  getSession: (
    token: string | null | undefined,
  ) => Promise<ActiveSession | null>;
  revokeSession: (token: string | null | undefined) => Promise<boolean>;
}

export interface CreateSessionServiceOptions {
  env?: Pick<Env, 'SESSION_COOKIE_MAX_AGE_SECONDS' | 'SESSION_SECRET'>;
  now?: () => Date;
  prisma?: SessionPrismaClient;
  randomTokenBytes?: (size: number) => Buffer;
}

export function createSessionService(
  options: CreateSessionServiceOptions = {},
): SessionService {
  const prisma = options.prisma ?? defaultPrisma;
  const serviceEnv = options.env ?? env;
  const now = options.now ?? (() => new Date());
  const randomTokenBytes = options.randomTokenBytes ?? randomBytes;

  return {
    async createSession(
      userId: string,
      requestMetadata: SessionRequestMetadata = {},
    ): Promise<CreatedSession> {
      const token = randomTokenBytes(SESSION_TOKEN_BYTE_LENGTH).toString(
        'base64url',
      );
      const sessionId = hashValue(token, serviceEnv.SESSION_SECRET);
      const expiresAt = new Date(
        now().getTime() + serviceEnv.SESSION_COOKIE_MAX_AGE_SECONDS * 1000,
      );

      const session = await prisma.session.create({
        data: {
          expiresAt,
          id: sessionId,
          ipHash: hashOptionalMetadata(
            requestMetadata.ipAddress,
            serviceEnv.SESSION_SECRET,
          ),
          userAgentHash: hashOptionalMetadata(
            requestMetadata.userAgent,
            serviceEnv.SESSION_SECRET,
          ),
          userId,
        },
        include: {
          user: true,
        },
      });

      return {
        expiresAt: session.expiresAt,
        id: session.id,
        token,
        user: toCurrentSessionUser(session.user),
      };
    },

    async getSession(
      token: string | null | undefined,
    ): Promise<ActiveSession | null> {
      if (!isValidSessionToken(token)) {
        return null;
      }

      const session = await prisma.session.findUnique({
        where: { id: hashValue(token, serviceEnv.SESSION_SECRET) },
        include: { user: true },
      });

      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= now() ||
        !session.user.isActive
      ) {
        return null;
      }

      return {
        expiresAt: session.expiresAt,
        id: session.id,
        user: toCurrentSessionUser(session.user),
      };
    },

    async revokeSession(token: string | null | undefined): Promise<boolean> {
      if (!isValidSessionToken(token)) {
        return false;
      }

      const sessionId = hashValue(token, serviceEnv.SESSION_SECRET);
      const result = await prisma.session.updateMany({
        data: { revokedAt: now() },
        where: {
          id: sessionId,
          revokedAt: null,
        },
      });

      return result.count > 0;
    },
  };
}

const defaultSessionService = createSessionService();

export async function createSession(
  userId: string,
  requestMetadata?: SessionRequestMetadata,
): Promise<CreatedSession> {
  return defaultSessionService.createSession(userId, requestMetadata);
}

export async function getSession(
  token: string | null | undefined,
): Promise<ActiveSession | null> {
  return defaultSessionService.getSession(token);
}

export async function revokeSession(
  token: string | null | undefined,
): Promise<boolean> {
  return defaultSessionService.revokeSession(token);
}

function hashOptionalMetadata(
  value: string | null | undefined,
  secret: string,
): string | null {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  return hashValue(trimmedValue, secret);
}

function hashValue(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function isValidSessionToken(
  token: string | null | undefined,
): token is string {
  return typeof token === 'string' && SESSION_TOKEN_PATTERN.test(token);
}

function toCurrentSessionUser(user: {
  email: string;
  fullName: string;
  id: string;
  isActive: boolean;
  role: UserRole;
}): CurrentSessionUser {
  return {
    email: user.email,
    fullName: user.fullName,
    id: user.id,
    isActive: user.isActive,
    role: user.role,
  };
}
