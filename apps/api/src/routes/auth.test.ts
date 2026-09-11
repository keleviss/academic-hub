import type { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CsrfResponseSchema, CurrentSessionSchema } from '@web-app/contracts';

import { createApp } from '../app.js';
import type { AuditLogger } from '../auth/audit-log.js';
import { hashPassword } from '../auth/password.js';
import { createSessionService } from '../auth/session.js';
import { env } from '../config/env.js';

const testEnv = {
  SESSION_COOKIE_MAX_AGE_SECONDS: 60 * 60,
  SESSION_SECRET: 'test-session-secret-with-enough-length-0000',
};

const activeUser = {
  email: 'student@example.edu',
  fullName: 'Example Student',
  id: '11111111-1111-4111-8111-111111111111',
  isActive: true,
  role: 'student' as UserRole,
};

const inactiveUser = {
  email: 'inactive@example.edu',
  fullName: 'Inactive User',
  id: '22222222-2222-4222-8222-222222222222',
  isActive: false,
  role: 'student' as UserRole,
};

const PASSWORD = 'Sup3rSecretPass!';

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

type StoredSession = {
  expiresAt: Date;
  id: string;
  ipHash: string | null;
  revokedAt: Date | null;
  user: typeof activeUser;
  userAgentHash: string | null;
  userId: string;
};

