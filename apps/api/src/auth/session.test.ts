import type { PrismaClient, UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  createSessionService,
  type CreateSessionServiceOptions,
} from './session.js';

const baseEnv = {
  SESSION_COOKIE_MAX_AGE_SECONDS: 60 * 60,
  SESSION_SECRET: 'test-session-secret-with-enough-length',
};

const activeUser = {
  email: 'student@example.edu',
  fullName: 'Example Student',
  id: '33333333-3333-4333-8333-333333333333',
  isActive: true,
  role: 'student' as UserRole,
};

type StoredSession = {
  expiresAt: Date;
  id: string;
  ipHash: string | null;
  revokedAt: Date | null;
  user: typeof activeUser;
  userAgentHash: string | null;
  userId: string;
};

function createTestService(
  options: Partial<CreateSessionServiceOptions> & {
    initialSessions?: StoredSession[];
    user?: typeof activeUser;
  } = {},
) {
  const sessions = new Map<string, StoredSession>();
  const user = options.user ?? activeUser;

  for (const session of options.initialSessions ?? []) {
    sessions.set(session.id, session);
  }

  const prisma = {
    session: {
      create: async ({
        data,
      }: {
        data: {
          expiresAt: Date;
          id: string;
          ipHash: string | null;
          userAgentHash: string | null;
          userId: string;
        };
      }) => {
        const session: StoredSession = {
          ...data,
          revokedAt: null,
          user,
        };

        sessions.set(session.id, session);

        return session;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        sessions.get(where.id) ?? null,
      updateMany: async ({
        data,
        where,
      }: {
        data: { revokedAt: Date };
        where: { id: string; revokedAt: null };
      }) => {
        const session = sessions.get(where.id);

        if (!session || session.revokedAt !== where.revokedAt) {
          return { count: 0 };
        }

        session.revokedAt = data.revokedAt;
        sessions.set(where.id, session);

        return { count: 1 };
      },
    },
  } as unknown as Pick<PrismaClient, 'session'>;

  return {
    service: createSessionService({
      env: baseEnv,
      now: () => new Date('2026-09-02T10:00:00.000Z'),
      prisma,
      randomTokenBytes: () => Buffer.alloc(32, 1),
      ...options,
    }),
    sessions,
  };
}

describe('session service', () => {
  it('creates a session with an opaque browser token and hashed stored id', async () => {
    const { service, sessions } = createTestService();

    const session = await service.createSession(activeUser.id, {
      ipAddress: '192.0.2.10',
      userAgent: 'Vitest Browser',
    });

    expect(session.token).toHaveLength(43);
    expect(session.id).not.toBe(session.token);
    expect(sessions.has(session.id)).toBe(true);
    expect(session.expiresAt).toEqual(new Date('2026-09-02T11:00:00.000Z'));
    expect(session.user).toEqual(activeUser);

    const storedSession = sessions.get(session.id);
    expect(storedSession?.ipHash).toHaveLength(43);
    expect(storedSession?.ipHash).not.toBe('192.0.2.10');
    expect(storedSession?.userAgentHash).toHaveLength(43);
    expect(storedSession?.userAgentHash).not.toBe('Vitest Browser');
  });

  it('looks up an active session from the browser token', async () => {
    const { service } = createTestService();

    const createdSession = await service.createSession(activeUser.id);
    const session = await service.getSession(createdSession.token);

    expect(session).toEqual({
      expiresAt: createdSession.expiresAt,
      id: createdSession.id,
      user: activeUser,
    });
  });

  it('rejects missing, malformed, and unknown session tokens', async () => {
    const { service } = createTestService();

    await expect(service.getSession(undefined)).resolves.toBeNull();
    await expect(service.getSession(null)).resolves.toBeNull();
    await expect(
      service.getSession('not-a-valid-session-token'),
    ).resolves.toBeNull();
    await expect(service.getSession('A'.repeat(43))).resolves.toBeNull();
  });

  it('rejects expired sessions', async () => {
    let currentTime = new Date('2026-09-02T10:00:00.000Z').getTime();
    const { service } = createTestService({
      env: {
        ...baseEnv,
        SESSION_COOKIE_MAX_AGE_SECONDS: 1,
      },
      now: () => new Date(currentTime),
    });

    const createdSession = await service.createSession(activeUser.id);
    currentTime += 1001;

    await expect(service.getSession(createdSession.token)).resolves.toBeNull();
  });

  it('rejects revoked sessions and prevents later reuse', async () => {
    const { service } = createTestService();
    const createdSession = await service.createSession(activeUser.id);

    await expect(service.revokeSession(createdSession.token)).resolves.toBe(
      true,
    );
    await expect(service.getSession(createdSession.token)).resolves.toBeNull();
    await expect(service.revokeSession(createdSession.token)).resolves.toBe(
      false,
    );
  });

  it('rejects sessions for inactive users', async () => {
    const { service } = createTestService({
      user: {
        ...activeUser,
        isActive: false,
      },
    });

    const createdSession = await service.createSession(activeUser.id);

    await expect(service.getSession(createdSession.token)).resolves.toBeNull();
  });

  it('ignores malformed tokens during revocation', async () => {
    const { service } = createTestService();

    await expect(service.revokeSession('bad-token')).resolves.toBe(false);
    await expect(service.revokeSession(undefined)).resolves.toBe(false);
  });
});
