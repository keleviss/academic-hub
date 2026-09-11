import type { Response } from 'express';

import { env, type Env } from '../config/env.js';

type SessionCookieEnv = Pick<
  Env,
  | 'SESSION_COOKIE_MAX_AGE_SECONDS'
  | 'SESSION_COOKIE_NAME'
  | 'SESSION_COOKIE_SAME_SITE'
  | 'SESSION_COOKIE_SECURE'
>;

export function setSessionCookie(
  response: Response,
  token: string,
  cookieEnv: SessionCookieEnv = env,
): void {
  response.cookie(cookieEnv.SESSION_COOKIE_NAME, token, {
    ...getSessionCookieOptions(cookieEnv),
    maxAge: cookieEnv.SESSION_COOKIE_MAX_AGE_SECONDS * 1000,
  });
}

export function clearSessionCookie(
  response: Response,
  cookieEnv: SessionCookieEnv = env,
): void {
  response.clearCookie(
    cookieEnv.SESSION_COOKIE_NAME,
    getSessionCookieOptions(cookieEnv),
  );
}

function getSessionCookieOptions(cookieEnv: SessionCookieEnv) {
  return {
    httpOnly: true,
    path: '/',
    sameSite: cookieEnv.SESSION_COOKIE_SAME_SITE,
    secure: cookieEnv.SESSION_COOKIE_SECURE,
  } as const;
}