function createTestApp(nowRef: { current: Date } = { current: new Date() }) {
  const users = new Map([
    [activeUser.email, { ...activeUser, passwordHash }],
    [inactiveUser.email, { ...inactiveUser, passwordHash }],
  ]);
  const sessions = new Map<string, StoredSession>();

  const userPrisma = {
    findUnique: async ({ where }: { where: { email: string } }) =>
      users.get(where.email) ?? null,
  };

  const sessionPrisma = {
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
        const user = [...users.values()].find(
          (candidate) => candidate.id === data.userId,
        );
        const session: StoredSession = {
          ...data,
          revokedAt: null,
          user: user!,
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

  const sessionService = createSessionService({
    env: testEnv,
    now: () => nowRef.current,
    prisma: sessionPrisma,
  });

  const auditLogger: AuditLogger = {
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
  };

  const app = createApp({
    authPrisma: { user: userPrisma } as unknown as Pick<PrismaClient, 'user'>,
    auditLogger,
    sessionService,
  });

  return { app, auditLogger, sessions };
}

async function bootstrapCsrf(
  agent: ReturnType<typeof request.agent>,
): Promise<string> {
  const response = await agent.get('/api/auth/csrf').expect(200);
  return CsrfResponseSchema.parse(response.body).csrfToken;
}

function extractCookieValue(
  setCookieHeaders: string[] | undefined,
  name: string,
): string | undefined {
  const cookie = setCookieHeaders?.find((header) =>
    header.startsWith(`${name}=`),
  );

  return cookie?.split(';')[0]?.slice(name.length + 1);
}

describe('auth routes', () => {
  it('logs in an active user and sets a session cookie', async () => {
    const { app } = createTestApp();
    const agent = request.agent(app);
    const csrfToken = await bootstrapCsrf(agent);

    const response = await agent
      .post('/api/auth/login')
      .set(env.CSRF_HEADER_NAME, csrfToken)
      .send({ email: activeUser.email, password: PASSWORD })
      .expect(200);

    expect(CurrentSessionSchema.parse(response.body)).toMatchObject({
      authenticated: true,
      user: { email: activeUser.email, id: activeUser.id },
    });
    expect(
      extractCookieValue(
        response.headers['set-cookie'],
        env.SESSION_COOKIE_NAME,
      ),
    ).toBeTruthy();
  });

  it('rejects an unknown email with a generic 401 and no session cookie', async () => {
    const { app, auditLogger } = createTestApp();
    const agent = request.agent(app);
    const csrfToken = await bootstrapCsrf(agent);

    const response = await agent
      .post('/api/auth/login')
      .set(env.CSRF_HEADER_NAME, csrfToken)
      .send({ email: 'nobody@example.edu', password: PASSWORD })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(
      extractCookieValue(
        response.headers['set-cookie'],
        env.SESSION_COOKIE_NAME,
      ),
    ).toBeFalsy();
    expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.denied' }),
    );
  });

  it('rejects a wrong password with the same generic 401 message', async () => {
    const { app } = createTestApp();
    const agent = request.agent(app);
    const csrfToken = await bootstrapCsrf(agent);

    const response = await agent
      .post('/api/auth/login')
      .set(env.CSRF_HEADER_NAME, csrfToken)
      .send({ email: activeUser.email, password: 'totally-wrong-password' })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(response.body.error.message).toBe('Invalid email or password');
  });

  it('rejects an inactive user with the same generic 401 message', async () => {
    const { app } = createTestApp();
    const agent = request.agent(app);
    const csrfToken = await bootstrapCsrf(agent);

    const response = await agent
      .post('/api/auth/login')
      .set(env.CSRF_HEADER_NAME, csrfToken)
      .send({ email: inactiveUser.email, password: PASSWORD })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(response.body.error.message).toBe('Invalid email or password');
  });

  it('rejects login without a valid CSRF token', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: activeUser.email, password: PASSWORD })
      .expect(403);

    expect(response.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('returns unauthenticated session state without a cookie', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/auth/session').expect(200);

    expect(CurrentSessionSchema.parse(response.body)).toEqual({
      authenticated: false,
      user: null,
    });
  });

  it('returns safe user data for a valid active session', async () => {
    const { app } = createTestApp();
    const agent = request.agent(app);
    const csrfToken = await bootstrapCsrf(agent);
    await agent
      .post('/api/auth/login')
      .set(env.CSRF_HEADER_NAME, csrfToken)
      .send({ email: activeUser.email, password: PASSWORD })
      .expect(200);

    const response = await agent.get('/api/auth/session').expect(200);

    expect(CurrentSessionSchema.parse(response.body)).toMatchObject({
      authenticated: true,
      user: { email: activeUser.email, id: activeUser.id },
    });
  });

  it('returns unauthenticated state for an expired session', async () => {
    const nowRef = { current: new Date('2026-09-02T10:00:00.000Z') };
    const { app } = createTestApp(nowRef);
    const agent = request.agent(app);
    const csrfToken = await bootstrapCsrf(agent);
    await agent
      .post('/api/auth/login')
      .set(env.CSRF_HEADER_NAME, csrfToken)
      .send({ email: activeUser.email, password: PASSWORD })
      .expect(200);

    nowRef.current = new Date(
      nowRef.current.getTime() +
        (testEnv.SESSION_COOKIE_MAX_AGE_SECONDS + 1) * 1000,
    );

    const response = await agent.get('/api/auth/session').expect(200);

    expect(CurrentSessionSchema.parse(response.body)).toEqual({
      authenticated: false,
      user: null,
    });
  });

  it('returns unauthenticated state for a revoked session', async () => {
    const { app, sessions } = createTestApp();
    const agent = request.agent(app);
    const csrfToken = await bootstrapCsrf(agent);
    await agent
      .post('/api/auth/login')
      .set(env.CSRF_HEADER_NAME, csrfToken)
      .send({ email: activeUser.email, password: PASSWORD })
      .expect(200);

    for (const session of sessions.values()) {
      session.revokedAt = new Date();
    }

    const response = await agent.get('/api/auth/session').expect(200);

    expect(CurrentSessionSchema.parse(response.body)).toEqual({
      authenticated: false,
      user: null,
    });
  });

  it('issues a CSRF cookie and token', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/auth/csrf').expect(200);

    expect(CsrfResponseSchema.parse(response.body).csrfToken).toBeTruthy();
    expect(
      extractCookieValue(response.headers['set-cookie'], env.CSRF_COOKIE_NAME),
    ).toBeTruthy();
  });

  it('logs out, revokes the session, and clears the cookie', async () => {
    const { app, auditLogger } = createTestApp();
    const agent = request.agent(app);
    const csrfToken = await bootstrapCsrf(agent);
    await agent
      .post('/api/auth/login')
      .set(env.CSRF_HEADER_NAME, csrfToken)
      .send({ email: activeUser.email, password: PASSWORD })
      .expect(200);

    const logoutResponse = await agent
      .post('/api/auth/logout')
      .set(env.CSRF_HEADER_NAME, csrfToken)
      .expect(200);

    expect(CurrentSessionSchema.parse(logoutResponse.body)).toEqual({
      authenticated: false,
      user: null,
    });
    expect(
      extractCookieValue(
        logoutResponse.headers['set-cookie'],
        env.SESSION_COOKIE_NAME,
      ),
    ).toBeFalsy();
    expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.logout' }),
    );

    const sessionResponse = await agent.get('/api/auth/session').expect(200);
    expect(CurrentSessionSchema.parse(sessionResponse.body)).toEqual({
      authenticated: false,
      user: null,
    });
  });

  it('logs out safely even without an active session', async () => {
    const { app } = createTestApp();
    const agent = request.agent(app);
    const csrfToken = await bootstrapCsrf(agent);

    const response = await agent
      .post('/api/auth/logout')
      .set(env.CSRF_HEADER_NAME, csrfToken)
      .expect(200);

    expect(CurrentSessionSchema.parse(response.body)).toEqual({
      authenticated: false,
      user: null,
    });
  });

  it('rejects logout without a valid CSRF token', async () => {
    const { app } = createTestApp();

    const response = await request(app).post('/api/auth/logout').expect(403);

    expect(response.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });
});
