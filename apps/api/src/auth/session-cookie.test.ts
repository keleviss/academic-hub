import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { clearSessionCookie, setSessionCookie } from './session-cookie.js';

const cookieEnv = {
  SESSION_COOKIE_MAX_AGE_SECONDS: 60 * 60,
  SESSION_COOKIE_NAME: 'uniwa_session',
  SESSION_COOKIE_SAME_SITE: 'lax' as const,
  SESSION_COOKIE_SECURE: true,
};

describe('session cookie helpers', () => {
  it('sets the session token as an HttpOnly cookie', () => {
    const response = createResponseDouble();

    setSessionCookie(response, 'browser-session-token', cookieEnv);

    expect(response.cookie).toHaveBeenCalledWith(
      'uniwa_session',
      'browser-session-token',
      {
        httpOnly: true,
        maxAge: 60 * 60 * 1000,
        path: '/',
        sameSite: 'lax',
        secure: true,
      },
    );
  });

  it('clears the session cookie with matching attributes', () => {
    const response = createResponseDouble();

    clearSessionCookie(response, cookieEnv);

    expect(response.clearCookie).toHaveBeenCalledWith('uniwa_session', {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: true,
    });
  });
});

function createResponseDouble(): Response {
  return {
    clearCookie: vi.fn(),
    cookie: vi.fn(),
  } as unknown as Response;
}
